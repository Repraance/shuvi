import { createPlugin } from '../../core/plugin';

export const getAddIncludeToSwcLoaderPlugin = (dirs: string[]) =>
  createPlugin({
    configWebpack: config => {
      config.module.rule('main').oneOf('js').include.merge(dirs);
      return config;
    }
  });
