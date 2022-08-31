import { IManifest } from '@shuvi/toolpack/lib/webpack/types';
import { IPageRouteRecord } from '@shuvi/platform-shared/shared';

export default function generateFilesByRoutId(
  assetMap: IManifest,
  routes: IPageRouteRecord[]
): Record<string, string[]> {
  let filesByRoutId: Record<string, string[]> = {};
  const loadable = assetMap.loadble;
  routes.forEach(({ id, __componentRawRequest__ }) => {
    if (__componentRawRequest__) {
      const files = loadable[__componentRawRequest__]?.files;
      if (files) {
        filesByRoutId[id] = files;
      }
    }
  });

  return filesByRoutId;
}
