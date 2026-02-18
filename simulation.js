const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const db = new Database('bank_sampah.db');

const USERS_COUNT = 10;
const DAYS_HISTORY = 20;

const firstNames = ['Budi', 'Siti', 'Rina', 'Joko', 'Dewi', 'Andi', 'Lestari', 'Hendra', 'Maya', 'Doni'];
const lastNames = ['Santoso', 'Rahayu', 'Putri', 'Widodo', 'Sari', 'Kusuma', 'Pratama', 'Saputra', 'Wijaya', 'Hidayat'];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(1);

const runSimulation = async () => {
    console.log('Starting simulation...');

    // Get waste types
    const wasteTypes = db.prepare('SELECT * FROM waste_types').all();
    if (wasteTypes.length === 0) {
        console.error('No waste types found. Please run seed.js first.');
        return;
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    const userIds = [];

    // 1. Create Users
    console.log(`Creating ${USERS_COUNT} users...`);
    const insertUser = db.prepare('INSERT INTO users (name, email, password, phone, role, address) VALUES (?, ?, ?, ?, ?, ?)');

    for (let i = 0; i < USERS_COUNT; i++) {
        const name = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
        const email = `user${i + 1}@test.com`;
        const phone = `081${getRandomInt(10000000, 99999999)}`;
        const address = `Jl. Contoh No. ${getRandomInt(1, 100)}`;

        try {
            const info = insertUser.run(name, email, passwordHash, phone, 'user', address);
            userIds.push(info.lastInsertRowid);
            console.log(`Created user: ${name} (${email})`);
        } catch (e) {
            console.log(`Skipping existing user: ${email}`);
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existing) userIds.push(existing.id);
        }
    }

    // 2. Simulate Transactions over 20 days
    console.log(`Simulating transactions for ${DAYS_HISTORY} days...`);
    const insertTxn = db.prepare(`
        INSERT INTO transactions (user_id, waste_type_id, weight, total_amount, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateUserBalance = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?');

    const today = new Date();

    for (let day = DAYS_HISTORY; day >= 0; day--) {
        const date = new Date(today);
        date.setDate(today.getDate() - day);
        const dateStr = date.toISOString(); // SQLite uses ISO strings for dates usually

        console.log(`Processing Day -${day} (${date.toLocaleDateString()})...`);

        for (const userId of userIds) {
            // 70% chance a user makes a transaction on any given day
            if (Math.random() > 0.3) {
                const waste = getRandomElement(wasteTypes);
                const weight = getRandomFloat(1, 10);
                const totalAmount = Math.ceil(weight * waste.price_per_kg);

                // 80% chance transaction is approved, 10% pending, 10% rejected
                const randStatus = Math.random();
                let status = 'pending';
                if (randStatus < 0.8) status = 'approved';
                else if (randStatus < 0.9) status = 'rejected';

                insertTxn.run(userId, waste.id, weight, totalAmount, status, dateStr);

                if (status === 'approved') {
                    updateUserBalance.run(totalAmount, userId);
                }
            }
        }
    }

    console.log('Simulation completed successfully!');
};

runSimulation();
