import { BuildInfo, DependencyInfo, FileId } from './types';

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
  changedFiles: ReadonlySet<FileId>
) => {
  const { collectedChangedFiles } = buildInfo;
  changedFiles.forEach(file => {
    collectedChangedFiles.add(file);
  });
};
