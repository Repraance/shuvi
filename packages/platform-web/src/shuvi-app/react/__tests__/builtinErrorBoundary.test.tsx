import * as React from 'react';
import {
  // getByText,
  render,
  // waitFor,
  cleanup
  // act
} from '@testing-library/react';
import application from '@shuvi/platform-shared/shuvi-app/application';
import {} from '../AppContainer';
test('built-in ErrorBoundary should work', () => {
  const app = application<{ ssr: boolean }>({
    config: { ssr: true },
    router: null as any,
    AppComponent: null
  });
  const renderResult = render(<div></div>);
});
