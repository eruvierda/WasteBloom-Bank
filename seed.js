const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const db = new Database('bank_sampah.db');

const seed = async () => {
    console.log('Seeding database...');

    // Seed Waste Types
    const wasteTypes = [
        { name: 'Plastik', category: 'Plastik', price: 3000, unit: 'kg', description: 'Botol plastik bersih, gelas plastik' },
        { name: 'Kertas / Kardus', category: 'Kertas', price: 2000, unit: 'kg', description: 'Koran, majalah, kardus bekas' },
        { name: 'Besi / Logam', category: 'Logam', price: 5000, unit: 'kg', description: 'Besi tua, kaleng aluminium' },
        { name: 'Kaca / Beling', category: 'Kaca', price: 1000, unit: 'kg', description: 'Botol sirup, kecap, kaca jendela' }
    ];

    const insertWaste = db.prepare('INSERT INTO waste_types (name, category, price_per_kg, unit, description) VALUES (?, ?, ?, ?, ?)');
    const checkWaste = db.prepare('SELECT * FROM waste_types WHERE name = ?');

    for (const type of wasteTypes) {
        if (!checkWaste.get(type.name)) {
            insertWaste.run(type.name, type.category, type.price, type.unit, type.description);
            console.log(`Inserted waste type: ${type.name}`);
        } else {
            console.log(`Waste type ${type.name} already exists.`);
        }
    }

    // Seed Admin User
    const adminEmail = 'admin@bs.com';
    const checkAdmin = db.prepare('SELECT * FROM users WHERE email = ?');

    if (!checkAdmin.get(adminEmail)) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.prepare(`
            INSERT INTO users (name, email, password, phone, role, address) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('Administrator', adminEmail, hashedPassword, '081234567890', 'admin', 'Kantor Pusat');
        console.log('Inserted admin user: admin@bs.com / admin123');
    } else {
        console.log('Admin user already exists.');
    }

    console.log('Seeding completed.');
};

seed();
