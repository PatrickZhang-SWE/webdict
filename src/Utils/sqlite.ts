import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { type DictInfo } from '../common/DictInfo.js';
import type { ParserResultBinary, ParserResultText } from '../common/ParserResult.js';
import { type HunSpellWordInfo } from '../common/HunSpellWordInfo.js';

let db: Database;
const dictTableName = 'dicts';
const recordsTableName = 'records';
const wordsMorphologyTableName = 'wordsMorphology';
const chunkSize = 5000;

async function initializeDb() {
    return await open({
        filename: 'database.db',
        driver: sqlite3.Database
    });
}

async function createTables(db: Database) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS ${dictTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            keywordLanguage TEXT,
            recordLanguage TEXT,
            updateTime INTEGER,
            createTime INTEGER
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS ${recordsTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dictId INTEGER,
            keyword TEXT,
            record TEXT,
            recordFormat INTEGER,
            updateTime INTEGER,
            createTime INTEGER
        )
    `);

    await db.exec(`CREATE TABLE IF NOT EXISTS ${wordsMorphologyTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        morphologicalWord TEXT UNIQUE,
        rootWord TEXT
    ) `);
}

export async function addDict(dictInfo: DictInfo) {
    const { lastID } = await db.run(`INSERT INTO ${dictTableName} (name, keywordLanguage, recordLanguage, updateTime, createTime)
                                     VALUES (?, ?, ?, ?, ?)`, [
        dictInfo.name,
        dictInfo.keywordLanguage,
        dictInfo.recordLanguage,
        Date.now(),
        Date.now(),
    ]);
    return lastID;
}

export async function addRecords(keyRecordPairs: ParserResultText[] | ParserResultBinary[], dictInfo: DictInfo) {
    for (let i = 0; i < keyRecordPairs.length; i += chunkSize) {
        let statement = `INSERT INTO ${recordsTableName} (dictId, keyword, record, recordFormat, updateTime, createTime)
                       VALUES`;
        const slicedKeyRecordPairs = keyRecordPairs.slice(i, i + chunkSize > keyRecordPairs.length ? keyRecordPairs.length : i + chunkSize);
        const params: any = [];
        slicedKeyRecordPairs.forEach((keyRecordPair, index) => {
            index === slicedKeyRecordPairs.length - 1 ? statement += ' (?, ?, ?, ?, ?, ?)' : statement += ' (?, ?, ?, ?, ?, ?),';
            params.push(
                dictInfo.id,
                keyRecordPair.keyword,
                keyRecordPair.record,
                dictInfo.recordFormat,
                Date.now(),
                Date.now(),
            );
        })
        const batch = await db.prepare(statement);
        await batch.run(params);
        await batch.finalize();
    }
}

export async function queryWord(keyword: string) {
    const result = await db.all(`SELECT * FROM ${recordsTableName} WHERE keyword = ?`, [keyword]);
    return result;
}

export async function addMorphology(wordInfo: HunSpellWordInfo) {
    const { word, morph } = wordInfo;
    const length = morph.length;
    for (let i = 0; i < length; i += chunkSize) {
        let statement = `INSERT INTO ${wordsMorphologyTableName} (morphologicalWord, rootWord)
                       VALUES`;
        const slicedMorph = morph.slice(i, i + chunkSize > morph.length ? morph.length : i + chunkSize);
        const params: any = [];
        slicedMorph.forEach((morphWord, index) => {
            index === slicedMorph.length - 1 ? statement += ' (?, ?)' : statement += ' (?, ?),';
            params.push(morphWord, word);
        })
        const batch = await db.prepare(statement);
        await batch.run(params);
        await batch.finalize();
    }
}


(async () => {
    db = await initializeDb();
    await createTables(db);
})();
