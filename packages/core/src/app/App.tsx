import React from "react";
import { useStaticRendering } from "mobx-react";
import ReactFS from "@shuvi/react-fs";
import AppComponent from "./AppComponent";
import { File } from "./models/files";
import { Store, createStore, StoreProvider } from "./models/store";
import { IBuildOptions } from "./types";

export class App {
  private _store: Store;
  private _onBuildDoneCbs: Array<() => void> = [];

  constructor() {
    this._store = createStore();
  }

  setBootstrapModule(module: string) {
    this._store.bootstrapModule = module;
  }

  setAppModule(module: string) {
    this._store.appModule = module;
  }

  setRoutesContent(content: string): void {
    this._store.routesContent = content;
  }

  addFile(file: File, dir: string = "/"): void {
    this._store.addFile(file, dir);
  }

  waitUntilBuild(): Promise<void> {
    return new Promise(resolve => {
      this._onBuildDoneCbs.push(resolve);
    });
  }

  async build(options: IBuildOptions): Promise<void> {
    return new Promise(resolve => {
      ReactFS.render(this._getRootComp(), options.dir, () => {
        resolve();
      });
    });
  }

  async buildOnce(options: IBuildOptions): Promise<void> {
    useStaticRendering(true);
    try {
      await ReactFS.renderOnce(this._getRootComp(), options.dir);
    } finally {
      useStaticRendering(false);
    }
  }

  private _getRootComp() {
    return (
      <StoreProvider store={this._store}>
        <AppComponent onDidRender={this._onBuildDone.bind(this)} />
      </StoreProvider>
    );
  }

  private _onBuildDone() {
    while (this._onBuildDoneCbs.length) {
      const cb = this._onBuildDoneCbs.shift()!;
      cb();
    }
  }
}
