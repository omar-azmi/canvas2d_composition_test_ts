/** @jsxImportSource https://esm.sh/solid-js */
import { render } from "./deps.ts"
import { Navbar } from "./navbar.tsx"
import { ToolboxReact } from "./toolbox.tsx"

const mytools = [
	{ name: "tool 1" },
	{ name: "tool 2" },
	{
		name: "tool 3",
		tools: [{ name: "sub option 1" }, { name: "sub option 2" }, { name: "sub option 3" }],
	},
	{
		name: "tool 4",
		tools: [{ name: "sub option 1" }],
	},
	{
		name: "tool 5",
		tools: [],
	},
	{ name: "tool 6" },
]

const component = () => {
	return <>
		<Navbar />
		<ToolboxReact tools={mytools} />
		<div id="canvas">
			<img src="../images/242.jpg" />
		</div>
	</>
}

render(component, document.body)

export default component
