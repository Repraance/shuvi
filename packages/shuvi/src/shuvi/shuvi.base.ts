import { IShuviMode, APIHooks, Runtime } from '@shuvi/types';
import { IncomingMessage, ServerResponse } from 'http';
import {
  IHTTPRequestHandler,
  IIncomingMessage,
  IServerResponse
} from '../server';
import { getApi, Api } from '../api';
import { sendHTML } from '../lib/sendHtml';
import { renderToHTML } from '../lib/renderToHTML';
import { IConfig } from '../config';

export interface IShuviConstructorOptions {
  config: IConfig;
  configFile?: string;
}

export default abstract class Shuvi {
  protected _api!: Api;
  private _config: IConfig;
  private _configFile?: string;

  constructor({ config, configFile }: IShuviConstructorOptions) {
    this._config = config;
    this._configFile = configFile;
  }

  async ready(): Promise<void> {
    await this._ensureApiInited();
    await this.init();
  }

  getRequestHandler(): IHTTPRequestHandler {
    return this._api.server.getRequestHandler();
  }

  async renderToHTML(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<string | null> {
    const { server } = this._api.resources.server;
    const { html, appContext } = await renderToHTML({
      req: req as Runtime.IRequest,
      api: this._api,
      onRedirect(redirect) {
        res.writeHead(redirect.status ?? 302, { Location: redirect.path });
        res.end();
      }
    });

    if (server.onViewDone) {
      server.onViewDone(req, res, {
        html,
        appContext
      });
    }

    return html;
  }

  async close() {
    await this._api.destory();
  }

  async listen(port: number, hostname: string = 'localhost'): Promise<void> {
    await this._ensureApiInited();
    this._api.emitEvent<APIHooks.IEventServerListen>('server:listen', {
      port,
      hostname
    });
    await Promise.all([this._api.server.listen(port, hostname), this.ready()]);
  }

  protected abstract getMode(): IShuviMode;

  protected abstract init(): Promise<void> | void;

  protected _handle404(req: IIncomingMessage, res: IServerResponse) {
    res.statusCode = 404;
    res.end();
  }

  protected async _handlePageRequest(
    req: IIncomingMessage,
    res: IServerResponse
  ): Promise<void> {
    const html = await this.renderToHTML(req, res);
    if (html && !res.writableEnded) {
      sendHTML(req, res, html);
    }
  }

  private async _ensureApiInited() {
    if (this._api) {
      return;
    }

    this._api = await getApi({
      mode: this.getMode(),
      config: this._config,
      configFile: this._configFile
    });
  }
}
