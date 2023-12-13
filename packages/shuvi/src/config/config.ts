import { PlatformWebCustomConfig } from '@shuvi/platform-web';
import { deepmerge } from '@shuvi/utils/deepmerge';
import { ShuviConfig } from '@shuvi/service';

function getDefaultPlatformConfig(): PlatformWebCustomConfig {
  return {
    ssr: true,
    router: {
      history: 'auto'
    },
    conventionRoutes: {}
  };
}

export function normalizePlatformConfig(rawConfig: ShuviConfig): ShuviConfig {
  console.log('-----------rawConfig', rawConfig)
  const config = deepmerge(getDefaultPlatformConfig(), rawConfig);
  console.log('-----------config', config)

  if (config.router.history === 'auto') {
    config.router.history = config.ssr ? 'browser' : 'hash';
  }

  return config;
}

export function defineConfig(config: ShuviConfig): ShuviConfig {
  return config;
}
