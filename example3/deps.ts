/** @jsxImportSource https://esm.sh/solid-js */
/// <reference types="npm:solid-js" />
/// <reference types="npm:solid-js/web" />
export { popupCanvas } from "https://deno.land/x/kitchensink_ts@v0.6.0/devdebug.ts"
export type { ImageBlob } from "https://deno.land/x/kitchensink_ts@v0.6.0/image.ts"
export { getBGCanvas, getBGCtx } from "https://deno.land/x/kitchensink_ts@v0.6.0/mod.ts"
export type { UnitInterval } from "https://deno.land/x/kitchensink_ts@v0.6.0/typedefs.ts"
export { deleteDB, openDB, unwrap, wrap } from "https://esm.sh/idb"
export type { DBSchema, IDBPDatabase } from "https://esm.sh/idb"
export * from "solid-js"
export { render } from "solid-js/web"

/** a factory function to generate a function that: <br>
 * unpacks a single `BigInt` (64-bit) to an array of numbers <br>
 * see {@link packBigInt_Factory} for the reverse operation
 * @example
 * ```ts
 * // create a decoder for 36-bit data (big endian representation): 0b0000000000000000000000000000xxxxxxxxxxxxyyyyyyyyyyyyzzzzzzzzwwww
 * // to the vector: `[x: 12_bit_uint, y: 12_bit_uint, z: 8_bit_uint, w: 4_bit_uint]`
 * type Vec4 = [x: number, y: number, z: number, w: number]
 * const myVec4Decoder = unpackBigInt_Factory<Vec4, bigint>([4, 8, 12, 12] as const)
 * const vec4_encoded = 0b0000000000000000000000000000000001100100101110111000111010011111
 * // equivalent to   : 0b0000000000000000000000000000xxxxxxxxxxxxyyyyyyyyyyyyzzzzzzzzwwww
 * console.log(myVec4Decoder(vec4_encoded)) // "[100, 3000, 233, 15]"
 * ```
 * @param bit_sizes specify the bits occupied by each element (of `UnpackedType` array of number type), starting with the least significant bit
*/
export const unpackBigInt_Factory = <
	UnpackedType extends Array<number> = Array<number>,
	PackedType extends (number | bigint) = (number | bigint),
>(bit_sizes: readonly (number | bigint)[] & { length: UnpackedType["length"] }) => {
	const split_bits_bigint: Array<bigint> & { length: UnpackedType["length"] } = bit_sizes.map(BigInt)

	return (packed_value: PackedType): UnpackedType => {
		let packed_value_bigint = BigInt(packed_value)
		const unpacked_value: number[] = []
		for (const bits of split_bits_bigint) {
			// we are basically converting an integer `bits` to the same number of `0b1`s as least significant bits. so for instance, `8` becomes the mask `0b11111111`
			const bit_mask = (1n << bits) - 1n
			unpacked_value.push(Number(packed_value_bigint & bit_mask))
			packed_value_bigint >>= bits
		}
		return unpacked_value.reverse() as UnpackedType
	}
}

/** a factory function to generate a function that: <br>
 * packs an array of numbers to a single `BigInt` (64-bit) <br>
 * see {@link unpackBigInt_Factory} for the reverse operation
 * @example
 * ```ts
 * // create an encoder for 36-bit data `[x: 12_bit_uint, y: 12_bit_uint, z: 8_bit_uint, w: 4_bit_uint]`
 * // such that it is stored as (big endian representation):
 * // 0b0000000000000000000000000000xxxxxxxxxxxxyyyyyyyyyyyyzzzzzzzzwwww
 * type Vec4 = [x: number, y: number, z: number, w: number]
 * const myVec4Encoder = packBigInt_Factory<Vec4, bigint>([4, 8, 12, 12] as const)
 * console.log("0b" + myVec4Encoder([100, 3000, 233, 15]).toString(2).padStart(64, "0"))
 * // prints       : "0b0000000000000000000000000000000001100100101110111000111010011111"
 * // equivalent to: "0b0000000000000000000000000000xxxxxxxxxxxxyyyyyyyyyyyyzzzzzzzzwwww"
 * ```
 * @param bit_sizes specify the bits occupied by each element (of `UnpackedType` array of number type), starting with the least significant bit
*/
export const packBigInt_Factory = <
	UnpackedType extends Array<number> = Array<number>,
	PackedType extends bigint = bigint,
>(bit_sizes: readonly (number | bigint)[] & { length: UnpackedType["length"] }) => {
	const bit_sizes_bigint: Array<bigint> & { length: UnpackedType["length"] } = bit_sizes.map(BigInt).reverse()

	return (unpacked_value: UnpackedType): PackedType => {
		let value = 0n
		const len = unpacked_value.length
		for (let i = 0; i < len; i++) {
			value <<= bit_sizes_bigint[i]
			value += BigInt(unpacked_value[i])
		}
		return value as PackedType
	}
}

