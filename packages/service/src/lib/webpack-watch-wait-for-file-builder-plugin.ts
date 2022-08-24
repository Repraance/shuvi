import { ProjectBuilder } from '../project/projectBuilder';

import { createDefer, Defer } from '@shuvi/utils/lib/defer';
import chalk from '@shuvi/utils/lib/chalk';

import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';

type Options = {
  onBuildStart: ProjectBuilder['onBuildStart'];
  onBuildEnd: ProjectBuilder['onBuildEnd'];
  onInvalid: ProjectBuilder['onInvalid'];
  findFilesByDependencies: ProjectBuilder['findFilesByDependencies'];
  preventResumeOnInvalid?: boolean;
};

const mergeSets = <T>(remaining: Set<T>, dropped: ReadonlySet<T>) => {
  for (const item of dropped) {
    remaining.add(item);
  }
};

export default class WebpackWatchWaitForFileBuilderPlugin implements Plugin {
  options: Options;
  defer: Defer<Set<string>>;
  constructor(options: Options) {
    this.options = options;
    this.defer = createDefer();
    this.defer.resolve(new Set());
  }
  apply(compiler: Compiler) {
    const { onBuildEnd, onInvalid, findFilesByDependencies } = this.options;
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
    let interval: NodeJS.Timer | undefined;
    let revealTimer: NodeJS.Timer | undefined;
    let collectedChangedFiles = new Set<string>();
    onInvalid(() => {
      console.log(chalk.green('---- onInvalid' + compiler.name), Date.now());
      compiler.watching.suspend();
      if (interval) {
        // console.error('during checkRusume another build comes')
        clearInterval(interval);
        //
      }
    });

    const canResume = (
      changedFiles: ReadonlySet<string>,
      timestamp: number
    ) => {
      const fileInfoEntries =
        compiler.watching.watcher?.getInfo?.().fileTimeInfoEntries;
      if (!fileInfoEntries) return false;
      for (const file of changedFiles) {
        const fileInfo = fileInfoEntries.get(file);
        const safeTime: number = (fileInfo as any)?.safeTime || 0;
        if (safeTime < timestamp) {
          return false;
        }
      }

      const checkItem = (file: string): boolean => {
        const fileInfo = fileInfoEntries.get(file);
        const safeTime: number = (fileInfo as any)?.safeTime || 0;
        /* if (safeTime < timestamp) {
          return false;
        } */
        return safeTime >= timestamp;
      };

      const oneIsOK = Array.from(changedFiles).some(checkItem);
      const allIsOk = Array.from(changedFiles).every(checkItem);
      if (oneIsOK !== allIsOk) {
        console.error('---------- canResume result not same');
      }
      return true;
    };

    onBuildEnd(({ changedFiles, timestamp }) => {
      // collect changed files
      mergeSets(collectedChangedFiles, changedFiles);

      // check collectedChangedFiles
      console.log(chalk.green('---- onBuildEnd' + compiler.name), Date.now());
      // fileBuilder's files have changed, wait webpack watcher that it also detect these files have changed
      if (collectedChangedFiles.size) {
        if (interval) {
          clearInterval(interval);
        }
        interval = setInterval(() => {
          if (canResume(collectedChangedFiles, timestamp)) {
            console.log(
              chalk.green('---- canResume go resume' + compiler.name),
              Date.now()
            );
            collectedChangedFiles.clear();
            compiler.watching.resume();
            clearInterval(interval);
            clearTimeout(revealTimer);
            interval = undefined;
          }
        }, 10);
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

    compiler.hooks.invalid.tap('invalid plugin', file => {
      const modifiedFiles = new Set<string>();
      if (file) {
        modifiedFiles.add(file);
      }
      const removedFiles: Set<string> =
        (compiler.watching as any)._collectedRemovedFiles || new Set();
      const targets = findFilesByDependencies(modifiedFiles, removedFiles);
      console.log(
        '----invalid ' + compiler.name,
        Date.now(),
        modifiedFiles,
        removedFiles
      );
      if (targets.size) {
        compiler.watching.suspend();
      }
    });
  }
}
