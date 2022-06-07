import { PATH_PREFIX } from '@shuvi/shared/lib/constants';
// URL for static files under the 'dist' directory, e.g. localhost:xxx/_shuvi/static/runtime/react-refresh.js resolve the path to dist/client/runtime/react-refresh.js
export const PUBLIC_PATH = `${PATH_PREFIX}/`;
// URL for static files under the 'public' directory
export const ASSET_PUBLIC_PATH = '/';

export const BUILD_MANIFEST_PATH = 'build-manifest.json';

export const BUILD_MEDIA_PATH = 'static/media/[name].[hash:8].[ext]';

export const BUILD_DEFAULT_DIR = 'client';

export const BUILD_CLIENT_RUNTIME_MAIN = `static/runtime/main`;

export const BUILD_CLIENT_RUNTIME_WEBPACK = `static/runtime/webpack`;

export const BUILD_CLIENT_RUNTIME_POLYFILL = `static/runtime/polyfill`;

export const BUILD_SERVER_DIR = 'server';

export const BUILD_SERVER_FILE_SERVER = `server`;

export const PHASE_PRODUCTION_BUILD = 'PHASE_PRODUCTION_BUILD';

export const PHASE_PRODUCTION_SERVER = 'PHASE_PRODUCTION_SERVER';

export const PHASE_DEVELOPMENT_SERVER = 'PHASE_DEVELOPMENT_SERVER';

export const PHASE_INSPECT_WEBPACK = 'PHASE_INSPECT_WEBPACK';
