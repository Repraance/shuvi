import { RouterView, useRouter, useCurrentRoute } from '@shuvi/runtime';
import React from 'react';

const MyApp = () => {
  const router = useRouter();
  const { params } = useCurrentRoute();

  React.useEffect(() => {
    let routerListener;
    if (typeof window !== 'undefined') {
      routerListener = router.listen(() => {
        console.log('history change');
      });
    }
    return () => routerListener();
  }, []);

  return (
    <div>
      <div>{ JSON.stringify(params) }</div>
      <RouterView />
    </div>
  );
};

export default MyApp;
