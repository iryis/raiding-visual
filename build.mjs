#!/usr/bin/node
import esbuild from "esbuild";

// I HATE NODE I HATE NODE I HATE NODE

// https://github.com/evanw/esbuild/issues/619#issuecomment-751995294
/**
 * @type {esbuild.Plugin}
 */
const makeAllPackagesExternalPlugin = {
    name: "make-all-packages-external",
    setup(build) {
        let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/; // Must not start with "/" or "./" or "../"
        build.onResolve({ filter }, args => ({ path: args.path, external: true }));
    },
};

const watch = process.argv.includes("--watch");

/**
 * @type {esbuild.BuildOptions}
 */
const nodeCommonOpts = {
    logLevel: "info",
    bundle: true,
    watch,
    minify: !watch,
    format: "cjs",
    platform: "node",
    target: ["esnext"],
    minify: true,
    sourcemap: "linked",
    plugins: [makeAllPackagesExternalPlugin],
};

await Promise.all([
    esbuild.build({
        ...nodeCommonOpts,
        entryPoints: ["src/index.ts"],
        outfile: "dist/index.js",
    }),
]).catch(err => {
    console.error("Build failed");
    console.error(err.message);
    // make ci fail
    if (!watch)
        process.exitCode = 1;
});
