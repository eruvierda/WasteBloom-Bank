const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Custom Middleware for User
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.path = req.path;
    next();
});

// Routes
// AUTH
app.get('/login', (req, res) => res.render('pages/login'));
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        if (user.role === 'admin') return res.redirect('/admin/dashboard');
        return res.redirect('/dashboard');
    }
    res.render('pages/login', { error: 'Invalid email or password' });
});

app.get('/register', (req, res) => res.render('pages/register'));
app.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(name, email, hashedPassword, phone, 'user');
        req.session.user = { id: info.lastInsertRowid, name, email, role: 'user' };
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('pages/register', { error: 'Email already exists' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    res.render('pages/profile', { user });
});

// USER ROUTES
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    // Fetch recent transactions
    const transactions = db.prepare(`
        SELECT t.*, w.name as waste_name, w.unit 
        FROM transactions t 
        JOIN waste_types w ON t.waste_type_id = w.id 
        WHERE t.user_id = ? 
        ORDER BY t.created_at DESC 
        LIMIT 5
    `).all(req.session.user.id);

    // Calculate totals
    const totalWeight = db.prepare('SELECT SUM(weight) as total FROM transactions WHERE user_id = ? AND status = ?').get(req.session.user.id, 'approved').total || 0;
    const totalItems = transactions.length; // Simplified for now

    // Refresh user balance from DB
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    req.session.user = user; // Update session

    res.render('pages/dashboard', { transactions, totalWeight, totalItems });
});

app.get('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const wasteTypes = db.prepare('SELECT * FROM waste_types WHERE is_active = 1').all();
    res.render('pages/deposit', { wasteTypes });
});

app.post('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { waste_type_id, weight, notes } = req.body;

    try {
        const wasteType = db.prepare('SELECT * FROM waste_types WHERE id = ?').get(waste_type_id);
        if (!wasteType) throw new Error('Invalid waste type');

        const total_amount = wasteType.price_per_kg * parseFloat(weight);

        db.prepare(`
            INSERT INTO transactions (user_id, waste_type_id, weight, total_amount, notes, status) 
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(req.session.user.id, waste_type_id, weight, total_amount, notes);

        const wasteTypes = db.prepare('SELECT * FROM waste_types WHERE is_active = 1').all();
        res.render('pages/deposit', { wasteTypes, success: 'Setoran berhasil disubmit! Menunggu konfirmasi admin.' });
    } catch (err) {
        console.error(err);
        const wasteTypes = db.prepare('SELECT * FROM waste_types WHERE is_active = 1').all();
        res.render('pages/deposit', { wasteTypes, error: 'Gagal memproses setoran.' });
    }
});

// Transactions Route
app.get('/transactions', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const transactions = db.prepare(`
        SELECT t.*, w.name as waste_name, w.unit 
        FROM transactions t 
        JOIN waste_types w ON t.waste_type_id = w.id 
        WHERE t.user_id = ? 
        ORDER BY t.created_at DESC
    `).all(req.session.user.id);
    res.render('pages/transactions', { transactions });
});

// Withdraw Routes
app.get('/withdraw', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
    // Refresh balance
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    req.session.user = user;
    res.render('pages/withdraw', { withdrawals });
});

app.post('/withdraw', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, bank_name, account_number, account_holder } = req.body;
    const withdrawAmount = parseInt(amount);

    // Check balance
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

    if (user.balance < withdrawAmount) {
        const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
        return res.render('pages/withdraw', { withdrawals, error: 'Saldo tidak mencukupi.' });
    }

    // Check pending withdrawals? (Optional, let's allow multiple for now or just standard check)
    // Actually standard rule is usually one pending, but let's be flexible.

    try {
        db.prepare(`
            INSERT INTO withdrawals (user_id, amount, bank_name, account_number, account_holder, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(user.id, withdrawAmount, bank_name, account_number, account_holder);

        // Deduct balance immediately? Or wait for approval?
        // Plan says: "Admin approves -> Balance -= amount". 
        // BUT usually we lock the funds or deduct immediately to prevent double spend.
        // Let's deduct immediately for safety, and refund if rejected.
        // Wait, the plan says: "Approve? Yes -> Balance -= amount".
        // This allows user to withdraw more than they have if they spam requests.
        // I will deduct immediately (pending state) OR check balance at approval time.
        // Checking at approval time is risky if real-time.
        // Better: Deduct immediately.

        // db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(withdrawAmount, user.id);
        // req.session.user.balance -= withdrawAmount;

        // Actually, let's stick to the plan: "Approve -> Balance -= amount".
        // I will just validate sufficient funds now.

        const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
        res.render('pages/withdraw', { withdrawals, success: 'Permintaan penarikan berhasil dikirim.' });

    } catch (err) {
        console.error(err);
        const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
        res.render('pages/withdraw', { withdrawals, error: 'Gagal memproses permintaan.' });
    }
});

// ADMIN ROUTES
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');

    const stats = {
        totalUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('user').count,
        totalWeight: db.prepare('SELECT SUM(weight) as total FROM transactions WHERE status = ?').get('approved').total || 0,
        pendingTransactions: db.prepare('SELECT COUNT(*) as count FROM transactions WHERE status = ?').get('pending').count,
        pendingWithdrawals: db.prepare('SELECT COUNT(*) as count FROM withdrawals WHERE status = ?').get('pending').count
    };

    const pendingTxns = db.prepare(`
        SELECT t.*, u.name as user_name, w.name as waste_name, w.unit 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        JOIN waste_types w ON t.waste_type_id = w.id 
        WHERE t.status = 'pending' 
        LIMIT 5
    `).all();

    const pendingWithdrawals = db.prepare(`
        SELECT w.*, u.name as user_name 
        FROM withdrawals w 
        JOIN users u ON w.user_id = u.id 
        WHERE w.status = 'pending' 
        LIMIT 5
    `).all();

    res.render('pages/admin/dashboard', { stats, pendingTxns, pendingWithdrawals });
});

app.post('/admin/transactions/approve', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id } = req.body;

    try {
        const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!txn) throw new Error('Transaction not found');

        // Update transaction status
        db.prepare("UPDATE transactions SET status = 'approved' WHERE id = ?").run(id);

        // Add balance to user
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(txn.total_amount, txn.user_id);

        res.redirect('/admin/dashboard'); // Or back to transactions list
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard?error=failed');
    }
});

app.post('/admin/withdrawals/approve', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id } = req.body;

    try {
        const wd = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
        if (!wd) throw new Error('Withdrawal not found');

        // Deduct balance from user
        // Wait, did I deduct on request? "I will just validate sufficient funds now."
        // So I did NOT deduct on request. I need to deduct NOW.
        // Check balance again to be sure.
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(wd.user_id);
        if (user.balance < wd.amount) {
            // Reject withdrawal if balance insufficient now
            db.prepare('UPDATE withdrawals SET status = "rejected", rejection_reason = "Insufficient funds at approval time" WHERE id = ?').run(id);
            return res.redirect('/admin/dashboard?error=insufficient_funds');
        }

        db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(wd.amount, wd.user_id);
        db.prepare('UPDATE withdrawals SET status = "approved" WHERE id = ?').run(id);

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard?error=failed');
    }
});


// WASTE MANAGEMENT ROUTES
app.get('/admin/waste-types', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const wasteTypes = db.prepare('SELECT * FROM waste_types ORDER BY category, name').all();
    res.render('pages/admin/waste_types', { wasteTypes });
});

app.post('/admin/waste-types/add', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { name, category, price_per_kg, unit, description } = req.body;
    db.prepare('INSERT INTO waste_types (name, category, price_per_kg, unit, description) VALUES (?, ?, ?, ?, ?)').run(name, category, price_per_kg, unit, description);
    res.redirect('/admin/waste-types');
});

app.post('/admin/waste-types/edit', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id, name, category, price_per_kg, unit, description } = req.body;
    db.prepare('UPDATE waste_types SET name = ?, category = ?, price_per_kg = ?, unit = ?, description = ? WHERE id = ?').run(name, category, price_per_kg, unit, description, id);
    res.redirect('/admin/waste-types');
});

app.post('/admin/waste-types/toggle', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id } = req.body;
    const current = db.prepare('SELECT is_active FROM waste_types WHERE id = ?').get(id);
    db.prepare('UPDATE waste_types SET is_active = ? WHERE id = ?').run(current.is_active ? 0 : 1, id);
    res.redirect('/admin/waste-types');
});

// USER MANAGEMENT ROUTES
app.get('/admin/users', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    res.render('pages/admin/users', { users });
});

app.get('/admin/users/:id', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.redirect('/admin/users');

    const transactions = db.prepare(`
        SELECT t.*, w.name as waste_name, w.unit 
        FROM transactions t 
        JOIN waste_types w ON t.waste_type_id = w.id 
        WHERE t.user_id = ? 
        ORDER BY t.created_at DESC
    `).all(user.id);

    const withdrawals = db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(user.id);

    res.render('pages/admin/user_detail', { user, transactions, withdrawals });
});

app.post('/admin/users/edit', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id, name, email, phone, address } = req.body;

    try {
        db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
            .run(name, email, phone, address, id);
        res.redirect('/admin/users/' + id);
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users/' + id + '?error=failed');
    }
});


// ADMIN HISTORY ROUTES
app.get('/admin/transactions', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { status } = req.query;
    let transactions;
    if (status) {
        transactions = db.prepare(`
            SELECT t.*, u.name as user_name, w.name as waste_name, w.unit 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            JOIN waste_types w ON t.waste_type_id = w.id 
            WHERE t.status = ?
            ORDER BY t.created_at DESC
        `).all(status);
    } else {
        transactions = db.prepare(`
            SELECT t.*, u.name as user_name, w.name as waste_name, w.unit 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            JOIN waste_types w ON t.waste_type_id = w.id 
            ORDER BY t.created_at DESC
        `).all();
    }
    res.render('pages/admin/transactions', { transactions });
});

app.post('/admin/transactions/reject', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id } = req.body;
    db.prepare("UPDATE transactions SET status = 'rejected' WHERE id = ?").run(id);
    res.redirect('back');
});

app.post('/admin/transactions/edit', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id, weight } = req.body;

    try {
        const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!txn) throw new Error('Transaction not found');

        const wasteType = db.prepare('SELECT * FROM waste_types WHERE id = ?').get(txn.waste_type_id);
        const newTotal = wasteType.price_per_kg * parseFloat(weight);

        db.prepare('UPDATE transactions SET weight = ?, total_amount = ? WHERE id = ?')
            .run(weight, newTotal, id);

        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/transactions?error=edit_failed');
    }
});

app.get('/admin/withdrawals', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { status } = req.query;
    let withdrawals;
    if (status) {
        withdrawals = db.prepare(`
            SELECT w.*, u.name as user_name 
            FROM withdrawals w 
            JOIN users u ON w.user_id = u.id 
            WHERE w.status = ?
            ORDER BY w.created_at DESC
        `).all(status);
    } else {
        withdrawals = db.prepare(`
            SELECT w.*, u.name as user_name 
            FROM withdrawals w 
            JOIN users u ON w.user_id = u.id 
            ORDER BY w.created_at DESC
        `).all();
    }

    res.render('pages/admin/withdrawals', { withdrawals });
});

app.post('/admin/withdrawals/reject', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const { id } = req.body;
    db.prepare("UPDATE withdrawals SET status = 'rejected' WHERE id = ?").run(id);
    res.redirect('back');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
