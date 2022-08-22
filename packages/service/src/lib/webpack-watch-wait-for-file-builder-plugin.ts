import { ProjectBuilder } from '../project/projectBuilder';

import { createDefer, Defer } from '@shuvi/utils/lib/defer';

import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';
import { TimeInfo } from '../project/index';

type Options = {
  onBuildStart: ProjectBuilder['onBuildStart'];
  onBuildEnd: ProjectBuilder['onBuildEnd'];
  onBuildTriggered: ProjectBuilder['onBuildTriggered'];
  invalidate: ProjectBuilder['invalidate'];
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
    const { onBuildEnd, onBuildStart, onBuildTriggered, invalidate } =
      this.options;
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
    onBuildTriggered(() => {
      compiler.watching.suspend();
    });

    /* onBuildStart(({ files }) => {
      console.log('onBuildStart files' + compiler.name, files);
    }); */

    const canResume = (changedFiles: ReadonlySet<string>) => {
      const webpackChanges = compiler.watching.watcher?.getInfo?.().changes;
      if (!webpackChanges) return false;
      for (const file of changedFiles) {
        if (!webpackChanges.has(file)) {
          return false;
        }
      }
      return true;
    };

    onBuildEnd(({ changedFiles, buildStatus, files }) => {
      console.log('===========onBuildEnd immediately', changedFiles);
      if (buildStatus === 'fulfilled') {
        // fileBuilder's files have changed, wait webpack watcher that it also detect these files have changed
        if (changedFiles.size) {
          let interval: NodeJS.Timer | undefined;
          let revealTimer: NodeJS.Timer | undefined;
          interval = setInterval(() => {
            if (canResume(changedFiles)) {
              console.log('onBuildEnd ready to resume', compiler.name);
              compiler.watching.resume();
              clearInterval(interval);
              clearTimeout(revealTimer);
            }
          }, 10);
          // 兜底，最大500ms
          /* revealTimer = setTimeout(() => {
            if (interval) {
              clearInterval(interval)
              compiler.watching.resume();
              throw new Error('timeout when waiting webpack watcher after onBuildEnd')
            }
          }, 500) */
        } else {
          // FIXME changedFiles的生成可能有问题，
          console.log('not changedFiles found, just resume', files);

          compiler.watching.resume();
        }
      }
    });

    compiler.hooks.watchRun.tap('watchRun', () => {
      console.log('watchRun', compiler.name, compiler.modifiedFiles);
    });

    compiler.hooks.invalid.tap('invalid plugin', () => {
      // @ts-ignore
      const modifiedFiles: Set<string> =
        compiler.watching._collectedChangedFiles || new Set();
      // @ts-ignore
      const removedFiles =
        compiler.watching._collectedRemovedFiles || new Set();
      /* const info = compiler.watching.watcher?.getInfo?.()?.fileTimeInfoEntries
      const modifiedInfos = new Map<string, TimeInfo>()
      if (modifiedFiles) {
        modifiedFiles.forEach(file => {
          const targetInfo = info?.get(file)
          if (targetInfo) {
            modifiedInfos.set(file, targetInfo as TimeInfo)
          }
        })
      } */
      const targets = invalidate(modifiedFiles, removedFiles);
      if (targets.size) {
        console.log('invalid suspend', compiler.name);
        compiler.watching.suspend();
      }
    });
  }
}
