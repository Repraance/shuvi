import { ProjectBuilder } from '../project/projectBuilder';

import { createDefer, Defer } from '@shuvi/utils/lib/defer';
import chalk from '@shuvi/utils/lib/chalk';

import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';
import { FileInfo } from '../project/index';

const checkResumeInterval = 10;
const fallbackTimeout = 1000 * 30;

type Options = {
  onBuildStart: ProjectBuilder['onBuildStart'];
  onBuildEnd: ProjectBuilder['onBuildEnd'];
  onInvalid: ProjectBuilder['onInvalid'];
  isDependency: ProjectBuilder['isDependency'];
  /** only for testing. should be undefined or false in common case. */
  preventResumeOnInvalid?: boolean;
};

const mergeMaps = <K, V>(remaining: Map<K, V>, dropped: ReadonlyMap<K, V>) => {
  for (const [file, info] of dropped) {
    remaining.set(file, info);
  }
};

export default class WebpackWatchWaitForFileBuilderPlugin implements Plugin {
  options: Options;

  constructor(options: Options) {
    this.options = options;
  }
  apply(compiler: Compiler) {
    const { onBuildEnd, onInvalid, isDependency } = this.options;
    /**
     * watching.suspend will pause the real action in the watcher handler but still collecting changed files.
     * watching.resume will resume its action
     *
     * We make sure onBuildStart is faster than webpack's watcher and make it suspend.
     *
     * And resume when onBuildEnd.
     *
     * In this way, during build of fileBuilder, webpack will not trigger any watchRun event but keep watching changed files.
     */
    let checkResumeIntervalTimer: NodeJS.Timer | undefined;
    let fallbackTimer: NodeJS.Timer | undefined;
    let collectedChangedFiles = new Map<string, FileInfo>();
    onInvalid(() => {
      console.log(chalk.green('---- onInvalid' + compiler.name), Date.now());
      compiler.watching.suspend();
      if (checkResumeIntervalTimer && !this.options.preventResumeOnInvalid) {
        clearInterval(checkResumeIntervalTimer);
      }
    });

    /**
     * check if webpack watching can resume.
     * webpack watching cannot resume until all the changed files has been detected by webpack watcher.
     *
     */
    const canResume = (changedFiles: ReadonlyMap<string, FileInfo>) => {
      const fileInfoEntries =
        compiler.watching.watcher?.getInfo?.().fileTimeInfoEntries;
      if (!fileInfoEntries) return false;

      for (const [file, { timestamp }] of changedFiles) {
        const fileInfo = fileInfoEntries.get(file);
        const safeTime: number = (fileInfo as any)?.safeTime || 0;

        // webpack watcher's safeTime should >= timestamp
        if (safeTime < timestamp) {
          return false;
        }
      }
      return true;
    };

    onBuildEnd(({ changedFiles }) => {
      mergeMaps(collectedChangedFiles, changedFiles);

      // check collectedChangedFiles
      console.log(chalk.green('---- onBuildEnd' + compiler.name), Date.now());
      // fileBuilder's files have changed, wait webpack watcher that it also detect these files have changed
      if (collectedChangedFiles.size) {
        if (checkResumeIntervalTimer) {
          clearInterval(checkResumeIntervalTimer);
        }
        checkResumeIntervalTimer = setInterval(() => {
          if (canResume(collectedChangedFiles)) {
            console.log(
              chalk.green('---- canResume go resume' + compiler.name),
              Date.now()
            );
            collectedChangedFiles.clear();
            compiler.watching.resume();
            clearInterval(checkResumeIntervalTimer);
            clearTimeout(fallbackTimer);
            checkResumeIntervalTimer = undefined;
          }
        }, checkResumeInterval);

        // set a fallback timer in case of an exception that cannot be resumed
        fallbackTimer = setTimeout(() => {
          collectedChangedFiles.clear();
          compiler.watching.resume();
          clearInterval(checkResumeIntervalTimer);
          clearTimeout(fallbackTimer);
          checkResumeIntervalTimer = undefined;
        }, fallbackTimeout);
      } else {
        console.log(
          chalk.green('---- No changed Files, just resume' + compiler.name)
        );
        compiler.watching.resume();
      }
    });

    compiler.hooks.watchRun.tap('watchRun', () => {
      console.log('watchRun' + compiler.name, Date.now());
    });

    compiler.hooks.invalid.tap(
      'WebpackWatchWaitForFileBuilderPlugin-invalid',
      file => {
        // collect changed files and removed files and check if they are the dependencies of the fileBuilder
        // if yes, invoke `compiler.watching.suspend()`
        const removedFiles: Set<string> | undefined = (compiler.watching as any)
          ._collectedRemovedFiles;
        const files = new Set(removedFiles);
        if (file) {
          files.add(file);
        }

        for (const currentFile of files) {
          if (isDependency(currentFile)) {
            compiler.watching.suspend();
            return;
          }
        }
      }
    );
  }
}
