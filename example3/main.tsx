/** @jsxImportSource https://esm.sh/solid-js */
import { render } from "./deps.ts"

interface ScalarDeque<T extends { width: number }> {
	width: number
	position: number
	items: T[]
	padding: number
}

interface WordCutout {
	/** word number */
	id: number
	/** x-pos in manuscript page */
	x: number
	/** y-pos in manuscript page */
	y: number
	/** width in manuscript page */
	width: number
	/** height in manuscript page */
	height: number
	/** left baseline y-pos as a fraction of `this.height`. defaults to 1/2 if undefined */
	base_y0?: number
	/** right baseline y-pos as a fraction of `this.height`. defaults to `this.base_y0` if undefined */
	base_y1?: number
	/** base64 mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
	mask: string
}

class ScrollerCanvas implements ScalarDeque<WordCutout> {
	position: number
	padding: number

	constructor(public width: number, public items: WordCutout[], config?: { position?: number, padding?: number }) {
		const { position = 0, padding = 0 } = config ?? {}
		this.position = position
		this.padding = padding
	}

	getDX = (d_position: number) => {
		// assume `this.items.length < d_position`
		let
			d_x = 0,
			i = 0
		while (d_position >= 1) {
			d_x += this.items[i].width
			i++
			d_position--
		}
		d_x += this.items[i].width * d_position
		return d_x
	}

	getDPosition = (d_x: number) => {
		let
			d_position = 0,
			i = 0
		while (d_position >= 1) {
			d_x += this.items[i].width
			i++
			d_position--
		}
		d_x += this.items[i].width * d_position
		return d_x
	}
}