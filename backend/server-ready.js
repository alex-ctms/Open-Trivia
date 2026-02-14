// --- 0. Initialize Everything First ---
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- Pool ---
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DB,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// --- Helper: Run SQL ---
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

// --- Database Initialization ---
async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log("🔄 Initializing database tables...");
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
            
            -- Create Admin User if none exists
            DO $$
            DECLARE
                user_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO user_count FROM users;
                IF user_count = 0 THEN
                    INSERT INTO users (email, password_hash, role, score)
                    VALUES ('asierputowski@ctmsit.com', '$2a$06$RSlUWkudtmDFVSUy94ktluvq/HQGAxE46XbfqeAoVBZdaaOzAcTMK', 'admin', 0);
                END IF;
            END $$;
        `);
        console.log("✅ Database tables initialized and admin user ready.");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
        throw err;
    } finally {
        client.release();
    }
}

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- 1. Auth: Register ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hashed = await bcrypt.hash(password, 10);
    let role = 'player';
    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM users');
        if (parseInt(countRes.rows[0].count) === 0) role = 'admin';
    } catch (err) { console.log('Count check failed, assuming first user'); role = 'admin'; }

    try {
        const result = await runQuery(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, score',
            [email, hashed, role]
        );
        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
        res.json({ user: result.rows[0], token });
    } catch (err) {
        if (err.code === '23505') {
            res.status(400).json({ error: 'User already exists' });
        } else {
            res.status(500).json({ error: 'Database error' });
        }
    }
});

// --- 2. Auth: Login ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Wrong password' });

        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
        const { password_hash, ...user } = result.rows[0];
        res.json({ user, token });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// --- 3. Game: Get Random Question ---
app.get('/api/game/next', async (req, res) => {
    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM questions');
        if (parseInt(countRes.rows[0].count) === 0) return res.json({ message: "No questions available" });

        const qResult = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
        const question = qResult.rows[0];
        const catResult = await pool.query('SELECT name FROM categories WHERE id = $1', [question.category_id]);
        
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
            category: catResult.rows[0].name,
            text: question.text,
            options: options,
            complexity: question.complexity
        });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching question' });
    }
});

// --- 4. Leaderboard ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, score, role FROM users ORDER BY score DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching leaderboard' });
    }
});

// --- 5. Admin: Add Category ---
app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await runQuery('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error adding category' });
    }
});

// --- 6. Admin: Add Question ---
app.post('/api/questions', async (req, res) => {
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    try {
        const result = await runQuery(`
            INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error adding question' });
    }
});

const PORT = process.env.PORT || 5000;

// --- 7. Start: Init DB FIRST, THEN server ---
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Backend server running on port ${PORT}`);
    });
}).catch(err => {
    console.error("❌ Initialization failed:", err);
    process.exit(1);
});
