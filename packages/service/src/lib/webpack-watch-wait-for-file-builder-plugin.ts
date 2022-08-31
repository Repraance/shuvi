import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';
import { ProjectBuilder } from '../project/projectBuilder';
import { FileInfo } from '../project/index';

const checkResumeInterval = 10;
const fallbackTimeout = 1000 * 5;

type Options = {
  onBuildStart: ProjectBuilder['onBuildStart'];
  onBuildEnd: ProjectBuilder['onBuildEnd'];
  onInvalid: ProjectBuilder['onInvalid'];
  isDependency: ProjectBuilder['isDependency'];
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
     * And resume when onBuildEnd.
     * In this way, during build of fileBuilder, webpack will not trigger any watchRun event but keep watching changed files.
     */
    let checkResumeIntervalTimer: NodeJS.Timer | undefined;
    let fallbackTimer: NodeJS.Timer | undefined;
    let collectedChangedFiles = new Map<string, FileInfo>();
    onInvalid(() => {
      compiler.watching.suspend();
      /**
       * if another onInvalid happened during checking resume loop,
       * then stop the checkResumeIntervalTimer and the fallback timer.
       */
      if (checkResumeIntervalTimer) {
        console.log('onInvalid clearInterval checkResumeIntervalTimer');
        clearInterval(checkResumeIntervalTimer);
        clearTimeout(fallbackTimer);
        checkResumeIntervalTimer = undefined;
      }
    });

    /**
     * check if webpack watching can resume.
     * webpack watching cannot resume until all the changed files has been detected by webpack watcher.
     *
     */
    const canResume = (changedFiles: ReadonlyMap<string, FileInfo>) => {
      //console.log('canResume check');
      const fileInfoEntries =
        compiler.watching.watcher?.getInfo?.().fileTimeInfoEntries;
      if (!fileInfoEntries) return false;

      for (const [file, { timestamp }] of changedFiles) {
        const fileInfo = fileInfoEntries.get(file);
        const safeTime: number = (fileInfo as any)?.safeTime || 0;
        if (!fileInfo) {
          console.log('============== not found');
        }
        // webpack watcher's safeTime should >= timestamp
        if (safeTime < timestamp) {
          //console.log('can Resume failed', file, fileInfo, timestamp);
          return false;
        }
      }
      console.log('canResume check OK');

      return true;
    };

    onBuildEnd(({ changedFiles }) => {
      console.log('onBuildEnd', changedFiles, compiler.watching.suspended);
      mergeMaps(collectedChangedFiles, changedFiles);
      console.log(
        'onBuildEnd collectedChangedFiles.size',
        collectedChangedFiles
      );
      // fileBuilder's files have changed, wait webpack watcher until it also detect these files have changed
      if (collectedChangedFiles.size) {
        if (!checkResumeIntervalTimer) {
          checkResumeIntervalTimer = setInterval(() => {
            if (canResume(collectedChangedFiles)) {
              collectedChangedFiles.clear();
              compiler.watching.resume();
              clearInterval(checkResumeIntervalTimer);
              clearTimeout(fallbackTimer);
              checkResumeIntervalTimer = undefined;
            }
          }, checkResumeInterval);
        }

        clearTimeout(fallbackTimer);
        // set a fallback timer in case of an exception that cannot be resumed
        fallbackTimer = setTimeout(() => {
          collectedChangedFiles.clear();
          compiler.watching.resume();
          clearInterval(checkResumeIntervalTimer);
          checkResumeIntervalTimer = undefined;
          console.log('fallback timer triggered');
        }, fallbackTimeout);
      } else {
        // resume directly when no changed files
        compiler.watching.resume();
      }
    });

    compiler.hooks.watchRun.tap('sdssds', () => {
      console.log('=======watchRun', compiler.name);
    });

    compiler.hooks.invalid.tap(
      'WebpackWatchWaitForFileBuilderPlugin-invalid',
      file => {
        console.log('=====invalid', compiler.name);
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
            console.log('=== suspended by invalid', compiler.name);
            return;
          }
        }
      }
    );
  }
}
