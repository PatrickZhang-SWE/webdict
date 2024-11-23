import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;
const dictTableName = 'dicts';
const recordsTableName = 'records';

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

async function addDict(name: string, keywordLanguage: string, recordLanguage: string): Promise<void> {
    db.exec('CREATE TABLE IF NOT EXISTS dicts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, keywordLanguage TEXT, recordLanguage TEXT)');
    await db.run('INSERT INTO dicts (name, keywordLanguage, recordLanguage) VALUES (?, ?, ?)', [name, keywordLanguage, recordLanguage]);
}

async function addUser(db: Database, name: string, email: string): Promise<void> {
    db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
    await db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
}

async function getUser(db: Database, email: string): Promise<any> {
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
}

(async () => {
    db = await initializeDb();
    await createTables(db);
})();
