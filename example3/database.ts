import { DBSchema, IDBPDatabase, ImageBlob, UnitInterval, openDB, packBigInt_Factory, unpackBigInt_Factory } from "./deps.ts"

//#region NUMERIC TYPES
type UInt = number

/** 08-bit surah number. <br>
 * `1` is for Al-Fatiha, `2` is for Al-Baqarah, etc... <br>
 * avoid using `0` for good measures
*/
export type SurahId = UInt

/** 12-bit manuscript id. <br>
 * `0` is for mushaf madinah, `1` is for its skeleton version, <br>
 * and `2` to `10` are currently reserved for good measures. so start labeling from `11`
*/
export type ManuscriptId = UInt

/** 16-bit word number. <br>
 * starts with `1` for the first word, because `0` is refered to as the background throught the app, <br>
 * even if it does not impact the database directly
*/
export type WordNumberId = UInt

/** 04-bit word part number. <br>
 * essential because some words are split in the middle due to a line break. <br>
 * usually `0b0000`
*/
export type WordPartId = UInt

/** 12-bit manuscript page number where the word resides, with respect to the first page of the surah. <br>
 * `0` is for the first page of any surah
*/
export type WordPageId = UInt
//#endregion

//#region WORD CUTOUT DATABASE TYPES AND UTILITY FUNCTIONS
/** a 52-bit integer composed of the following information, in the order of least significant bit to most significant: <br>
 * - 12-bit {@link WordPageId}
 * - 04-bit {@link WordPartId}
 * - 16-bit {@link WordNumberId}
 * - 12-bit {@link ManuscriptId}
 * - 08-bit {@link SurahId}
 * 
 * this 52-bit integer hash can be stored as a 64-bit float (754-IEEE double) without loss in any integer accuracy
*/
export type WordUUId = number

export type WordId = [surah: SurahId, manuscript: ManuscriptId, word: WordNumberId, part: WordPartId, page: WordPageId]

const _convertWordIdToBigInt = packBigInt_Factory([12, 4, 16, 12, 8] as const)
export const convertWordIdToUUId: (id: WordId) => WordUUId = (word_arr) => Number(_convertWordIdToBigInt(word_arr))
export const convertWordUUIdToId: (uuid: WordUUId | bigint) => WordId = unpackBigInt_Factory([12, 4, 16, 12, 8] as const)

export interface WordCutoutTEMP {
	id: WordId
	info: WordCutoutDBMeta
	mask: ImageBlob
}

export interface WordCutoutObject {
	/** x-pos in manuscript page */
	x: UInt,
	/** y-pos in manuscript page */
	y: UInt,
	/** width in manuscript page */
	width: UInt,
	/** height in manuscript page */
	height: UInt,
	/** left baseline y-pos as a fraction of `this.height`. defaults to 1/2 if undefined */
	baseline_y0?: UnitInterval,
	/** right baseline y-pos as a fraction of `this.height`. defaults to `this.base_y0` if undefined */
	baseline_y1?: UnitInterval,
	/** blob of mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
	mask: ImageBlob,
}

export type WordCutout = [
	/** x-pos in manuscript page */
	x: UInt,
	/** y-pos in manuscript page */
	y: UInt,
	/** width in manuscript page */
	width: UInt,
	/** height in manuscript page */
	height: UInt,
	/** left baseline y-pos as a fraction of `this.height`. defaults to 1/2 if undefined */
	baseline_y0: UnitInterval | undefined,
	/** right baseline y-pos as a fraction of `this.height`. defaults to `this.base_y0` if undefined */
	baseline_y1: UnitInterval | undefined,
	/** blob of mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
	mask: ImageBlob,
]

export type WordCutoutDBMeta = [
	/** x-pos in manuscript page */
	x: UInt,
	/** y-pos in manuscript page */
	y: UInt,
	/** width in manuscript page */
	width: UInt,
	/** height in manuscript page */
	height: UInt,
	/** left baseline y-pos as a fraction of `this.height`. defaults to 1/2 if undefined */
	baseline_y0?: UnitInterval,
	/** right baseline y-pos as a fraction of `this.height`. defaults to `this.base_y0` if undefined */
	baseline_y1?: UnitInterval,
]

export interface WordCutoutDB extends DBSchema {
	meta: {
		key: WordUUId
		value: WordCutoutDBMeta
	}
	mask: {
		key: WordUUId
		/** blob of mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
		value: ImageBlob
	}
}
//#endregion

//#region MANUSCRIPT PAGE DATABASE TYPES AND UTILITY FUNCTIONS
/** a 32-bit integer composed of the following information, in the order of least significant bit to most significant: <br>
 * - 12-bit {@link WordPageId}
 * - 12-bit {@link ManuscriptId}
 * - 08-bit {@link SurahId}
 * 
 * this 32-bit integer hash can be stored as a 64-bit float (754-IEEE double) without loss in any integer accuracy
*/
export type PageUUId = number

export type PageId = [surah: SurahId, manuscript: ManuscriptId, page: WordPageId]

export interface ManuscriptDB extends DBSchema {
	page: {
		key: PageUUId
		/** base64 mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
		value: ImageBlob
	}
}

const _convertPageIdToBigInt = packBigInt_Factory([8, 12, 12])
export const convertPageIdToUUId: (id: PageId) => PageUUId = (id) => Number(_convertPageIdToBigInt(id))
export const convertPageUUIdToId: (uuid: PageUUId | bigint) => PageId = unpackBigInt_Factory([12, 12, 8] as const)
//#endregion

//#region WORDS DATABASE
let wordsDB: IDBPDatabase<WordCutoutDB> | undefined = undefined

const getWordsDB = async (): Promise<IDBPDatabase<WordCutoutDB>> => {
	if (wordsDB === undefined) {
		wordsDB = await openDB<WordCutoutDB>("wordsDB", 1, {
			upgrade: (db) => {
				if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { autoIncrement: false })
				if (!db.objectStoreNames.contains("mask")) db.createObjectStore("mask", { autoIncrement: false })
			},
		})
	}
	return wordsDB
}

export const WordsData = {
	/** put a word info inside of the database. <br>
	 * `put` is different from `add` in that putting a data either update's an existing key or adds the new missing key, <br>
	 * whereas adding implies adding only new (non-existing) keys. <br>
	 * if you were to `add` an existing key, then an error will be thrown
	 * @returns a database promise that resolves when writing to the database is successful
	*/
	putWord: async (id: WordId, word_data: WordCutout) => {
		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(id),
			mask = word_data.at(-1) as ImageBlob,
			info = word_data.slice(0, -1) as WordCutoutDBMeta
		return Promise.all([
			db.put("meta", info, uuid),
			db.put("mask", mask, uuid),
		])
	},

	/** put multiple word info inside of the database in a single transaction (quicker). <br>
	 * see {@link WordsData.putWord} for putting a single word info
	 * @returns a database promise that resolves when writing to the database is successful
	*/
	putWords: async (...words: Array<[id: WordId, word_data: WordCutout]>) => {
		const
			db = await getWordsDB(),
			tx = db.transaction(["meta", "mask"], "readwrite"),
			meta_st = tx.objectStore("meta"),
			mask_st = tx.objectStore("mask")
		for (const [id, word_data] of words) {
			const
				uuid = convertWordIdToUUId(id),
				mask = word_data.at(-1) as ImageBlob,
				info = word_data.slice(0, -1) as WordCutoutDBMeta
			meta_st.put(info, uuid)
			mask_st.put(mask, uuid)
		}
		return tx.done
	},

	getWord: async (id: WordId): Promise<WordCutout | undefined> => {
		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(id),
			info = await db.get("meta", uuid),
			mask = await db.get("mask", uuid)
		if (info === undefined || mask === undefined) return undefined
		info.push(mask as unknown as number)
		return info as unknown as WordCutout
	}
}
//#endregion

