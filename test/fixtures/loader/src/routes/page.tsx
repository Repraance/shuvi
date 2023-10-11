import React from 'react';
import { useLoaderData, Loader, Link } from '@shuvi/runtime';
import { sleep } from '../utils';

const Index = () => {
  const data = useLoaderData<LoaderData>();

  return (
    <div id="loader-index">
      <p>{data.hello}</p>
      <div id="index-content">index page</div>
      <div>
        <Link to={`/parent/foo/a`} replace>
          Go /foo/a
        </Link>
        <Link to={`/always-fail`}>Go /always-fail</Link>
      </div>
      <div>
        <Link to={`/context/redirect/combo/b`}>Go /b</Link>
      </div>
      <div>
        <Link
          to={`/context/redirect?target=%2Fcontext%2Fredirect%2Fcombo%2Fparams%3Fquery%3D1`}
        >
          Go /context/redirect/combo
        </Link>
      </div>
      <div>
        <Link to={`/context/redirect?target=combo%2Fc`}>
          Go /context/redirect/combo/c
        </Link>
      </div>
    </div>
  );
};

type LoaderData = {
  hello: string;
};

export const loader: Loader<LoaderData> = async ctx => {
  if (typeof window !== 'undefined') {
    (window as any).__LOADER_RUNED__ = true;
  }

  await sleep(100);

  return {
    hello: 'world'
  };
};

export default Index;
