/** @jsxImportSource https://esm.sh/solid-js */
import { createSignal } from "./deps.ts"

export const Navbar = () => {
	const
		cls1 = "mx-2.5 my-0",
		cls2 = "text-white no-underline"
	return (<nav class="bg-zinc-800 text-white flex justify-between items-center p-2.5">
		<h1 class="m-0">Ageless Quran</h1>
		<ul class="flex list-none m-0 p-0">
			<li class={cls1}><a href="#" class={cls2}>Home</a></li>
			<li class={cls1}><a href="#" class={cls2}>About</a></li>
			<li class={cls1}><a href="#" class={cls2}>Contact</a></li>
		</ul>
	</nav>)
}
