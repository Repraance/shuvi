import {
  AppCtx,
  Page,
  launchFixture,
  resolveFixture,
  check
} from '../utils/index';
import { renameSync, existsSync } from 'fs';

jest.setTimeout(30 * 60 * 1000);

describe('webpack watch wait file builder', () => {
  let ctx: AppCtx;
  let page: Page;
  const filePath = resolveFixture(
    'webpack-watch-wait-file-builder/src/sample.js'
  );
  const newFilePath = resolveFixture(
    'webpack-watch-wait-file-builder/src/new-sample.js'
  );
  describe('changing files should work with WebpackWatchWaitForFileBuilderPlugin', () => {
    test(`webpack watching should wait for fileBuilder's buildEnd and should not throw error when changing files`, async () => {
      try {
        ctx = await launchFixture('webpack-watch-wait-file-builder', {
          plugins: ['./plugin/fileBuilder']
        });
        page = await ctx.browser.page(ctx.url('/'));
        expect(await page.$text('#__APP')).toBe('Index Page sample');
        const errorSpy = jest.spyOn(console, 'error');
        const loopFn = async (time: number) => {
          renameSync(filePath, newFilePath);
          console.log('------------ current time', time);
          expect(console.error).toBeCalledTimes(0);

          await check(
            () => page.$text('#__APP'),
            t => /Index Page not exist/.test(t)
          );
          console.log('------------ current time', time);
          expect(errorSpy).not.toHaveBeenCalled();
          renameSync(newFilePath, filePath);
          console.log('------------ current time', time);
          expect(console.error).toBeCalledTimes(0);
          await check(
            () => page.$text('#__APP'),
            t => /Index Page sample/.test(t)
          );
        };

        const times = 100;

        for (let i = 0; i < times; i++) {
          await loopFn(i + 1);
        }
        expect(console.error).toBeCalledTimes(0);
      } finally {
        await page.close();
        await ctx.close();
        if (existsSync(newFilePath)) {
          renameSync(newFilePath, filePath);
        }
      }
    });
  });

  describe.skip('changing files should not work without WebpackWatchWaitForFileBuilderPlugin', () => {
    test(`webpack watching should not wait for fileBuilder's buildEnd and should throw error when changing files`, async () => {
      try {
        ctx = await launchFixture('webpack-watch-wait-file-builder', {
          plugins: ['./plugin/fileBuilder', './plugin/disableWebpackPlugin']
        });
        page = await ctx.browser.page(ctx.url('/'));
        expect(await page.$text('#__APP')).toBe('Index Page sample');
        const errorSpy = jest.spyOn(console, 'error');
        renameSync(filePath, newFilePath);
        await check(
          () => page.$text('#__APP'),
          t => /Index Page not exist/.test(t)
        );
        expect(errorSpy).toBeCalled();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[shuvi/server] Failed to compile')
        );
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[shuvi/client] Failed to compile')
        );
        errorSpy.mockClear();
        renameSync(newFilePath, filePath);
        await check(
          () => getIframeTextContent(page),
          t => /Module not found/.test(t)
        );
        expect(errorSpy).toBeCalled();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[shuvi/server] Failed to compile')
        );
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[shuvi/client] Failed to compile')
        );
      } finally {
        await page.close();
        await ctx.close();
        if (existsSync(newFilePath)) {
          renameSync(newFilePath, filePath);
        }
      }
    });
  });
});
