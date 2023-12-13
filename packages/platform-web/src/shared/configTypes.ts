import {
  IRouterHistoryMode,
  IPageRouteConfig
} from '@shuvi/platform-shared/shared';

export interface IRouterConfig {
  history: IRouterHistoryMode | 'auto';
  basename?: string;
}

export interface PlatformWebCustomConfig {
  ssr: boolean;
  router: IRouterConfig;
  // generate by files what under src/pages or user defined
  routes?: IPageRouteConfig[];
  conventionRoutes: {
    include?: string[];
    exclude?: string[];
  };
}
