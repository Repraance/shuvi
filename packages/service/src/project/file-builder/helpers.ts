import invariant from '@shuvi/utils/lib/invariant';
import {
  BuildInfo,
  DependencyInfo,
  FileId,
  FileInternalInstance,
  FileInfo
} from './types';
invariant;

export const getFileInstanceById = (
  id: string,
  filesMap: Map<FileId, FileInternalInstance<any, any>>
): FileInternalInstance => {
  const file = filesMap.get(id);
  invariant(file);
  return file;
};

export const getDependencyInfoById = (
  id: string,
  dependencyMap: Map<string, DependencyInfo>
) => {
  const info = dependencyMap.get(id);
  if (info) return info;
  dependencyMap.set(id, {
    dependencies: new Set(),
    dependents: new Set()
  });
  return dependencyMap.get(id) as DependencyInfo;
};

export const appendChangedFiles = (
  buildInfo: BuildInfo,
  changedFiles: ReadonlyMap<FileId, FileInfo>
) => {
  const { collectedChangedFiles } = buildInfo;
  for (const [file, info] of changedFiles) {
    collectedChangedFiles.set(file, info);
  }
};
