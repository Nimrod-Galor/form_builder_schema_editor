import { build, context } from "esbuild";

const config = {
    entryPoints: ["src/formPreview.js"],
    bundle: true,
    format: "iife",
    outfile: "public/js/formPreview.bundle.js",
    target: ["es2020"],
    logLevel: "info",
};

if (process.argv.includes("--watch")) {
    const ctx = await context(config);
    await ctx.watch();
} else {
    await build(config);
}
