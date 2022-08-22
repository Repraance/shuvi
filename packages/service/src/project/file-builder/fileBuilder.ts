import invariant from '@shuvi/utils/lib/invariant';
import { createDefer, Defer } from '@shuvi/utils';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  watch as createWatcher,
  WatchOptions,
  Watcher
} from '@shuvi/utils/lib/fileWatcher';
import { uuid, ifIntersect, includesAll, isInfoEntriesSame } from './utils';
import {
  WATCH_AGGREGATE_TIMEOUT,
  COMPLETED_BUILDS_REMAIN_TIMEOUT
} from './constants';
import type {
  FileId,
  FileOption,
  FileInternalInstance,
  BuildInfo,
  DependencyInfo,
  FileStatus,
  FilesInfo,
  TimeInfo
} from './types';

type OnBuildStartEvent = {
  buildStatus: Defer['status'];
  files: ReadonlySet<string>;
  fileInfoEntries?: Map<string, TimeInfo>;
};

type OnBuildEndEvent = {
  buildStatus: Defer['status'];
  noChange?: boolean;
  files: ReadonlySet<string>;
  changedFiles: ReadonlySet<string>;
};

type OnBuildStartHandler = (event: OnBuildStartEvent) => void;
type OnBuildEndHandler = (event: OnBuildEndEvent) => void;
type EventCanceler = () => void;

export interface FileBuilder<C extends {}> {
  addFile: (...newFileOption: FileOption<any, C>[]) => void;
  build: (dir?: string) => Promise<void>;
  watch: (dir?: string) => Promise<void>;
  close: () => Promise<void>;
  getContent: <T>(fileOption: FileOption<T>) => T;
  onBuildStart: (eventHandler: OnBuildStartHandler) => EventCanceler;
  onBuildEnd: (eventHandler: OnBuildEndHandler) => EventCanceler;
  onBuildTriggered: (eventHandler: () => void) => EventCanceler;
  whichDependencies: (
    changedFiles: Set<string>,
    removedFiles?: Set<string>
  ) => Set<FileId>;

  /**
   * Manually trigger a build during watching.
   * If changedFiles or removedFiles is not provided, trigger a full rebuild for all files
   *
   * @returns targets {Set<string>} files needed to be rebuilt
   */
  invalidate: (
    changedFiles?: Set<string>,
    removedFiles?: Set<string>
  ) => Set<FileId>;
}

export const getFileBuilder = <C extends {} = {}>(
  fileContext?: C
): FileBuilder<C> => {
  let rootDir = '/';
  const context = fileContext || {};
  const fileOptions: FileOption<any>[] = [];
  const dependencyMap = new Map<FileId, DependencyInfo>();
  const watchMap = new Map<FileId, WatchOptions>();
  const watchingFilesMap = new Map<string, FileId>();
  const watcherCancelers: EventCanceler[] = [];
  const watchers = new Map<FileId, Watcher>();
  const files: Map<FileId, FileInternalInstance<any, any>> = new Map();
  let currentDefer: Defer; // mark current defer for closing

  const onBuildStartHandlers = new Set<OnBuildStartHandler>();
  const onBuildEndHandlers = new Set<OnBuildEndHandler>();
  const onBuildTriggeredHandlers = new Set<() => void>();

  const addFile = (...newFileOption: FileOption<any, C>[]) => {
    fileOptions.push(...newFileOption.map(option => ({ ...option })));
  };
  const createInstance = (
    fileOption: FileOption<any>,
    rootDir: string
  ): FileInternalInstance => {
    const instance: FileInternalInstance = {
      ...fileOption
    };
    if (!instance.virtual) {
      invariant(instance.name);
      instance.fullPath = path.resolve(rootDir, instance.name);
    }
    return instance;
  };

  const getFileInstanceById = (id: string): FileInternalInstance => {
    const file = files.get(id);
    invariant(file);
    return file;
  };

  const getFileIdByFileDependencyPath = (
    filePath: string
  ): FileId | undefined => {
    let currentFilePath = filePath;
    while (currentFilePath !== '/') {
      if (watchingFilesMap.has(currentFilePath)) {
        return watchingFilesMap.get(currentFilePath);
      }
      currentFilePath = path.dirname(currentFilePath);
    }
    return undefined;
  };

  const getDependencyInfoById = (id: string) => {
    const info = dependencyMap.get(id);
    if (info) return info;
    dependencyMap.set(id, {
      dependencies: new Set(),
      dependents: new Set()
    });
    return dependencyMap.get(id) as DependencyInfo;
  };

  const initFiles = async (
    fileOptions: FileOption<any, any>[],
    needWatch: boolean = false
  ) => {
    await Promise.all(
      fileOptions.map(async currentFile => {
        const { id, dependencies } = currentFile;
        /* if (currentFile.name) {
          // rootDir as well as Full path name would not be set until mount
          currentFile.name = path.resolve(rootDir, currentFile.name);
        } */
        // create instance
        if (!files.get(id)) {
          files.set(id, createInstance(currentFile, rootDir));
        }
        // collect dependencies
        const currentInfo = getDependencyInfoById(id);
        if (dependencies && dependencies.length) {
          await Promise.all(
            dependencies.map(async dependencyFile => {
              if (typeof dependencyFile === 'string') {
                // only collect watching info when needWatch
                if (needWatch) {
                  const directories: string[] = [];
                  const files: string[] = [];
                  const missing: string[] = [];
                  if (await fs.pathExists(dependencyFile)) {
                    if ((await fs.stat(dependencyFile)).isDirectory()) {
                      directories.push(dependencyFile);
                    } else {
                      files.push(dependencyFile);
                    }
                  } else if (dependencyFile) {
                    missing.push(dependencyFile);
                  }
                  watchMap.set(id, { directories, files, missing });
                  watchingFilesMap.set(dependencyFile, id);
                }
              } else {
                const dependencyId = dependencyFile.id;
                const currentDependencies = currentInfo.dependencies;
                currentDependencies.add(dependencyId);
                const dependents =
                  getDependencyInfoById(dependencyId).dependents;
                dependents.add(id);
              }
            })
          );
        }
      })
    );
  };

  const addPendingFiles = (
    fileIds: Set<FileId>,
    pendingFileList: Set<string>
  ) => {
    fileIds.forEach(id => {
      pendingFileList.add(id);
      const dependencyInfo = getDependencyInfoById(id);
      const { dependents } = dependencyInfo;
      addPendingFiles(dependents, pendingFileList);
    });
  };

  type BuildConditions = {
    shouldExecute: boolean;
    shouldSkip: boolean;
  };
  /**
   * get conditions if it is OK to execute content or to skip
   */
  const getCurrentConditions = (
    id: string,
    pendingFilesInfo: FilesInfo
  ): BuildConditions => {
    const dependencyInfo = getDependencyInfoById(id);
    const { dependencies } = dependencyInfo;

    // if no dependencies, just go to execute
    if (!dependencies.size) {
      return {
        shouldExecute: true,
        shouldSkip: false
      };
    }
    let allNoChange = true;
    for (const dep of dependencies) {
      const status = pendingFilesInfo.filesStatusMap.get(dep);
      // if status is undefined, this dep is not included in this build.
      if (status) {
        const { updated, noChange } = status;
        if (!updated) {
          return {
            shouldExecute: false,
            shouldSkip: false
          };
        }
        if (!noChange) {
          allNoChange = false;
        }
      }
    }
    return {
      shouldExecute: true,
      shouldSkip: allNoChange
    };
  };

  const runBuildSingleFile = async (
    id: string,
    pendingFilesInfo: FilesInfo,
    defer: Defer
  ) => {
    let { shouldExecute, shouldSkip } = getCurrentConditions(
      id,
      pendingFilesInfo
    );
    if (!shouldExecute) {
      return;
    }
    if (!shouldSkip) {
      const current = files.get(id);
      invariant(current);
      const fileContent = await current.content(context, current.fileContent);
      if (fileContent === current.fileContent) {
        shouldSkip = true;
      } else {
        current.fileContent = fileContent;
      }
      if (current.fullPath) {
        const dir = path.dirname(current.fullPath);
        fs.ensureDirSync(dir);
        fs.writeFileSync(current.fullPath, fileContent, 'utf-8');
      }
    }
    const currentStatus = pendingFilesInfo.filesStatusMap.get(id);
    invariant(currentStatus);
    currentStatus.updated = true;
    currentStatus.noChange = shouldSkip;
    // console.log('currentStatus.noChange', id, currentStatus.noChange)
    pendingFilesInfo.pendingFiles.delete(id);
    if (pendingFilesInfo.pendingFiles.size === 0) {
      defer.resolve();
    }
    const dependencyInfo = getDependencyInfoById(id);
    const { dependents } = dependencyInfo;
    dependents.forEach(dep => {
      runBuildSingleFile(dep, pendingFilesInfo, defer);
    });
  };

  const completedBuilds = new Map<string, BuildInfo>();
  const runningBuilds = new Map<string, BuildInfo>();
  const awaitingBuilds = new Map<string, BuildInfo>();

  /**
   * drop and its relationship will be merged into remain and remain's
   */
  const mergeBuilds = (remain: BuildInfo, drop: BuildInfo) => {
    awaitingBuilds.set(remain.id, remain);
    // merge files
    drop.files.forEach(file => {
      remain.files.add(file);
    });
    // replace fronts and rears
    // fronts must be runningBuilds
    drop.fronts.forEach(front => {
      remain.fronts.add(front);
      const frontBuild = runningBuilds.get(front);
      if (frontBuild) {
        frontBuild.rears.delete(drop.id);
        frontBuild.rears.add(remain.id);
      }
    });

    // rears must be awaitingBuilds
    drop.rears.forEach(rear => {
      remain.rears.add(rear);
      const rearBuild = awaitingBuilds.get(rear);
      if (rearBuild) {
        rearBuild.fronts.delete(drop.id);
        rearBuild.fronts.add(remain.id);
      }
    });
    awaitingBuilds.delete(drop.id);
  };

  const getPendingFiles = (sources?: Set<FileId>) => {
    const pendingFiles: Set<FileId> = sources
      ? new Set()
      : new Set(files.keys());
    if (sources) {
      // iterate dependencies to collect pending files
      addPendingFiles(sources, pendingFiles);
    }
    return pendingFiles;
  };

  const shouldDiscard = (
    formerBuild: BuildInfo,
    currentBuild: BuildInfo
  ): boolean => {
    //console.log('==========shouldDiscard', formerBuild.fileInfoEntries, currentBuild.fileInfoEntries)
    if (
      formerBuild.files &&
      formerBuild.fileInfoEntries &&
      currentBuild.files &&
      currentBuild.fileInfoEntries
    ) {
      if (
        includesAll(formerBuild.files, currentBuild.files) &&
        isInfoEntriesSame(
          formerBuild.fileInfoEntries,
          currentBuild.fileInfoEntries
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const buildOnce = async (
    changedSources?: Set<FileId>,
    fileInfoEntries?: Map<string, TimeInfo>,
    mark?: string
  ) => {
    const pendingFiles = getPendingFiles(changedSources);
    const files = new Set(pendingFiles);
    const buildInfo: BuildInfo = {
      id: uuid(),
      fronts: new Set<string>(),
      rears: new Set<string>(),
      files,
      pendingFiles,
      fileInfoEntries,
      mark
    };
    console.log('---------buildOnce', mark);
    // 如果本次的files完全一致，那么这个buildOnce直接丢弃
    for (const [_, runningBuild] of runningBuilds) {
      if (shouldDiscard(runningBuild, buildInfo)) {
        console.log(
          '---------buildOnce end shouldDiscard at runningBuilds',
          mark
        );
        return;
      }
    }

    for (const [_, runningBuild] of completedBuilds) {
      if (shouldDiscard(runningBuild, buildInfo)) {
        console.log(
          '---------buildOnce end shouldDiscard at completedBuilds',
          mark
        );
        return;
      }
    }

    // 判断是将这个buildOnce放入currentBuildings 还是awaitingBuildings

    for (const [_, runningBuild] of runningBuilds) {
      if (ifIntersect(runningBuild.files, buildInfo.files)) {
        runningBuild.rears.add(buildInfo.id);
        buildInfo.fronts.add(runningBuild.id);
      }
    }
    for (const [_, awaitingBuild] of awaitingBuilds) {
      if (ifIntersect(awaitingBuild.files, buildInfo.files)) {
        // buildInfo will replace existing awaitingBuild
        mergeBuilds(buildInfo, awaitingBuild);
      }
    }
    // this update cannot run immediately
    if (buildInfo.fronts.size) {
      if (!awaitingBuilds.has(buildInfo.id)) {
        console.log('---------buildOnce waiting', mark);
        awaitingBuilds.set(buildInfo.id, buildInfo);
      }
    } else {
      // this update does not conflict with all currentBuilds, run right away
      runningBuilds.set(buildInfo.id, buildInfo);
      await runBuildOnce(buildInfo);
    }
  };

  const runBuildOnce = async (buildInfo: BuildInfo) => {
    const { fronts } = buildInfo;
    // if its front has not completed, do not run
    if (Array.from(fronts).some(front => runningBuilds.has(front))) {
      return;
    }
    // clear from
    awaitingBuilds.delete(buildInfo.id);
    runningBuilds.set(buildInfo.id, buildInfo);
    const defer = createDefer<any>();
    currentDefer = defer;
    const files = buildInfo.files;
    console.log('onBuildStart======= fileBuilder', buildInfo.mark);
    Array.from(onBuildStartHandlers).forEach(handler => {
      handler({
        buildStatus: currentDefer.status,
        files,
        fileInfoEntries: buildInfo.fileInfoEntries
      });
    });
    const filesStatusMap = new Map<FileId, FileStatus>();
    buildInfo.files.forEach(file => {
      filesStatusMap.set(file, { updated: false });
    });
    const pendingFilesInfo: FilesInfo = {
      filesStatusMap,
      pendingFiles: buildInfo.pendingFiles
    };
    // const pendingFilesInfo =
    pendingFilesInfo.pendingFiles.forEach(file => {
      runBuildSingleFile(file, pendingFilesInfo, defer);
    });
    // if no pendingFiles, resolve directly
    if (!pendingFilesInfo.pendingFiles.size) {
      defer.resolve();
    }
    await defer.promise;
    const changedFileInstances = new Set<FileInternalInstance>();
    const changedFiles = new Set<string>();
    for (const [id, fileStatus] of pendingFilesInfo.filesStatusMap) {
      // console.log('onBuildEnd summary', id, fileStatus.noChange)
      if (!fileStatus.noChange) {
        const instance = getFileInstanceById(id);
        changedFileInstances.add(instance);
        if (instance.fullPath) {
          changedFiles.add(instance.fullPath);
        }
      }
    }

    const rears = buildInfo.rears;
    const buildStatus = rears.size > 0 ? 'pending' : 'fulfilled';
    console.log('onBuildEnd======= fileBuilder', buildInfo.mark);
    Array.from(onBuildEndHandlers).forEach(handler => {
      handler({ buildStatus, changedFiles, files });
    });

    // clear from runningBuilds and trigger next buildOnce
    runningBuilds.delete(buildInfo.id);

    // mark as completedBuilds and remove it after 1s
    completedBuilds.set(buildInfo.id, buildInfo);
    setTimeout(() => {
      completedBuilds.delete(buildInfo.id);
    }, COMPLETED_BUILDS_REMAIN_TIMEOUT);
    // rears should be at awaitingBuilds
    rears.forEach(rear => {
      const rearBuild = awaitingBuilds.get(rear);
      if (rearBuild) {
        runBuildOnce(rearBuild);
      } else {
        // FIXME: should not reach
        console.error('rearBuild not found');
      }
    });
  };

  const mergeInfoEntries = (
    currentEntries: Map<string, TimeInfo>,
    newEntries: Map<string, TimeInfo>
  ) => {
    for (const [file, info] of newEntries) {
      currentEntries.set(file, info);
    }
  };

  const addWatchers = () => {
    for (const [id, watchOptions] of watchMap) {
      const watcher = createWatcher(
        { ...watchOptions, aggregateTimeout: 5 },
        ({ fileInfoEntries }) => {
          // currently handler has no params
          watcherHandler(id, fileInfoEntries);
        },
        () => {
          Array.from(onBuildTriggeredHandlers).forEach(handler => {
            handler();
          });
        }
      );
      watchers.set(id, watcher);
      watcherCancelers.push(() => {
        watcher.close();
      });
    }
  };

  let currentTimer: NodeJS.Timeout | undefined;
  let currentChangedSources = new Set<FileId>();
  let currentFileInfoEntries: Map<string, TimeInfo> = new Map();
  const buildOnceHandler = () => {
    const fileInfoEntries = getFileInfoEntriesByIds(currentChangedSources);
    buildOnce(currentChangedSources, fileInfoEntries, 'fromWatcher');
    currentChangedSources.clear();
    currentTimer = undefined;
  };
  const watcherHandler = (
    id: FileId,
    fileInfoEntries: Map<string, TimeInfo>
  ) => {
    currentChangedSources.add(id);
    mergeInfoEntries(currentFileInfoEntries, fileInfoEntries);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }
    currentTimer = setTimeout(buildOnceHandler, WATCH_AGGREGATE_TIMEOUT);
  };

  const build = async (dir: string = '/') => {
    rootDir = dir;
    await initFiles(fileOptions);
    await buildOnce();
  };
  const watch = async (dir: string = '/') => {
    rootDir = dir;
    await initFiles(fileOptions, true);
    await buildOnce();
    addWatchers();
  };
  const close = async () => {
    // cancel all watchers
    watcherCancelers.forEach(canceler => {
      canceler();
    });
    // wait for current build
    if (currentDefer) {
      await currentDefer.promise;
    }
    // delete files
    files.forEach(instance => {
      const { name, virtual } = instance;
      if (name && !virtual) {
        fs.unlinkSync(name);
      }
    });
    files.clear();
    onBuildStartHandlers.clear();
    onBuildEndHandlers.clear();
    dependencyMap.clear();
    runningBuilds.clear();
    awaitingBuilds.clear();
  };
  const getContent = <T>(fileOption: FileOption<T>) => {
    return files.get(fileOption.id)?.fileContent;
  };
  const onBuildStart = (eventHandler: OnBuildStartHandler) => {
    onBuildStartHandlers.add(eventHandler);
    return () => {
      onBuildStartHandlers.delete(eventHandler);
    };
  };
  const onBuildEnd = (eventHandler: OnBuildEndHandler) => {
    onBuildEndHandlers.add(eventHandler);
    return () => {
      onBuildEndHandlers.delete(eventHandler);
    };
  };

  const onBuildTriggered = (eventHandler: () => void) => {
    onBuildTriggeredHandlers.add(eventHandler);
    return () => {
      onBuildTriggeredHandlers.delete(eventHandler);
    };
  };

  const getFileInfoEntriesByIds = (files: Set<string>) => {
    const fileInfoEntries = new Map<string, TimeInfo>();
    for (const fileId of files) {
      const watcher = watchers.get(fileId);
      if (watcher) {
        mergeInfoEntries(fileInfoEntries, watcher.getFileInfoEntries());
      }
    }
    return fileInfoEntries;
  };

  const whichDependencies = (
    changedFiles: Set<string>,
    removedFiles?: Set<string>
  ) => {
    const targets = new Set<FileId>();
    changedFiles.forEach(file => {
      const target = getFileIdByFileDependencyPath(file);
      if (target) {
        targets.add(target);
      }
    });
    if (removedFiles) {
      removedFiles.forEach(file => {
        const target = getFileIdByFileDependencyPath(file);
        if (target) {
          targets.add(target);
        }
      });
    }
    return targets;
  };

  const invalidate = (
    changedFiles?: Set<string>,
    removedFiles?: Set<string>
  ) => {
    const targets = new Set<FileId>();
    if (!changedFiles) return targets;
    changedFiles.forEach(file => {
      const target = getFileIdByFileDependencyPath(file);
      if (target) {
        targets.add(target);
      }
    });
    if (removedFiles) {
      removedFiles.forEach(file => {
        const target = getFileIdByFileDependencyPath(file);
        if (target) {
          targets.add(target);
        }
      });
    }
    if (targets.size) {
      // delay getFileInfoEntriesByIds to wait for files OK
      setTimeout(() => {
        const fileInfoEntries = getFileInfoEntriesByIds(targets);
        buildOnce(targets, fileInfoEntries, 'fromInvalidate');
      }, 10);
    }
    return targets;
  };
  return {
    addFile,
    build,
    watch,
    close,
    getContent,
    onBuildStart,
    onBuildEnd,
    onBuildTriggered,
    invalidate,
    whichDependencies
  };
};
