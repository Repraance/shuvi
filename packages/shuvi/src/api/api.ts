import {
  IConfig,
  IApi,
  ICallHookOpts,
  IHookOpts,
  Hooks as IHooks
} from "@shuvi/types";
import { Service, IServiceMode, App, IRouteConfig, IFile } from "@shuvi/core";
import { joinPath } from "@shuvi/utils/lib/string";
import { Hooks } from "../lib/hooks";
import { setRuntimeConfig } from "../lib/runtime-config";
import { serializeRoutes } from "../lib/serializeRoutes";
import { DEV_PUBLIC_PATH } from "../constants";
import { IResources, IBuiltResource, IPlugin } from "./types";
import { setupApp } from "./utils/setupApp";
import { initCoreResource } from "./utils/initCoreResource";
import { resolvePlugins } from "./utils/plugin";

export class Api implements IApi {
  config: IConfig;

  private _hooks: Hooks;
  private _service: Service;
  private _app: App;
  private _resources: IResources = {} as IResources;
  private _plugins: IPlugin[];

  constructor({ mode, config }: { mode: IServiceMode; config: IConfig }) {
    this.config = config;
    this._hooks = new Hooks();
    this._service = new Service({
      mode,
      rootDir: config.rootDir,
      config: config
    });
    this._app = new App();
    this._plugins = resolvePlugins(config.plugins || []);

    this._plugins.forEach(plugin => plugin.get()(this));

    initCoreResource(this);

    switch (typeof config.runtimeConfig) {
      case "function":
        setRuntimeConfig(config.runtimeConfig);
        break;
      case "object":
        setRuntimeConfig(() => config.runtimeConfig as any);
        break;
      default:
        break;
    }
  }

  get server() {
    return this._service.getServer();
  }

  get paths() {
    return this._service.paths;
  }

  get mode() {
    return this._service.mode;
  }

  get assetPublicPath(): string {
    let prefix =
      this._service.mode === "development"
        ? DEV_PUBLIC_PATH
        : this.config.assetPrefix;

    if (!prefix.endsWith("/")) {
      prefix += "/";
    }

    return prefix;
  }

  get resources(): IBuiltResource {
    return this._resources;
  }

  tap<Config extends IHooks.IHookConfig>(
    hook: Config["name"],
    opts: IHookOpts<Config["initialValue"], Config["args"]>
  ) {
    this._hooks.addHook(hook, opts);
  }

  async callHook<Config extends IHooks.IHookConfig>(
    name: Config["name"],
    ...args: Config["args"]
  ): Promise<void>;
  async callHook<Config extends IHooks.IHookConfig>(
    options: ICallHookOpts<Config["name"], Config["initialValue"]>,
    ...args: Config["args"]
  ): Promise<Config["initialValue"]>;
  // implement
  async callHook(options: string | ICallHookOpts<string>, ...args: any[]) {
    return this._hooks.callHook(options as any, ...args);
  }

  setBootstrapModule(path: string) {
    this._app.setBootstrapModule(path);
  }

  setAppModule(path: string) {
    this._app.setAppModule(path);
  }

  async setRoutes(routes: IRouteConfig[]) {
    routes = await this.callHook<IHooks.IAppRoutes>({
      name: "app:routes",
      initialValue: routes
    });
    let content = `export default ${serializeRoutes(routes)}`;
    content = await this.callHook<IHooks.IAppRoutesFile>({
      name: "app:routes-file",
      initialValue: content
    });
    this._app.setRoutesContent(content);
  }

  async buildApp(): Promise<void> {
    await setupApp(this);

    if (this.mode === "production") {
      this._app.buildOnce({ dir: this.paths.appDir });
    } else {
      this._app.build({ dir: this.paths.appDir });
    }
  }

  addResoure(identifier: string, loader: () => any): void {
    const cacheable = this.mode === "production";
    // TODO: warn exitsed identifier
    if (cacheable) {
      this._resources[identifier] = loader();
    } else {
      Object.defineProperty(this._resources, identifier, {
        get() {
          return loader();
        },
        enumerable: true,
        configurable: false
      });
    }
  }

  addFile(file: IFile, dir = ""): void {
    this._app.addFile(file, dir.startsWith("/") ? dir : `/${dir}`);
  }

  getAssetPublicUrl(...paths: string[]): string {
    return joinPath(this.assetPublicPath, ...paths);
  }

  resolveAppFile(...paths: string[]): string {
    return this._service.resolveAppFile(...paths);
  }

  resolveUserFile(...paths: string[]): string {
    return this._service.resolveUserFile(...paths);
  }

  resolveBuildFile(...paths: string[]): string {
    return this._service.resolveBuildFile(...paths);
  }

  getPluginApi() {
    return this;
  }
}
