const { createPlugin } = require('shuvi');
const path = require('path');

const resolveMiddleware = (...paths) =>
  path.join(__dirname, 'middlewares', ...paths);

module.exports = createPlugin({
  configWebpack: (config, { name }) => {
    if (name === 'shuvi/client') {
      config
        .entry('static/main')
        .prepend(path.resolve(__dirname, './setReporter.js'));
    }
    return config;
  },
  addMiddlewareRoutes: () => [
    {
      path: '/health-check',
      middleware: resolveMiddleware('health-check.js')
    },
    {
      path: '/*',
      middleware: resolveMiddleware('noop.js')
    }
  ]
});
