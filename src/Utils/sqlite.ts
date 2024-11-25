import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { type DictInfo } from '../common/DictInfo.js';
import type { ParserResultBinary, ParserResultText } from '../common/ParserResult.js';

let db: Database;
const dictTableName = 'dicts';
const recordsTableName = 'records';
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
    const statement = `INSERT INTO ${recordsTableName} (dictId, keyword, record, recordFormat, updateTime, createTime)
                       VALUES (?, ?, ?, ?, ?, ?)`;
    const batch = await db.prepare(statement);
    batch.run('PRAGMA synchronous = OFF');
    for (let i = 0; i < keyRecordPairs.length; i += chunkSize) {
        const slicedKeyRecordPairs = keyRecordPairs.slice(i, i + chunkSize > keyRecordPairs.length? keyRecordPairs.length: i + chunkSize);
        await Promise.all(slicedKeyRecordPairs.map(keyRecordPair => {
            return batch.run(dictInfo.id, keyRecordPair.keyword, keyRecordPair.record, dictInfo.recordFormat, Date.now(), Date.now());
        }));
        await batch.run('COMMIT');
    }
    await batch.finalize();
}

(async () => {
    db = await initializeDb();
    await createTables(db);
})();
