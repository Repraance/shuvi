import { loadRouteComponent } from '../loadRouteComponent';
import { act } from 'shuvi-test-utils/reactTestRender';
import FirstPage from './fixtures/loadRouteComponent/firstPage';
import { renderWithRoutes } from './utils';

const firstPageComponent = loadRouteComponent(() => {
  return import('./fixtures/loadRouteComponent/firstPage');
});

const secondPageComponent = loadRouteComponent(() => {
  return import('./fixtures/loadRouteComponent/secondPage');
});

describe('loadRouteComponent [node]', () => {
  const routes = [
    {
      id: 'secondPage',
      component: secondPageComponent,
      path: '/second'
    },
    {
      id: 'firstPage',
      component: firstPageComponent,
      path: '/first'
    }
  ];

  const routeProps = {
    firstPage: {
      test: '123'
    }
  };

  it('basic', async () => {
    const { root, toJSON } = renderWithRoutes(
      { routes, routeProps },
      { route: '/first' }
    );

    await act(async () => {});

    // Spread routeProps as props
    expect(root.findByType(FirstPage).props).toMatchObject({
      test: '123'
    });

    expect(toJSON()).toMatchInlineSnapshot(`
      <div>
        first page
        <a
          href="/second"
          onClick={[Function]}
        >
          go second page
        </a>
      </div>
    `);

    // No getrouteProps
    const { toJSON: secondToJson } = renderWithRoutes(
      { routes, routeProps },
      {
        route: '/second'
      }
    );

    await act(async () => {});

    expect(secondToJson()).toMatchInlineSnapshot(`
      <div>
        second page
        <a
          href="/first"
          onClick={[Function]}
        >
          go first page
        </a>
      </div>
    `);
  });
});
