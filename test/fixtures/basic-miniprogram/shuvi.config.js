module.exports = {
  ssr: false,
  platform: {
    name: 'mp',
    target: 'bmp'
  },
  router: {
    history: 'memory'
  },
  runtimeConfig: {
    a: 'a',
    b: 'b',
    hello: 'hello'
  },
  routes: [
    {
      path: '/',
      component: 'pages/index/index',
      props: {
        routePropsTest: 'routePropsTest value'
      }
    },
    {
      path: '/pages/sub/:title',
      component: 'pages/sub/index'
    },
    {
      path: '/pages/detail/:id',
      component: 'pages/detail/index'
    },
    {
      path: '/:first/:detail/:id',
      component: 'pages/detail/index'
    },
    {
      path: '/:other(.*)',
      component: 'pages/my/index'
    }
  ]
};