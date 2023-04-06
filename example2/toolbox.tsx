/** @jsxImportSource https://esm.sh/solid-js */
import { Accessor, For, JSXElement, Setter, createEffect, createSignal } from "./deps.ts"

export interface Tool {
	name: string
	state?: any
	execute?: (...args: any[]) => void
	undo?: (...args: any[]) => void
}

export interface ToolGroup {
	name: string
	active?: Accessor<boolean>
	setActive?: Setter<boolean>
	tools: Tool[]
}

const isToolGroup = (obj: any): obj is ToolGroup => {
	return obj.tools !== undefined ? true : false
}

export const Toolbox = (tools: (Tool | ToolGroup)[], config?: { width?: number, top?: number }) => {
	const { width, top } = { width: 48, top: 16, ...config }
	const
		no_tool: Tool = {
			name: "cancel",
			execute: () => { }
		},
		[activeTool, setActiveTool] = createSignal(no_tool),
		[collapseToolbox, setCollapseToolbox] = createSignal(false),
		createToolButton = (tool: Tool): JSXElement => (<button
			type="button"
			class="block w-full bg-zinc-800 text-white cursor-pointer mb-1 p-2.5 border-none hover:bg-zinc-600"
			onClick={() => {
				setActiveTool(tool)
				if (tool.execute) tool.execute()
			}}
		>
			{tool.name}
		</button>),
		createToolGroupButton = (group: ToolGroup, activated = false): JSXElement => {
			const [active, setActive] = createSignal(activated)
			group.active = active
			group.setActive = setActive
			const
				cls1 = "w-full cursor-pointer border-none p-2.5 text-left text-base text-zinc-800 outline-none transition-colors duration-300 ease-[ease] hover:bg-zinc-400",
				cls2 = "overflow-hidden px-2.5 py-0 transition-[max-height] duration-300",
				group_head = (<button
					onClick={() => setActive(!active())}
					classList={{
						[cls1]: true,
						"bg-zinc-400": active(),
						"bg-zinc-300": !active(),
					}}
				>
					{group.name}
					{active}
				</button>),
				group_tools = (<div
					classList={{
						[cls2]: true,
						"max-h-96 ease-in": active(),
						"max-h-0 ease-out": !active(),
					}}
				>
					<For each={group.tools} fallback={<p>no tools</p>}>
						{(tool, i) => createToolButton(tool)}
					</For>
				</div>)
			return (<>
				{group_head}
				{group_tools}
			</>)
		}
	return (<div
		class="fixed min-h-[50vh] z-0 overflow-auto select-none bg-zinc-100 shadow-md transition-right duration-300 ease-[ease]"
		style={{
			width: `${width / 4}rem`,
			top: `${top / 4}rem`,
			right: collapseToolbox() ? `-${width / 4}rem` : "0rem",
		}}
	>
		<button
			class="fixed cursor-pointer border-none p-1 rounded-t-xl text-center text-base -rotate-90 transition-right transition-color duration-300 ease-[ease]"
			classList={{
				"bg-yellow-400": !collapseToolbox(),
				"bg-green-400": collapseToolbox(),
			}}
			style={{
				top: `calc(${top / 4}rem + 25vh)`,
				right: collapseToolbox() ? "-1rem" : `${width / 4 - 1}rem`,
			}}
			onClick={() => setCollapseToolbox(!collapseToolbox())}
		>{collapseToolbox() ? "expand" : "collapse"}</button>

		<For each={tools}>
			{(tool, i) => {
				if (isToolGroup(tool)) return createToolGroupButton(tool)
				return createToolButton(tool)
			}}
		</For>
		{createToolButton(no_tool)}
	</div>)
}

export const ToolboxReact = ({ tools }: { tools: Parameters<typeof Toolbox>[0] }) => Toolbox(tools)
