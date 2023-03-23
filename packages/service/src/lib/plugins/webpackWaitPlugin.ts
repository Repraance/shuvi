import { createPlugin } from '../../core/plugin';
import { IServiceMode } from '../../core';
import WebpackWatchWaitForFileBuilderPlugin, {
  Options
} from '../webpack-watch-wait-for-file-builder-plugin';

export const getWebpackWaitPlugin = (mode: IServiceMode, options: Options) =>
  createPlugin({
    configWebpack: config => {
      if (mode === 'development') {
        config
          .plugin('webpack-watch-wait-for-file-builder-plugin')
          .use(WebpackWatchWaitForFileBuilderPlugin, [options]);
      }
      return config;
    }
  });
