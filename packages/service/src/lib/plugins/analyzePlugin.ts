import { BundleAnalyzerPlugin } from '@shuvi/toolpack/lib/webpack/webpack-bundle-analyzer';
import { createPlugin } from '../../core/plugin';

export const getAnalyzePlugin = () =>
  createPlugin({
    configWebpack: (chain, { name }, { config }) => {
      if (config.analyze) {
        chain
          .plugin('private/bundle-analyzer-plugin')
          .use(BundleAnalyzerPlugin, [
            {
              logLevel: 'info',
              openAnalyzer: false,
              analyzerMode: 'static',
              reportFilename: `../analyze/${name}.html`,
              generateStatsFile: true,
              statsFilename: `../analyze/${name}-stats.json`
            }
          ]);
      }
      return chain;
    },
    afterBuild: ({ config }) => {}
  });
