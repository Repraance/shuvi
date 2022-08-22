import { ProjectBuilder } from '../project/projectBuilder';

import { createDefer, Defer } from '@shuvi/utils/lib/defer';

import { Compiler, Plugin } from '@shuvi/toolpack/lib/webpack';
import { includesAll } from '../project/file-builder/utils';

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
    let onChangeSet = false;
    let building = false;
    let changedFilesAfterSuspend = new Set<string>();
    /**
     * watching.suspend will pause the real action in the watcher handler but still collecting changed files.
     * watching.resume will resume its action
     *
     * when hooks.watchRun is called, a new compilation is created.
     *
     * We need to suspend when file changes and then trigger build of fileBuilder
     * And resume when fileBuilder finish this build and webpack has detected changed files
     *
     *
     * We make sure onBuildStart is faster than webpack's watcher and make it suspend.
     *
     * And resume when onBuildEnd.
     *
     * In this way, during build of fileBuilder, webpack will not trigger any watchRun event but keep watching changed files.
     */
    onBuildTriggered(() => {
      console.log('onBuildTriggered suspend');
      compiler.watching.suspend();
      building = true;
    });

    onBuildEnd(({ changedFiles, buildStatus }) => {
      if (buildStatus === 'fulfilled') {
        console.log('onBuildEnd', buildStatus, changedFiles);
        changedFiles.forEach(file => {
          changedFilesAfterSuspend.add(file);
        });
        building = false;
      }
    });

    const checkAndResume = () => {
      console.log('checkAndResume');
      // @ts-ignore
      const collectedChangedFiles = compiler.watching._collectedChangedFiles;
      if (
        !building &&
        collectedChangedFiles &&
        includesAll(collectedChangedFiles, changedFilesAfterSuspend)
      ) {
        compiler.watching.resume();
        changedFilesAfterSuspend.clear();
        console.log('checkAndResume OK resumed', compiler.name);
      }
    };

    compiler.hooks.watchRun.tap('watchRun', () => {
      console.log('watchRun', compiler.name);
      if (!onChangeSet) {
        // @ts-ignore
        const originalOnChange = compiler.watching._onChange;
        // @ts-ignore
        compiler.watching._onChange = () => {
          originalOnChange();
          // @ts-ignore
          console.log('after onChange');
          checkAndResume();
        };
        onChangeSet = true;
      }
    });

    compiler.hooks.invalid.tap('invalid plugin', () => {
      // @ts-ignore
      const modifiedFiles = compiler.watching._collectedChangedFiles;
      // @ts-ignore
      const removedFiles = compiler.watching._collectedRemovedFiles;
      const targets = invalidate(modifiedFiles, removedFiles);
      if (targets.size) {
        console.log('invalid suspend');
        compiler.watching.suspend();
        building = true;
      }
    });
  }
}
