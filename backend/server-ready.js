// --- 0. Initialize Everything First ---
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
    process.exit(1);
}

console.log('✅ JWT_SECRET is configured');
console.log(`📊 Environment check:
    - PG_HOST: ${process.env.PG_HOST}
    - PG_PORT: ${process.env.PG_PORT}
    - PG_USER: ${process.env.PG_USER}
    - PG_DB: ${process.env.PG_DB}
    - JWT_SECRET: ${process.env.JWT_SECRET ? '✓ SET' : '✗ MISSING'}
`);

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DB,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

pool.on('connect', () => { console.log('✅ Database connection established'); });
pool.on('error', (err) => { console.error('❌ Unexpected database error:', err); });

async function runQuery(query, params = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(query, params);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log("📄 Initializing database tables...");
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
                category_id INT REFERENCES categories(id),
                text TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                complexity VARCHAR(20) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pending_questions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
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
                question_id INT REFERENCES questions(id),
                reason TEXT
            );
        `);
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@trivia.com';
        const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
        const userCheck = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', [adminEmail]);
        
        if (parseInt(userCheck.rows[0].count) === 0) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await client.query(
                'INSERT INTO users (email, password_hash, role, score) VALUES ($1, $2, $3, $4)',
                [adminEmail, hashedPassword, 'admin', 0]
            );
            console.log(`✅ Admin user created: ${adminEmail} / ${adminPassword}`);
        } else {
            console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
        }
        
        console.log("✅ Database tables initialized and admin user ready.");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
        throw err;
    } finally {
        client.release();
    }
}

const app = express();

app.use(cors({ origin: ['http://localhost:3009', 'http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - Body:`, JSON.stringify(req.body));
    next();
});

// --- 1. Register ---
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const hashed = await bcrypt.hash(password, 10);
        let role = 'player';
        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        if (parseInt(countRes.rows[0].count) === 0) role = 'admin';
        const result = await runQuery(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, score',
            [email, hashed, role]
        );
        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        console.log('✅ Registration successful:', email);
        res.json({ user: result.rows[0], token });
    } catch (err) {
        if (err.code === '23505') res.status(400).json({ error: 'User already exists' });
        else res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// --- 2. Login ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Wrong password' });
        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const { password_hash, ...user } = result.rows[0];
        console.log('✅ Login successful:', email);
        res.json({ user, token });
    } catch (err) {
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// --- 3. Get Question ---
app.get('/game/next', async (req, res) => {
    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM questions');
        if (parseInt(countRes.rows[0].count) === 0) return res.json({ message: "No questions available" });

        const qResult = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
        const question = qResult.rows[0];
        const catResult = await pool.query('SELECT name FROM categories WHERE id = $1', [question.category_id]);
        
        // Keep original A/B/C/D chars - shuffle display order but preserve labels
        const options = [
            { char: 'A', text: question.option_a },
            { char: 'B', text: question.option_b },
            { char: 'C', text: question.option_c },
            { char: 'D', text: question.option_d }
        ];
        
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        res.json({
            id: question.id,
            category: catResult.rows[0]?.name || 'General',
            text: question.text,
            options: options,
            complexity: question.complexity
            // correct_answer intentionally NOT sent to client
        });
    } catch (err) {
        console.error('❌ Error fetching question:', err.message);
        res.status(500).json({ error: 'Error fetching question' });
    }
});

// --- 4. Submit Answer (NEW!) ---
app.post('/game/submit', async (req, res) => {
    const { questionId, selectedAnswer } = req.body;
    if (!questionId || !selectedAnswer) return res.status(400).json({ error: 'questionId and selectedAnswer required' });

    try {
        const qResult = await pool.query('SELECT correct_answer FROM questions WHERE id = $1', [questionId]);
        if (qResult.rows.length === 0) return res.status(404).json({ error: 'Question not found' });

        const correctAnswer = qResult.rows[0].correct_answer.trim().toUpperCase();
        const isCorrect = selectedAnswer.toUpperCase() === correctAnswer;

        console.log(`🎯 Submit: q=${questionId}, selected=${selectedAnswer}, correct=${correctAnswer}, isCorrect=${isCorrect}`);

        // Award points if user authenticated
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                await pool.query(
                    'INSERT INTO game_sessions (user_id, question_id, selected_answer, is_correct) VALUES ($1, $2, $3, $4)',
                    [decoded.id, questionId, selectedAnswer, isCorrect]
                );
                if (isCorrect) {
                    await pool.query('UPDATE users SET score = score + 10 WHERE id = $1', [decoded.id]);
                    console.log(`✅ +10 points awarded to user ${decoded.id}`);
                }
            } catch (e) {
                console.log('⚠️ Token invalid, score not saved');
            }
        }

        res.json({ isCorrect, correctAnswer });
    } catch (err) {
        console.error('❌ Error submitting answer:', err.message);
        res.status(500).json({ error: 'Error submitting answer' });
    }
});

// --- 5. Leaderboard ---
app.get('/leaderboard', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, score, role FROM users ORDER BY score DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching leaderboard' });
    }
});

// --- 6. Get Categories ---
app.get('/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching categories' });
    }
});

// --- 7. Add Category ---
app.post('/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });
    try {
        const result = await runQuery('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
        console.log('✅ Category added:', name);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error adding category' });
    }
});

// --- 8. Add Question ---
app.post('/questions', async (req, res) => {
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    if (!categoryId || !text || !options || !correctAnswer || !complexity) {
        return res.status(400).json({ error: 'All fields required' });
    }
    try {
        const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
        if (catCheck.rows.length === 0) {
            return res.status(400).json({ error: `Category ID ${categoryId} does not exist. Create a category first!` });
        }
        const result = await runQuery(`
            INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
        console.log('✅ Question added, id:', result.rows[0].id);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error adding question:', err.message);
        res.status(500).json({ error: 'Error adding question: ' + err.message });
    }
});

// --- 9. Health ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), jwtConfigured: !!process.env.JWT_SECRET });
});

const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔════════════════════════════════════════════╗
║   ✅ Backend server running on port ${PORT}  ║
║   📡 Listening on 0.0.0.0:${PORT}            ║
║   🔐 JWT Authentication: ENABLED           ║
╚════════════════════════════════════════════╝
        `);
    });
}).catch(err => {
    console.error("❌ Initialization failed:", err);
    process.exit(1);
});
