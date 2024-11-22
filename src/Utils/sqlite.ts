import { Database } from 'sqlite3';

async function initializeDb(): Promise<Database> {
    return new Database('database.db');
}

async function addUser(db: Database, name: string, email: string): Promise<void> {
    await db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
}

async function getUser(db: Database, email: string): Promise<any> {
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
}

// Usage example:
(async () => {
    const db = await initializeDb();
    await addUser(db, 'John Doe', 'john@example.com');
    const user = await getUser(db, 'john@example.com');
    console.log(user);
})();
