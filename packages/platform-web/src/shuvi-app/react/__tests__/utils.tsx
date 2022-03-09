import { renderRoutes } from '../utils/__tests__/utils';
import { normalizeRoutes, INormalizeRoutesContext } from '../utils/router';
import { IAppRouteConfig } from '@shuvi/platform-shared/esm/runtime';

export const renderWithRoutes = (
  {
    routes = [],
    appContext = {}
  }: {
    routes?: IAppRouteConfig[];
    appContext?: INormalizeRoutesContext;
  } = {},
  { route = '/' }: { route?: string } = {}
) => {
  return renderRoutes(normalizeRoutes(routes, appContext), {
    route
  });
};
