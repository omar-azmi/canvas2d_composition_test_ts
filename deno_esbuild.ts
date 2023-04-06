/** usage:
 * - `deno run -A deno_esbuild.ts "D:/file/to/bundle/mod.ts" "./optional/out/dir/"` for bundling the main module (default if unspecified in `Deno.args`)
*/

import { basename, dirname, extname, join } from "https://deno.land/std/path/mod.ts"
import { build as esbuild, stop as esstop } from "https://deno.land/x/esbuild/mod.js"
import denoResolve from "https://deno.land/x/esbuild_plugin_deno_resolve/index.ts"
import { solidPlugin } from "https://esm.sh/esbuild-plugin-solid?external=esbuild"

const import_map = {
	imports: {
		"solid-js": "https://esm.sh/solid-js?target=esnext",
		"solid-js/web": "https://esm.sh/solid-js/web?target=esnext"
	}
}

const
	file_to_compile = Deno.args[0],
	outdir = Deno.args[1] ?? dirname(file_to_compile),
	file_to_compile_ext = extname(file_to_compile),
	temp_file = join(outdir, basename(file_to_compile).replace(new RegExp(file_to_compile_ext + "$"), ".temp.js")),
	compiled_file = join(outdir, basename(file_to_compile).replace(new RegExp(file_to_compile_ext + "$"), ".js"))
let
	t0 = performance.now(),
	t1 = 0

await esbuild({
	entryPoints: [file_to_compile],
	outfile: compiled_file,
	bundle: true,
	minify: false,
	platform: "browser",
	format: "esm",
	target: "esnext",
	// you must mark every bare import as external, so that they can be handled by `denoPlugin` later throught the provided `importMapURL` option
	external: ["solid-js", "solid-js/web"],
	// disable tree-shaking if you encounter issues with proxy objects
	treeShaking: true,
	// compile SolidJS JSX
	plugins: [
		solidPlugin({
			solid: {
				generate: "dom",
			}
		}),
		//denoResolve(import_map)
	],
})

esstop()
t1 = performance.now()
console.log("execution time:", t1 - t0, "ms")
console.log("dist binary size:", Deno.statSync(compiled_file).size / 1024, "kb")

// once you've used your `compiled_file`, delete it from your filesystem externally, or using deno:
// await `Deno.remove(temp_file)`
// `Deno.removeSync(compiled_file)`
