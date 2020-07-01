import { AppCtx, Page, launchFixture } from '../utils';

jest.setTimeout(5 * 60 * 1000);

afterEach(() => {
  // force require to load file to make sure compiled file get load correctlly
  jest.resetModules();
});

describe('Runtime Plugin', () => {
  let ctx: AppCtx;
  let page: Page;

  beforeAll(async () => {
    ctx = await launchFixture('runtime-plugin', { ssr: true });
  });
  afterEach(async () => {
    await page.close();
  });
  afterAll(async () => {
    await ctx.close();
  });

  test('should get pageData in client', async () => {
    page = await ctx.browser.page(ctx.url('/page-data'));
    await page.waitFor('[data-test-id="page-data"]');
    expect(await page.$text('[data-test-id="page-data"]')).toBe('bar');
  });
});