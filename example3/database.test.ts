import { IDBPDatabase, ImageBlob, openDB } from "./deps.ts"
import { convertWordIdToUUId, convertWordUUIdToId, WordCutoutDBMeta, WordCutoutDB, WordId, WordCutout } from "./database.ts"

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
	putWord: async (uuid_arr: WordId, info: WordCutoutDBMeta, mask: ImageBlob) => {
		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(uuid_arr)
		return Promise.all([
			db.put("meta", info, uuid),
			db.put("mask", mask, uuid),
		])
	},

	/** put multiple word info inside of the database in a single transaction (quicker). <br>
	 * see {@link WordsData.putWord} for putting a single word info
	 * @returns a database promise that resolves when writing to the database is successful
	*/
	putWords: async (...words: Array<[uuid_arr: WordId, info: WordCutoutDBMeta, mask: ImageBlob]>) => {
		const
			db = await getWordsDB(),
			tx = db.transaction(["meta", "mask"], "readwrite"),
			meta_st = tx.objectStore("meta"),
			mask_st = tx.objectStore("mask")
		for (const [uuid_arr, info, mask] of words) {
			const uuid = convertWordIdToUUId(uuid_arr)
			meta_st.put(info, uuid)
			mask_st.put(mask, uuid)
		}
		return tx.done
	},

	getWord: async (uuid_arr: WordId): Promise<WordCutout | undefined> => {
		const
			db = await getWordsDB(),
			uuid = convertWordIdToUUId(uuid_arr),
			info = await db.get("meta", uuid),
			mask = await db.get("mask", uuid)
		if (info === undefined || mask === undefined) return undefined
		info.push(mask as unknown as number)
		return info as unknown as WordCutout
	}
}


