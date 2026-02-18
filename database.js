const Database = require('better-sqlite3');
const db = new Database('bank_sampah.db');

// Create Tables
const createTables = () => {
    // Users Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            role TEXT CHECK(role IN ('user', 'admin')) DEFAULT 'user',
            balance INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Waste Types Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS waste_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price_per_kg INTEGER NOT NULL,
            unit TEXT DEFAULT 'kg',
            description TEXT,
            is_active INTEGER DEFAULT 1
        )
    `).run();

    // Transactions Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            waste_type_id INTEGER NOT NULL,
            weight REAL NOT NULL,
            total_amount INTEGER NOT NULL,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(waste_type_id) REFERENCES waste_types(id)
        )
    `).run();

    // Withdrawals Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_holder TEXT NOT NULL,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            rejection_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `).run();

    console.log("Database tables initialized.");
};

createTables();

// Seed initial data (optional)
const seedAdmin = () => {
    const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@bs.com');
    if (!admin) {
        // Password: 'admin' (hashed)
        // Note: In real app use bcrypt.hashSync('admin', 10)
        // Here I'm using a placeholder hash for 'admin' generated previously or rely on register to create first user
        // For simplicity let's just create an admin if not exists, but we need bcrypt for password.
        // I will add a method to server.js or a seed script to handle this properly later. 
        // For now, I'll rely on registration or manual update for admin role.
    }
}

module.exports = db;
