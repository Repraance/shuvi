import { createFsFromVolume, Volume } from 'memfs';
import type {
  Stats,
  Compiler as WebpackCompiler,
  Configuration,
} from 'webpack';
import webpack from 'webpack';
import { resolveFixture } from '../utils';

export interface WatchChainer {
  then(nextCb: CompileDoneCallback): this;
  end(endFn: JestDoneCallback): void;
}

export interface Compiler extends WebpackCompiler {
  __watching: WebpackCompiler.Watching;
  watch(
    watchOptions: WebpackCompiler.WatchOptions,
    handler?: WebpackCompiler.Handler
  ): WebpackCompiler.Watching;
  forceCompile(): void;
  waitForCompile(cb: CompileDoneCallback): WatchChainer;
}

export type CompileDoneCallback = (s: Stats) => any;
export type JestDoneCallback = (e?: Error) => void;

function waitForCompile(compiler: Compiler, initialCb: CompileDoneCallback) {
  let check: boolean = false;
  let end: JestDoneCallback;
  let pending: Promise<any> | void;
  const queue: Array<CompileDoneCallback | JestDoneCallback> = initialCb
    ? [initialCb]
    : [];

  function shift(stats: Stats) {
    const job = queue.shift();
    if (queue.length) {
      try {
        pending = (job as CompileDoneCallback)(stats);
      } catch (e) {
        finish(e);
        return;
      }
    }

    if (queue.length === 1) {
      finish();
    }
  }

  function finish(err?: Error) {
    const done = queue[queue.length - 1] as JestDoneCallback;
    compiler.__watching.close(() => {
      if (done) {
        done(err);
      } else {
        new Error('waitForCompile chain is missing .then(done)');
      }
    });
  }

  const chainer = {
    then: (nextCb: CompileDoneCallback) => {
      queue.push(nextCb);
      return chainer;
    },
    end: (endFn: JestDoneCallback) => {
      queue.push(endFn);
      end = endFn;
    },
  };

  compiler.hooks.done.tap('waitForCompile', async (stats) => {
    if (!check) {
      check = true;
      if (!queue.length || !end) {
        throw new Error('waitForCompile chain is missing .end(done)');
      }
    }

    try {
      await pending;
      shift(stats);
    } catch (error) {
      finish(error);
    }
  });

  return chainer;
}

// https://github.com/streamich/memfs/issues/404#issuecomment-522450466
function ensureWebpackMemoryFs(fs: any) {
  // Return it back, when it has Webpack 'join' method
  if (fs.join) {
    return fs;
  }

  // Create FS proxy, adding `join` method to memfs, but not modifying original object
  const nextFs = Object.create(fs);
  const joinPath = require('memory-fs/lib/join');

  nextFs.join = joinPath;

  return nextFs;
}

export function createCompiler(
  value: Configuration | WebpackCompiler
): Compiler {
  let compiler: Compiler;
  if (!(value instanceof webpack.Compiler)) {
    compiler = webpack({
      mode: 'development',
      output: {
        filename: '[name].js',
        chunkFilename: 'static/chunks/[name].js',
        path: resolveFixture('dist'),
      },
      ...value,
    }) as Compiler;
  } else {
    compiler = value as Compiler;
  }
  const webpackFs = ensureWebpackMemoryFs(createFsFromVolume(new Volume()));
  compiler.outputFileSystem = webpackFs;

  const originWatch = compiler.watch;
  compiler.watch = function (
    options: WebpackCompiler.WatchOptions,
    handler?: WebpackCompiler.Handler
  ) {
    const watching = originWatch.call(
      this,
      {
        aggregateTimeout: 500,
        poll: false,
        ...options,
      },
      (err, stats) => {
        handler && handler(err, stats);
      }
    );
    compiler.__watching = watching;
    return watching;
  };
  compiler.forceCompile = () => {
    // delay to next tick, so we can call this in advance
    setImmediate(() => {
      if (compiler.__watching) {
        compiler.__watching.invalidate();
      }
    });
  };
  compiler.waitForCompile = (cb: CompileDoneCallback) => {
    return waitForCompile(compiler, cb);
  };

  return compiler;
}

export function runCompiler(
  value: Configuration | WebpackCompiler
): Promise<Stats> {
  const compiler = createCompiler(value);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.hasErrors()) {
        reject(new Error(stats.compilation.errors[0]));
      } else {
        resolve(stats);
      }
    });
  });
}

export function watchCompiler(value: Configuration | Compiler): Compiler {
  const compiler = createCompiler(value);
  compiler.watch({});
  return compiler;
}

export function getModuleSource(
  stats: Stats,
  request: string | RegExp
): string {
  return stats.compilation.modules
    .find((m) =>
      typeof request === 'string'
        ? m.userRequest === request
        : request.test(m.userRequest)
    )
    ?.originalSource()
    .source();
}
