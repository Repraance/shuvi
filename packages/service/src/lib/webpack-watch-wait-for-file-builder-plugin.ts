import { ProjectBuilder } from '../project/projectBuilder';

import { createDefer, Defer } from '@shuvi/utils/lib/defer';

import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';

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
    const { onBuildEnd, onBuildTriggered, invalidate } = this.options;
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

    onBuildEnd(({ changedFiles }) => {
      setTimeout(() => {
        // @ts-ignore
        compiler.watching._mergeWithCollected(changedFiles, new Set());
        compiler.watching.resume();
        // compiler.watching.suspended = false
        // compiler.watching.invalidate()
      }, 1000);
    });

    compiler.hooks.invalid.tap('invalid plugin', () => {
      // @ts-ignore
      const modifiedFiles = compiler.watching._collectedChangedFiles;
      // @ts-ignore
      const removedFiles = compiler.watching._collectedRemovedFiles;
      const targets = invalidate(modifiedFiles, removedFiles);
      if (targets) {
        compiler.watching.suspend();
      }
    });
  }
}
