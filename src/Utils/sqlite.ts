import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { type DictInfo } from '../common/DictInfo.js';
import type { ParserResultBinary, ParserResultText } from '../common/ParserResult.js';
import { type HunSpellWordInfo } from '../common/HunSpellWordInfo.js';
import exp from 'constants';

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
        morphologicalWord TEXT,
        rootWord TEXT,
        updateTime INTEGER,
        createTime INTEGER
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
    const rootWords = await db.all(`SELECT rootWord FROM ${wordsMorphologyTableName} WHERE morphologicalWord = ?`, [keyword]);
    const morphs = rootWords.map((item) => item.rootWord);
    const result = await db.all(`SELECT keyword, record FROM ${recordsTableName} WHERE dictId = ? AND keyword IN (${morphs.map((_, index) => '?').join(',')})`, [1, ...morphs]);
    return result;
}

export async function addMorphologies(morphologies: HunSpellWordInfo[]) {
    for (let i = 0; i < morphologies.length; i += chunkSize) {
        let statement = `INSERT INTO ${wordsMorphologyTableName} (morphologicalWord, rootWord, updateTime, createTime)
                       VALUES`;
        const slicedMorphologies = morphologies.slice(i, i + chunkSize > morphologies.length ? morphologies.length : i + chunkSize);
        const params: any = [];
        slicedMorphologies.forEach((morphology, index) => {
            index === slicedMorphologies.length - 1 ? statement += ' (?, ?, ?, ?)' : statement += ' (?, ?, ?, ?),';
            params.push(
                morphology.morph,
                morphology.word,
                Date.now(),
                Date.now(),
            );
        })
        const batch = await db.prepare(statement);
        await batch.run(params);
        await batch.finalize();
    }
}


export async function addMorphology(rootWord: string, morph: string) {
    const { lastID } = await db.run(`INSERT INTO ${wordsMorphologyTableName} (morphologicalWord, rootWord)
                                     VALUES (?, ?)`, [
        morph,
        rootWord
    ]);
    return lastID;
}


(async () => {
    db = await initializeDb();
    await createTables(db);
})();
