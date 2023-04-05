/** @jsxImportSource https://esm.sh/solid-js */
import { For, createEffect, createSignal } from "https://esm.sh/solid-js?target=es2022"
import { render } from "https://esm.sh/solid-js/web?target=es2022"
import h from "https://esm.sh/solid-js/h?target=es2022"

const React = {
	createElement: h,
	Fragment: h.Fragment
}

const
	canvas = document.createElement("canvas"),
	ctx = canvas.getContext("2d")!,
	width = 240,
	height = 172,
	composition_options: GlobalCompositeOperation[] = [
		"color",
		"color-burn",
		"color-dodge",
		"copy",
		"darken",
		"destination-atop",
		"destination-in",
		"destination-out",
		"destination-over",
		"difference",
		"exclusion",
		"hard-light",
		"hue",
		"lighten",
		"lighter",
		"luminosity",
		"multiply",
		"overlay",
		"saturation",
		"screen",
		"soft-light",
		"source-atop",
		"source-in",
		"source-out",
		"source-over",
		"xor",
	],
	image_options = [
		"./images/srcRect.png",
		"./images/mask_black.png",
		"./images/mask_white.png",
		"./images/mask_black_alpha.png",
		"./images/mask_white_alpha.png"
	]

const
	[getComposition, setComposition] = createSignal(composition_options[0]),
	[getImageBase, setImageBase] = createSignal(image_options[0]),
	[getImageTop, setImageTop] = createSignal(image_options[1])

const composition_dom = (<select
	name="composition"
	onInput={(e) => {
		const value = e.currentTarget.value as GlobalCompositeOperation
		console.log(`set composition to ${value}`)
		setComposition(value)
	}}
>
	<For each={composition_options}>{
		(option) => <option value={option}>{option}</option>
	}</For>
</select>)

const image_base_dom = (<select
	name="base"
	onInput={(e) => {
		const value = e.currentTarget.value as string
		console.log(`set base image to ${value}`)
		setImageBase(value)
	}}
>
	<For each={image_options}>{
		(path) => <option value={path}>{path}</option>
	}</For>
</select>)

const image_top_dom = (<select
	name="top"
	onInput={(e) => {
		const value = e.currentTarget.value as string
		console.log(`set top image to ${value}`)
		setImageTop(value)
	}}
>
	<For each={image_options}>{
		(path) => <option value={path}>{path}</option>
	}</For>
</select>)

const update = async function () {
	canvas.width = width
	canvas.height = height
	const
		composition = getComposition(),
		img_base = new Image(),
		img_top = new Image(),
		base_loaded = new Promise((resolve, reject) => {
			img_base.onload = () => resolve(img_base)
		}),
		top_loaded = new Promise((resolve, reject) => {
			img_top.onload = () => resolve(img_top)
		})
	img_base.src = getImageBase()
	img_top.src = getImageTop()
	await Promise.all([base_loaded, top_loaded])
	ctx.globalCompositeOperation = "copy"
	ctx.clearRect(0, 0, width, height)
	ctx.drawImage(img_base, 0, 0)
	ctx.globalCompositeOperation = composition
	ctx.drawImage(img_top, 0, 0)
}

createEffect(update)

render(() => {
	update()
	return <>
		<span style={{ "width": "min-content", "display": "inline-block", "background-color": "red" }}>
			{canvas}
		</span>
		<span style={{ "width": "min-content", "display": "inline-block" }}>
			<div>
				<label for="base">base image</label><br />
				{image_base_dom}
			</div>
			<div>
				<label for="composition">composition option</label><br />
				{composition_dom}
			</div>
			<div>
				<label for="top">top image</label><br />
				{image_top_dom}
			</div>
		</span>
	</>
}, document.body)
