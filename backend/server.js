const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Initialize DB Tables
async function initDB() {
    const client = await pool.connect();
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
        CREATE TABLE IF NOT EXISTS question_reports (
            id SERIAL PRIMARY KEY,
            question_id INT REFERENCES questions(id),
            reason TEXT
        );
        CREATE TABLE IF NOT EXISTS game_sessions (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            question_id INT REFERENCES questions(id),
            selected_answer CHAR(1),
            is_correct BOOLEAN
        );
    `);
    client.release();
    console.log("Database initialized.");
}

// Auth Middleware
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// --- Endpoints ---

// 1. Auth
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    
    // 1. Get a connection
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 2. Check if any user exists
        const checkQuery = 'SELECT COUNT(*) FROM users';
        const countRes = await client.query(checkQuery);
        const count = parseInt(countRes.rows[0].count);

        let role = 'player';
        
        // 3. Logic: If count is 0, or if the password matches the SEED, create Admin
        // The SEED password should be in your .env file
        const seedPassword = process.env.ADMIN_SEED_PASSWORD;
        
        if (count === 0) {
            role = 'admin';
            console.log("⚠️  First user registered. Granting ADMIN privileges.");
        } else if (password === seedPassword) {
            role = 'admin';
            console.log("✅ Admin Seed Password used. Granting ADMIN privileges.");
        } else {
            console.log("👤 Regular user registered.");
        }

        const insertQuery = `
            INSERT INTO users (email, password_hash, role) 
            VALUES ($1, $2, $3) 
            RETURNING id, email, role, score
        `;
        const result = await client.query(insertQuery, [email, hashed, role]);
        
        await client.query('COMMIT');

        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
        res.json({ user: result.rows[0], token });
        
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') { // Unique violation
            res.status(400).json({ error: 'User already exists' });
        } else {
            res.status(500).json({ error: 'Database error' });
        }
    } finally {
        client.release();
    }
});




app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    
    const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
    const { password_hash, ...user } = result.rows[0];
    res.json({ user, token });
});

// 2. Admin: Add Category
app.post('/api/categories', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const { name } = req.body;
    const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
});

// 3. Admin: Add Question
app.post('/api/questions', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    const result = await pool.query(`
        INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
    res.json(result.rows[0]);
});

// 4. Game: Get Random Question
app.get('/api/game/next', authMiddleware, async (req, res) => {
    const result = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
    if (result.rows.length === 0) return res.json(null);
    
    const question = result.rows[0];
    // Fetch category name
    const catResult = await pool.query('SELECT name FROM categories WHERE id = $1', [question.category_id]);
    
    // Shuffle answers for display
    const options = [
        { char: 'A', text: question.option_a },
        { char: 'B', text: question.option_b },
        { char: 'C', text: question.option_c },
        { char: 'D', text: question.option_d }
    ];
    
    // Fisher-Yates Shuffle
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
});

// 5. Game: Submit Answer & Report
app.post('/api/game/submit', authMiddleware, async (req, res) => {
    const { questionId, selectedAnswer, isReport } = req.body;

    if (isReport) {
        await pool.query('INSERT INTO question_reports (question_id, reason) VALUES ($1, $2)', [questionId, 'User report submitted']);
        return res.json({ message: 'Reported' });
    }

    const qResult = await pool.query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = qResult.rows[0];
    
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const isCorrect = selectedAnswer === question.correct_answer.toUpperCase();
    
    // Update Score
    if (isCorrect) {
        let points = 10;
        if (question.complexity === 'medium') points = 20;
        if (question.complexity === 'hard') points = 30;
        
        await pool.query('UPDATE users SET score = score + $1 WHERE id = $2', [points, req.user.id]);
    }

    await pool.query(
        'INSERT INTO game_sessions (user_id, question_id, selected_answer, is_correct) VALUES ($1, $2, $3, $4)',
        [req.user.id, questionId, selectedAnswer, isCorrect]
    );

    res.json({ isCorrect, correctAnswer: question.correct_answer });
});

// 6. Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const result = await pool.query('SELECT id, email, score, role FROM users ORDER BY score DESC LIMIT 50');
    res.json(result.rows);
});

// 7. User Profile (Simulated Gravatar Link)
app.get('/api/user', authMiddleware, async (req, res) => {
    const result = await pool.query('SELECT id, email, score, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
});

const PORT = process.env.PORT || 5000;
initDB().then(() => {
    app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
});
