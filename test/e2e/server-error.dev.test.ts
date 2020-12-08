import { AppCtx, Page, launchFixture } from '../utils';

jest.setTimeout(5 * 60 * 1000);

describe('Custom Server.js with error development', () => {
  let ctx: AppCtx;
  let page: Page;
  let logSpy = jest
    .spyOn(console, 'error')
    .mockImplementationOnce(() => void 0);

  afterEach(async () => {
    await ctx.close();
    logSpy.mockRestore();
  });
  test('should expose error stack in dev', async () => {
    ctx = await launchFixture('custom-server-with-error');
    page = await ctx.browser.page();
    const result = await page.goto(ctx.url('/'));

    if (!result) {
      throw Error('no result');
    }

    // Note: Client
    expect(result.status()).toBe(501);
    expect(await page.$text('body')).toContain('Server Render Error');
    expect(await page.$text('body')).toContain('Error: Something wrong');
    expect(await page.$text('body')).toContain(
      'shuvi/test/fixtures/custom-server-with-error/dist/server/server.js'
    );

    // Note: Server
    expect(logSpy).toHaveBeenLastCalledWith(
      'server error: / ',
      expect.objectContaining({
        message: expect.stringMatching(/Something wrong/)
      })
    );
  });
});