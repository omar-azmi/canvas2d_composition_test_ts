#!/usr/bin/env python
"""
This simple webserver preprocesses/transpiles any typescript (".ts"), react-like tsx (".tsx", ".jsx"), or sass (".sass", ".scss") on-demand, then reroutes the GET request to the compiled file.
Files are only recompiled if they've been modified since last compilation.
Use `KeyboardInterrupt` (ie: "ctrl+c") to shutdown the server and delete all compiled files so that your workspace remains clean.
Input one of the command characters `["r", "l", "d", "s"]` to interact with the server file management.

Note that only files linked directly into html will be watched.
modification of indirect dependancies will not be picked up by the server.
it will be wise to use the `"r"` command to mark all files as modified and force recompilation during such situation.

### Use case:
- you don't want to pollute your directory with tens of config files
- you don't want to deal with hard-coding "path_to_compiled_file" in your html. rather, you'd prefer linking to the source files 
- you don't want to use node or npm commands to run tasks
- you don't want to conform to a certain project structure for your predefined npm build tasks to work at all
- you want a one-click prototying webserver that recompiles source files on modification
- you just want 3+1 files in your web directory ("index.html", "script.ts", "style.sass"), no "bin, dist, temp, src, public, etc..." nonsense

### Sample usage:
#### index.html
```html
<script src="./script.ts" type="module"></script>
<link rel="stylesheet" href="./style.scss">
<div id="my-div" class="my-bg"></div>
```
#### style.scss
```scss
.my-bg {
	$color1: rgba(255, 0, 0, 1.0); /*checker tile color 1*/
	$color2: rgba(0, 0, 255, 1.0); /*checker tile color 2*/
	background: repeating-conic-gradient($color1 0% 25%, $color2 0% 50%) 0px 0px;
	background-size: 20px 20px;
}
```
#### script.ts
```ts
import confetti from "https://cdn.skypack.dev/canvas-confetti?dts"
confetti()
var d: HTMLDivElement = document.querySelector("#my-div")
var b: HTMLButtonElement = document.createElement("button")
b.innerHTML = "Hello World" as string
b.addEventListener("click", () => { confetti() })
d.appendChild(b)
```
#### devserver.py
Run this python file to begin the localhost and lan webserver (on port 8000 by default).
If this python script is accessible to python's module path (ie: saved to "%PYTHONPATH%/devserver/__main__.py"),
then you can simply run the following shell command to initiate this server from any directory:
```cmd
python -m devserver
```
"""

import mimetypes
import socket
import socketserver
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from time import perf_counter
import sys

### add additional custom preprocessor commands to the `PreprocessedWebServer` class's declaration ###
PORT = 8000
SASS_CMD = """sass "{INPUT}" "{OUTPUT}" --no-source-map"""
# TSC_CMD = """tsc "{INPUT}" --lib "dom, esnext" --target "es6" --skipLibCheck"""
# TSC_TSX_CMD = """tsc "{INPUT}" --jsx "react" --lib "dom, esnext" --target "es6" --skipLibCheck"""
# DENO_TSX_CMD = """deno bundle --no-check "{INPUT}" -- "{OUTPUT}" """
# DENO_TSX_CMD = """deno bundle --no-check --import-map="C:/sdk/deno/global_importmap.json" "{INPUT}" -- "{OUTPUT}" """
# DENO_TS_CMD = """deno bundle --no-check "{INPUT}" -- "{OUTPUT}" """
py_module_path = Path(sys.argv[0]).parent
esbuild_script_path = py_module_path.joinpath("./deno_esbuild.ts")
current_working_path = Path.cwd()
DENO_ESBUILD_CMD = f"deno run -A \"{esbuild_script_path}\" \"{current_working_path}\\" + "{INPUT}\""

include_mime_types = {
	# files requiring preprocessing must have the same mime type as their compiled counterparts:
	".ts": "text/javascript",
	".tsx": "text/javascript",
	".jsx": "text/javascript",
	".scss": "text/css",
	".sass": "text/css",
	# additional mime types that are not there by default:
	"": "application/octet-stream",
	".txt": "text/plain",
	".html": "text/html",
	".css": "text/css",
	".js": "text/javascript",
	".png": "image/png",
	".jpg": "image/jpg",
	".svg": "image/svg+xml",
	".wasm": "application/wasm",
	".json": "application/json",
	".xml": "application/xml",
}
for ext, mt in include_mime_types.items():
	mimetypes.add_type(mt, ext)


class WatchedFile:
	def __init__(self, path: str | Path):
		self.path: Path = path if isinstance(path, Path) else Path(path)
		self.last_modified = self.path.stat().st_mtime

	def has_changed(self) -> bool:
		current_modified_time = self.path.stat().st_mtime
		if current_modified_time != self.last_modified:
			self.last_modified = current_modified_time
			return True
		else:
			return False

	def samefile(self, file_path: str | Path) -> bool:
		return self.path.samefile(file_path)

	def set_dirty(self) -> None:
		# manually set the watched file to "modified" (ie dirty), so that has_changed returns true
		self.last_modified -= 1


class Preprocessor:
	def __init__(
		self,
		# input file extension to preprocess.
		# e.g: `".ts"` or `[".scss", ".sass"]` or `[".tsx", ".jsx"]`
		input_ext: str | list[str],
		# output file extension. needed for renaming and identification purposes.
		# e.g: `".js"` or `".css`
		output_ext: str,
		# a string template for the shell command that invokes the compiler.
		# use `{INPUT}` and `{OUTPUT}` in the string template to dictate input and output file (do not include extensions).
		# e.g: `"""tsc "{INPUT}" --lib "dom" --target "es6" """` or `"""sass "{INPUT}" "{OUTPUT}" --no-source-map"""`
		compiler_command: str,
	):
		self.input_ext: list[str] = [input_ext] if isinstance(input_ext, str) else input_ext
		self.output_ext: str = output_ext
		self.compiler_command = compiler_command
		self.watched_files_cache: list[WatchedFile] = []

	def process(self, file_path: str | Path) -> None | Path:
		file_path = file_path if isinstance(file_path, Path) else Path(file_path)
		file_path = file_path.absolute().relative_to(current_working_path)
		if self.needs_preprocessing(file_path):
			# check if the file is already cached and has not been modified since last time, hence no need for recompilation
			for wf in self.watched_files_cache:
				if wf.samefile(file_path) and not wf.has_changed():
					return self.output_file_path(file_path)
			# cache this file and then proceed to compilation
			self.watched_files_cache.append(WatchedFile(file_path))
			self.compile(file_path)
			return self.output_file_path(file_path)
		else:
			return None

	def compile(self, file_path: Path) -> None:
		t = perf_counter()
		output_file = self.output_file_path(file_path)
		subprocess.run(self.compiler_command.format(INPUT=str(file_path), OUTPUT=str(output_file)), shell=True, stdout=subprocess.DEVNULL)
		print(f"""compiled "{str(file_path)}" in {perf_counter() - t}""")

	def output_file_path(self, input_file_path: Path) -> Path:
		return Path(input_file_path.parent, input_file_path.stem + self.output_ext)

	def needs_preprocessing(self, file_path: Path) -> bool:
		file_ext = file_path.suffix
		return True if file_ext in self.input_ext and file_path.exists() and file_path.is_file() else False

	def set_all_dirty(self) -> None:
		# set all watched cached output files as dirty (ie modified and requiring recompilation)
		for wf in self.watched_files_cache:
			wf.set_dirty()

	def list_all_output(self) -> list[Path]:
		# list all cached output files' path generated by the compilers (self.watched_files_cache)
		output_files_generated = [self.output_file_path(wf.path) for wf in self.watched_files_cache]
		return output_files_generated

	def delete_all_output(self) -> None:
		# delete all cached outputs generated by the compilers (self.watched_files_cache). use this cautiously, as it may unintentionally delete your source files
		for wf in self.watched_files_cache:
			output_file = self.output_file_path(wf.path)
			if output_file.exists() and output_file.is_file():
				print(f"""deleting {output_file}""")
				output_file.unlink()
		self.watched_files_cache = []


class PreprocessedWebServer(SimpleHTTPRequestHandler):
	### Add additional preprocessors here ###
	preprocessors: list[Preprocessor] = [
		Preprocessor(".ts", ".js", DENO_ESBUILD_CMD),  # typescript compiler
		Preprocessor([".tsx", ".jsx"], ".js", DENO_ESBUILD_CMD),  # react-like tsx and jsx compiler
		Preprocessor([".sass", ".scss"], ".css", SASS_CMD),  # scss and sass compiler
	]

	def do_GET(self):
		# intercept all GET requests before sending them to base/super class
		requested_path = Path(self.translate_path(self.path))
		for prepc in self.preprocessors:
			output_file = prepc.process(requested_path)
			if output_file is not None:
				# the file has been preprocessed for real. modify the requested path to redirect to the newly produced output file
				self.path = output_file.absolute().relative_to(current_working_path).as_posix()
				break
		# let the super class handle the GET request now
		SimpleHTTPRequestHandler.do_GET(self)

	@classmethod
	def set_all_dirty(cls) -> None:
		print("all watched files set to dirty and modified")
		for prepc in cls.preprocessors:
			prepc.set_all_dirty()

	@classmethod
	def list_all_output(cls) -> list[Path]:
		print("list of all compiled output files requested")
		output_files_generated: list[Path] = []
		for prepc in cls.preprocessors:
			output_files_generated += prepc.list_all_output()
		return output_files_generated

	@classmethod
	def delete_all_output(cls) -> None:
		print("deletion of all compiler output files requested")
		for prepc in cls.preprocessors:
			prepc.delete_all_output()


def print_hosting_info() -> None:
	global PORT
	lan_ip = socket.gethostbyname_ex(socket.getfqdn())[2][0]
	print(f"serving localmachine at http://localhost:{PORT}")
	print(f"serving LAN websever at http://{lan_ip}:{PORT}")


def print_commands_info() -> None:
	print("""the following runtime commands are available:
	\"r\": mark all watched files as dirty / modified (ie force recompile)
	\"l\": list all compiled output files
	\"d\": dump all compiled output files
	\"i\": list info about the devserver, such as hosting ip address(es) and port
	\"h\": list available runtime commands (this text)
	\"s\" or keyboard-interupt (ctrl+c): shutdown server""")


def shutdown_server(your_server: socketserver.BaseServer) -> None:
	print("server threads are being terminated in background")

	def backround_action():
		your_server.shutdown()
		your_server.server_close()
	threading.Thread(target=backround_action, daemon=True).start()


if __name__ == "__main__":
	try:
		myserver = socketserver.TCPServer(("0.0.0.0", PORT), PreprocessedWebServer)
		serverthread = threading.Thread(target=myserver.serve_forever, daemon=True)
		serverthread.start()
		print_hosting_info()
		print_commands_info()
		while True:
			command = input("\ninput any commands here:\n\t")
			if command.lower() == "r":
				PreprocessedWebServer.set_all_dirty()
			elif command.lower() == "l":
				print("\n\t" + "\n\t".join([str(p) for p in PreprocessedWebServer.list_all_output()]))
			elif command.lower() == "d":
				PreprocessedWebServer.delete_all_output()
			elif command.lower() == "i":
				print_hosting_info()
			elif command.lower() == "h":
				print_commands_info()
			elif command.lower() == "s":
				raise KeyboardInterrupt
	except KeyboardInterrupt:
		shutdown_server(myserver)
		# clean up the compiled files. WARNING! potentially dangerous!
		PreprocessedWebServer.delete_all_output()
