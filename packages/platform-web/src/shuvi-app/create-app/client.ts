import UserAppComponent from '@shuvi/app/user/app';
import routes from '@shuvi/app/files/routes';
import {
  getRoutes,
  app as PlatformAppComponent
} from '@shuvi/app/core/platform';
import {
  IApplication,
  getModelManager,
  getErrorHandler,
  IAppState,
  IAppRenderFn,
  IClientAppContext,
  IPageRouteRecord,
  IAppData
} from '@shuvi/platform-shared/esm/runtime';
import application from '@shuvi/platform-shared/esm/shuvi-app/application';
import {
  createRouter,
  IRouter,
  createBrowserHistory,
  createHashHistory
} from '@shuvi/router';
import { historyMode } from '@shuvi/app/files/routerConfig';
import { History } from '@shuvi/router/lib/types';
import { SHUVI_ERROR_CODE } from '@shuvi/shared/lib/constants';
import { getLoaderManager } from '../react/loader/loaderManager';

declare let __SHUVI: any;
let app: IApplication;
let currentAppContext: IClientAppContext;
let currentAppRouter: IRouter<IPageRouteRecord>;
let currentAppData: IAppData;

export function createApp<CompType, AppState extends IAppState>(options: {
  render: IAppRenderFn<IClientAppContext, CompType>;
  appData: IAppData<any, AppState>;
}) {
  // app is a singleton in client side
  if (app) {
    return app;
  }
  const { appData } = options;
  currentAppData = appData;
  const { loadersData = {}, appState, routeProps } = appData;
  const modelManager = getModelManager(appState);
  let history: History;
  if (historyMode === 'hash') {
    history = createHashHistory();
  } else {
    history = createBrowserHistory();
  }

  const context: IClientAppContext = {};

  // loaderManager is created here and will be cached.
  getLoaderManager(loadersData);

  const router = createRouter({
    history,
    routes: getRoutes(routes, context, { routeProps })
  });
  router.afterEach(_current => {
    if (!_current.matches) {
      getErrorHandler(modelManager).errorHandler(
        SHUVI_ERROR_CODE.PAGE_NOT_FOUND
      );
    }
  });
  currentAppRouter = router;
  currentAppContext = context;

  app = application({
    AppComponent: PlatformAppComponent,
    router,
    context,
    modelManager,
    render: options.render,
    UserAppComponent
  });
  return app;
}

if (module.hot) {
  module.hot.accept(
    [
      '@shuvi/app/user/app',
      '@shuvi/app/entry',
      '@shuvi/app/files/routes',
      '@shuvi/app/files/page-loaders',
      '@shuvi/app/user/runtime'
    ],
    async () => {
      const rerender = () => {
        const UserAppComponent = require('@shuvi/app/user/app').default;
        const routes = require('@shuvi/app/files/routes').default;
        currentAppRouter.replaceRoutes(
          getRoutes(routes, currentAppContext, currentAppData)
        );
        app.rerender({ AppComponent: PlatformAppComponent, UserAppComponent });
      };
      // to solve routing problem, we need to rerender routes
      // wait navigation complete only rerender to ensure getInitialProps is called
      if (__SHUVI.router._pending) {
        const removelistener = __SHUVI.router.afterEach(() => {
          rerender();
          removelistener();
        });
      } else {
        rerender();
      }
    }
  );
}