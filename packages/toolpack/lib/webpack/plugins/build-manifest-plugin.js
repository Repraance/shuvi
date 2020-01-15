"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_sources_1 = require("webpack-sources");
// This plugin creates a build-manifest.json for all assets that are being output
// It has a mapping of "entry" filename to real filename. Because the real filename can be hashed in production
class BuildManifestPlugin {
    constructor(options) {
        this.filename = "build-manifest.json";
        this.filename = options.filename;
    }
    apply(compiler) {
        compiler.hooks.emit.tapAsync("BuildManifest", (compilation, callback) => {
            const assetMap = {
                entries: {}
            };
            // compilation.entrypoints is a Map object, so iterating over it 0 is the key and 1 is the value
            for (const [, entrypoint] of compilation.entrypoints.entries()) {
                const filesForEntry = [];
                for (const chunk of entrypoint.chunks) {
                    // If there's no name or no files
                    if (!chunk.name || !chunk.files) {
                        continue;
                    }
                    for (const file of chunk.files) {
                        if (/\.map$/.test(file) || /\.hot-update\.js$/.test(file)) {
                            continue;
                        }
                        // Only `.js` and `.css` files are added for now. In the future we can also handle other file types.
                        if (!/\.js$/.test(file) && !/\.css$/.test(file)) {
                            continue;
                        }
                        filesForEntry.push(file.replace(/\\/g, "/"));
                    }
                }
                assetMap.entries[entrypoint.name] = [...filesForEntry];
            }
            compilation.assets[this.filename] = new webpack_sources_1.RawSource(JSON.stringify(assetMap, null, 2));
            callback();
        });
    }
}
exports.default = BuildManifestPlugin;
