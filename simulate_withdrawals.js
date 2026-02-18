const Database = require('better-sqlite3');
const db = new Database('bank_sampah.db');

const banks = ['BCA', 'BRI', 'Mandiri', 'BNI', 'CIMB Niaga', 'Jago', 'Dana', 'OVO', 'GoPay'];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const runSimulation = () => {
    console.log('Simulating withdrawals...');

    const users = db.prepare("SELECT * FROM users WHERE role = 'user'").all();
    const insertWithdrawal = db.prepare(`
        INSERT INTO withdrawals (user_id, amount, bank_name, account_number, account_holder, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // We need to be careful not to drain balance below 0 if we assume they were approved in the past.
    // For simplicity, let's assume these withdrawals happened and the CURRENT balance reflects them (or we adjust it).
    // Actually, the easiest way is to just create records and NOT touch current balance, assuming current balance is what remains.
    // OR we can add "approved" withdrawals and DEDUCT from current balance if we want to simulate "spending".
    // Let's go with: Generate withdrawal history that matches "past activity". 
    // If status is 'approved', we assume it was already deducted.

    const today = new Date();

    for (const user of users) {
        // 50% chance a user has withdrawal history
        if (Math.random() > 0.5) {
            const numWithdrawals = getRandomInt(1, 5);

            for (let i = 0; i < numWithdrawals; i++) {
                const daysAgo = getRandomInt(1, 20);
                const date = new Date(today);
                date.setDate(today.getDate() - daysAgo);

                const amount = getRandomInt(1, 10) * 10000; // 10k to 100k
                const bank = getRandomElement(banks);
                const accNum = `${getRandomInt(1000000000, 9999999999)}`;

                const randStatus = Math.random();
                let status = 'approved';
                if (randStatus > 0.8) status = 'pending';
                else if (randStatus > 0.95) status = 'rejected';

                insertWithdrawal.run(user.id, amount, bank, accNum, user.name, status, date.toISOString());
                console.log(`Created withdrawal for ${user.name}: Rp ${amount} (${status})`);
            }
        }
    }

    console.log('Withdrawal simulation completed.');
};

runSimulation();
