const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

if (!process.env.JWT_SECRET) { console.error('❌ FATAL: JWT_SECRET not set'); process.exit(1); }

const pool = new Pool({
    user: process.env.PG_USER, host: process.env.PG_HOST,
    database: process.env.PG_DB, password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
pool.on('connect', () => console.log('✅ DB connected'));
pool.on('error', (err) => console.error('❌ DB error:', err));

async function runQuery(query, params = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(query, params);
        await client.query('COMMIT');
        return result;
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
}

// Auth helpers
function getTokenUser(req) {
    try {
        const h = req.headers['authorization'];
        if (!h) return null;
        return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    } catch { return null; }
}
function requireAdmin(req, res) {
    const u = getTokenUser(req);
    if (!u) { res.status(401).json({ error: 'Not authenticated' }); return null; }
    if (u.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return null; }
    return u;
}

async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log('📄 Initialising tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'player',
                score INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                category_id INT REFERENCES categories(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                complexity VARCHAR(20) NOT NULL,
                disabled BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS pending_questions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                submitted_by_email VARCHAR(255) DEFAULT 'anonymous',
                category_name VARCHAR(100) NOT NULL,
                text TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                complexity VARCHAR(20) NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'pending'
            );
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                question_id INT REFERENCES questions(id),
                selected_answer CHAR(1),
                is_correct BOOLEAN
            );
            CREATE TABLE IF NOT EXISTS question_reports (
                id SERIAL PRIMARY KEY,
                question_id INT REFERENCES questions(id) ON DELETE CASCADE,
                reason TEXT,
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Safe migrations for existing databases
        const migrations = [
            `ALTER TABLE questions ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE pending_questions ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255) DEFAULT 'anonymous'`,
            `ALTER TABLE question_reports ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
        ];
        for (const m of migrations) {
            try { await client.query(m); } catch(e) { console.log('Migration skipped:', e.message); }
        }

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@trivia.com';
        const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
        const check = await client.query('SELECT COUNT(*) FROM users WHERE email=$1', [adminEmail]);
        if (parseInt(check.rows[0].count) === 0) {
            const hash = await bcrypt.hash(adminPassword, 10);
            await client.query('INSERT INTO users (email,password_hash,role,score) VALUES ($1,$2,$3,0)', [adminEmail, hash, 'admin']);
            console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);
        }
        console.log('✅ Database ready');
    } finally { client.release(); }
}

const app = express();
app.use(cors({ origin: ['http://localhost:3009','http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use((req, _res, next) => { console.log(`📨 ${req.method} ${req.path}`); next(); });

// ── AUTH ───────────────────────────────────────────────────────────────────────
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const hashed = await bcrypt.hash(password, 10);
        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        const role = parseInt(countRes.rows[0].count) === 0 ? 'admin' : 'player';
        const r = await runQuery(
            'INSERT INTO users (email,password_hash,role) VALUES ($1,$2,$3) RETURNING id,email,role,score',
            [email, hashed, role]
        );
        const token = jwt.sign({ id: r.rows[0].id, role: r.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ user: r.rows[0], token });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'User already exists' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(password, r.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Wrong password' });
        const token = jwt.sign({ id: r.rows[0].id, role: r.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { password_hash, ...user } = r.rows[0];
        res.json({ user, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CATEGORIES ─────────────────────────────────────────────────────────────────
app.get('/categories', async (_req, res) => {
    try { res.json((await pool.query('SELECT * FROM categories ORDER BY name')).rows); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/categories', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    try {
        const r = await runQuery('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name.trim()]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/categories/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        await runQuery('DELETE FROM categories WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── QUESTIONS ──────────────────────────────────────────────────────────────────
app.get('/categories/:catId/questions', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const r = await pool.query(
            'SELECT * FROM questions WHERE category_id=$1 ORDER BY id DESC',
            [req.params.catId]
        );
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/questions', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    if (!categoryId || !text || !options || !correctAnswer || !complexity)
        return res.status(400).json({ error: 'All fields required' });
    try {
        const catCheck = await pool.query('SELECT id FROM categories WHERE id=$1', [categoryId]);
        if (!catCheck.rows.length) return res.status(400).json({ error: `Category ${categoryId} not found` });
        const r = await runQuery(
            `INSERT INTO questions (category_id,text,option_a,option_b,option_c,option_d,correct_answer,complexity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/questions/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    try {
        const r = await runQuery(
            `UPDATE questions SET category_id=$1,text=$2,option_a=$3,option_b=$4,option_c=$5,
             option_d=$6,correct_answer=$7,complexity=$8 WHERE id=$9 RETURNING *`,
            [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity, req.params.id]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/questions/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { disabled } = req.body;
    try {
        const r = await runQuery('UPDATE questions SET disabled=$1 WHERE id=$2 RETURNING *', [disabled, req.params.id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/questions/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        await runQuery('DELETE FROM questions WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GAME ───────────────────────────────────────────────────────────────────────
app.get('/game/next', async (_req, res) => {
    try {
        const count = await pool.query('SELECT COUNT(*) FROM questions WHERE disabled=FALSE');
        if (parseInt(count.rows[0].count) === 0) return res.json({ message: 'No questions available' });
        const qr = await pool.query('SELECT * FROM questions WHERE disabled=FALSE ORDER BY RANDOM() LIMIT 1');
        const q = qr.rows[0];
        const cat = await pool.query('SELECT name FROM categories WHERE id=$1', [q.category_id]);
        const options = [
            { char: 'A', text: q.option_a }, { char: 'B', text: q.option_b },
            { char: 'C', text: q.option_c }, { char: 'D', text: q.option_d }
        ];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        res.json({ id: q.id, category: cat.rows[0]?.name || 'General', text: q.text, options, complexity: q.complexity });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/game/submit', async (req, res) => {
    const { questionId, selectedAnswer } = req.body;
    if (!questionId || !selectedAnswer) return res.status(400).json({ error: 'questionId and selectedAnswer required' });
    try {
        const qr = await pool.query('SELECT correct_answer FROM questions WHERE id=$1', [questionId]);
        if (!qr.rows.length) return res.status(404).json({ error: 'Question not found' });
        const correctAnswer = qr.rows[0].correct_answer.trim().toUpperCase();
        const isCorrect = selectedAnswer.toUpperCase() === correctAnswer;
        const u = getTokenUser(req);
        if (u) {
            await pool.query('INSERT INTO game_sessions (user_id,question_id,selected_answer,is_correct) VALUES ($1,$2,$3,$4)',
                [u.id, questionId, selectedAnswer, isCorrect]);
            if (isCorrect) await pool.query('UPDATE users SET score=score+10 WHERE id=$1', [u.id]);
        }
        res.json({ isCorrect, correctAnswer });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/game/report', async (req, res) => {
    const { questionId, reason } = req.body;
    if (!questionId) return res.status(400).json({ error: 'questionId required' });
    try {
        const exists = await pool.query('SELECT id FROM questions WHERE id=$1', [questionId]);
        if (!exists.rows.length) return res.status(404).json({ error: 'Question not found' });
        await runQuery('INSERT INTO question_reports (question_id,reason) VALUES ($1,$2)', [questionId, reason || 'Reported by user']);
        console.log(`🚩 Question ${questionId} reported`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LEADERBOARD ────────────────────────────────────────────────────────────────
app.get('/leaderboard', async (_req, res) => {
    try { res.json((await pool.query('SELECT id,email,score,role FROM users ORDER BY score DESC LIMIT 50')).rows); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PENDING QUESTIONS (user submissions) ──────────────────────────────────────
app.post('/pending-questions', async (req, res) => {
    const { categoryName, text, options, correctAnswer, complexity } = req.body;
    if (!categoryName || !text || !options || !correctAnswer || !complexity)
        return res.status(400).json({ error: 'All fields required' });
    try {
        const u = getTokenUser(req);
        let email = 'anonymous';
        if (u) {
            const userRow = await pool.query('SELECT email FROM users WHERE id=$1', [u.id]);
            if (userRow.rows.length) email = userRow.rows[0].email;
        }
        await runQuery(
            `INSERT INTO pending_questions
             (user_id,submitted_by_email,category_name,text,option_a,option_b,option_c,option_d,correct_answer,complexity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [u?.id || null, email, categoryName, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: REVIEW QUEUE ────────────────────────────────────────────────────────
app.get('/admin/queue', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const r = await pool.query(`SELECT * FROM pending_questions WHERE status='pending' ORDER BY submitted_at DESC`);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/admin/approve/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const pq = (await pool.query('SELECT * FROM pending_questions WHERE id=$1', [req.params.id])).rows[0];
        if (!pq) return res.status(404).json({ error: 'Not found' });
        // Find or create the category by name
        let cat = (await pool.query('SELECT id FROM categories WHERE LOWER(name)=LOWER($1)', [pq.category_name])).rows[0];
        if (!cat) cat = (await runQuery('INSERT INTO categories (name) VALUES ($1) RETURNING *', [pq.category_name])).rows[0];
        await runQuery(
            `INSERT INTO questions (category_id,text,option_a,option_b,option_c,option_d,correct_answer,complexity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [cat.id, pq.text, pq.option_a, pq.option_b, pq.option_c, pq.option_d, pq.correct_answer, pq.complexity]
        );
        await runQuery(`UPDATE pending_questions SET status='approved' WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/admin/deny/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        await runQuery(`UPDATE pending_questions SET status='denied' WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: REPORTED QUESTIONS ──────────────────────────────────────────────────
app.get('/admin/reported', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const r = await pool.query(`
            SELECT qr.id AS report_id, qr.reason, qr.reported_at,
                   q.id, q.text, q.option_a, q.option_b, q.option_c, q.option_d,
                   q.correct_answer, q.complexity, q.disabled,
                   c.name AS category_name
            FROM question_reports qr
            JOIN questions q ON q.id = qr.question_id
            JOIN categories c ON c.id = q.category_id
            ORDER BY qr.reported_at DESC
        `);
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/admin/reports/:id', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        await runQuery('DELETE FROM question_reports WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── HEALTH ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 5000;
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔════════════════════════════════════════════╗
║   ✅ Backend running on port ${PORT}       ║
║   📡 Listening on 0.0.0.0:${PORT}          ║
║   🔐 JWT: ENABLED                          ║
╚════════════════════════════════════════════╝`);
    });
}).catch(err => { console.error('❌ Init failed:', err); process.exit(1); });
