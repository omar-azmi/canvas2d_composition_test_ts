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
export interface WordCutout {
	/** unique identifier for the word cutout. array includes information on `surah`, `manuscript`, `word number`, `part number`, `page number` */
	id: WordId
	/** contains meta data of the cutout's source location and orientation */
	info: WordCutoutInfo
	/** blob of mask image that is transparent where the pixels are part of the word's stroke line, and opaque where they're part of the background */
	mask: ImageBlob
}

/** unique identifier for the word cutout. <br>
 * array includes information on `surah`, `manuscript`, `word number`, `part number`, and `page number`
 * see {@link WordUUID} for how this can be encoded to a 52-bit number, and the numberic ranges of each entry
*/
export type WordId = [surah: SurahId, manuscript: ManuscriptId, word: WordNumberId, part: WordPartId, page: WordPageId]

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

const _convertWordIdToBigInt = packBigInt_Factory([12, 4, 16, 12, 8] as const)
export const convertWordIdToUUId: (id: WordId) => WordUUId = (word_arr) => Number(_convertWordIdToBigInt(word_arr))
export const convertWordUUIdToId: (uuid: WordUUId | bigint) => WordId = unpackBigInt_Factory([12, 4, 16, 12, 8] as const)

export type WordCutoutInfo = [
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
]

export interface WordCutoutDBSchema extends DBSchema {
	/** a set of id keys that point to whether a certain word `id` exists or not. <br>
	 * if it does exists, then the key's boolean `value` will tell whether or not the word `id`'s `info` and `mask` are fully available for usage. <br>
	 * if the value turns out to be `false` or the id `key` does not exists, then it would hint that we need to request the server again for the complementary data. <br>
	 * if the server responds with a `delete` command, then this key must be deleted because the sever isn't aware of such a word `id`. <br>
	*/
	id: {
		key: WordUUId
		value: boolean
	}
	info: {
		key: WordUUId
		value: WordCutout["info"]
	}
	mask: {
		key: WordUUId
		value: WordCutout["mask"]
	}
}
//#endregion

//#region MANUSCRIPT PAGE DATABASE TYPES AND UTILITY FUNCTIONS
export interface ManuscriptPage {
	/** unique identifier for a certain manuscript's page. array includes information on `surah`, `manuscript`, and `page number` */
	id: PageId
	/** contains meta data of the page's cropping info and orientation */
	info: ManuscriptPageInfo
	/** blob of manuscript's page's colored image */
	image: ImageBlob
}

/** unique identifier for a certain manuscript's page. <br>
 * array includes information on `surah`, `manuscript`, and `page number`
 * see {@link PageUUId} for how this can be encoded to a 32-bit number, and the numberic ranges of each entry
*/export type PageId = [surah: SurahId, manuscript: ManuscriptId, page: WordPageId]

/** a 32-bit integer composed of the following information, in the order of least significant bit to most significant: <br>
 * - 12-bit {@link WordPageId}
 * - 12-bit {@link ManuscriptId}
 * - 08-bit {@link SurahId}
 * 
 * this 32-bit integer hash can be stored as a 64-bit float (754-IEEE double) without loss in any integer accuracy
*/
export type PageUUId = number

const _convertPageIdToBigInt = packBigInt_Factory([8, 12, 12])
export const convertPageIdToUUId: (id: PageId) => PageUUId = (id) => Number(_convertPageIdToBigInt(id))
export const convertPageUUIdToId: (uuid: PageUUId | bigint) => PageId = unpackBigInt_Factory([12, 12, 8] as const)

export type ManuscriptPageInfo = [
	/** cropping rectangle's top-left x-pos. defaults to `0`, and should stay that way for now */
	x: 0,
	/** cropping rectangle's top-left y-pos. defaults to `0`, and should stay that way for now */
	y: 0,
	/** cropping rectangle width. defaults to the actual image's width, and should stay that way for now */
	width: UInt,
	/** cropping rectangle height. defaults to the actual image's height, and should stay that way for now */
	height: UInt,
	/** left baseline y-pos as a fraction of `this.height`. defaults to 1/2 if undefined */
	baseline_y0: UnitInterval | undefined,
	/** right baseline y-pos as a fraction of `this.height`. defaults to `this.base_y0` if undefined */
	baseline_y1: UnitInterval | undefined,
]


export interface ManuscriptPageDBSchema extends DBSchema {
	/** a set of id keys that point to whether a certain page `id` exists or not. <br>
	 * if it does exists, then the key's boolean `value` will tell whether or not the page `id`'s `info` and `image` are fully available for usage. <br>
	 * if the value turns out to be `false` or the id `key` does not exists, then it would hint that we need to request the server again for the complementary data. <br>
	 * if the server responds with a `delete` command, then this key must be deleted because the sever isn't aware of such a page `id`. <br>
	*/
	id: {
		key: PageUUId
		value: boolean
	}
	info: {
		key: PageUUId
		value: ManuscriptPage["info"]
	}
	image: {
		key: PageUUId
		value: ManuscriptPage["image"]
	}
}
//#endregion

//#region WORDS DATABASE
let wordsDB: IDBPDatabase<WordCutoutDBSchema> | undefined = undefined

const getWordsDB = async (): Promise<NonNullable<typeof wordsDB>> => {
	if (wordsDB === undefined) {
		wordsDB = await openDB<WordCutoutDBSchema>("wordsDB", 1, {
			upgrade: (db) => {
				if (!db.objectStoreNames.contains("id")) db.createObjectStore("id", { autoIncrement: false })
				if (!db.objectStoreNames.contains("info")) db.createObjectStore("info", { autoIncrement: false })
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
	putWord: async (word_data: WordCutout) => {
		const
			db = await getWordsDB(),
			{ id, info, mask } = word_data,
			uuid = convertWordIdToUUId(id)
		return Promise.all([
			db.put("info", info, uuid),
			db.put("mask", mask, uuid),
		])
			.then(() => db.put("id", true, uuid))
			.catch(() => {
				/// TODO: `WordsData.downloadWord(uuid)`
			})
	},

	/** put multiple word info inside of the database in a single transaction (quicker). <br>
	 * see {@link WordsData.putWord} for putting a single word info
	 * @returns a database promise that resolves when writing to the database is successful
	*/
	putWords: async (...words: Array<WordCutout>) => {
		const
			db = await getWordsDB(),
			tx = db.transaction(["id", "info", "mask"], "readwrite"),
			id_st = tx.objectStore("id"),
			info_st = tx.objectStore("info"),
			mask_st = tx.objectStore("mask")
		for (const { id, info, mask } of words) {
			const uuid = convertWordIdToUUId(id)
			Promise.all([
				info_st.put(info, uuid),
				mask_st.put(mask, uuid),
			])
				.then(() => id_st.put(true, uuid))
				.catch(() => {
					/// TODO: `WordsData.downloadWord(uuid)`
				})
		}
		return tx.done
	},

	getWord: async (id: WordId): Promise<WordCutout | undefined> => {
		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(id),
			[id_exists, info, mask] = await Promise.all([
				db.get("id", uuid),
				db.get("info", uuid),
				db.get("mask", uuid)
			])
		if (!id_exists || info === undefined || mask === undefined) return undefined
		return { id, info, mask }
	},

	getWordRange: async function* (
		surah: SurahId,
		manuscripts: ManuscriptId[],
		word_range: [start: WordNumberId, end: WordNumberId]
	): AsyncGenerator<
		(WordCutout | WordCutout[] | undefined)[] & { length: (typeof manuscripts)["length"] },
		undefined,
		undefined
	> {
		/// TODO: WIP
		const
			db = await getWordsDB(),
			tx = db.transaction(["id", "info", "mask"], "readonly"),
			id_st = tx.objectStore("id"),
			info_st = tx.objectStore("info"),
			mask_st = tx.objectStore("mask")

		yield Array(manuscripts.length).fill(undefined)

		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(id),
			[id_exists, info, mask] = await Promise.all([
				db.get("id", uuid),
				db.get("info", uuid),
				db.get("mask", uuid)
			])
		if (!id_exists || info === undefined || mask === undefined) return undefined
		return { id, info, mask }
	}
}
//#endregion

