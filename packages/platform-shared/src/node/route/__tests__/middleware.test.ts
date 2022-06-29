import { getFixturePath, normalizeWarnings, normalizePath } from './utils';
import { getMiddlewareRoutes } from '../route';

const getFixtureMiddlewareRoutes = async (dirname: string) => {
  const dir = getFixturePath(dirname);
  const { routes, warnings, errors } = await getMiddlewareRoutes(dir);

  return {
    routes: normalizePath(routes, dir, 'middlewares'),
    warnings: normalizeWarnings(warnings, dir),
    errors: normalizeWarnings(errors, dir)
  };
};

describe('middleware routes test', () => {
  it('should get correct middlewares', async () => {
    const result = await getFixtureMiddlewareRoutes('middlewares');
    expect(result).toMatchObject({
      routes: [
        {
          path: '/a',
          middlewares: ['middleware.js', 'a/middleware.js']
        },
        {
          path: '/b/b1',
          middlewares: [
            'middleware.js',
            'b/middleware.js',
            'b/b1/middleware.js'
          ]
        },
        {
          path: '/b/b2',
          middlewares: [
            'middleware.js',
            'b/middleware.js',
            'b/b2/middleware.js'
          ]
        },
        {
          path: '/b',
          middlewares: ['middleware.js', 'b/middleware.js']
        },
        {
          path: '/c',
          middlewares: ['middleware.js']
        },
        {
          path: '/',
          middlewares: ['middleware.js']
        }
      ],
      warnings: [],
      errors: []
    });
  });

  it('should get empty array when has not middleware', async () => {
    const result = await getFixtureMiddlewareRoutes('layout');
    expect(result).toMatchObject({
      errors: [],
      warnings: [],
      routes: []
    });
  });
});