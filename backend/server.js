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
	};
        CREATE TABLE IF NOT EXISTS pending_questions (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            category_name VARCHAR(100) NOT NULL, -- Store name directly to avoid FK issues if category is deleted
            text TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer CHAR(1) NOT NULL,
            complexity VARCHAR(20) NOT NULL,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'approved', 'denied'
        );
    `);
    client.release();
    console.log("Database initialized with Pending Questions Queue.");
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
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const hashed = await bcrypt.hash(password, 10);
    
    // Check if any user exists first
    const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
    const count = parseInt(existingUsers.rows[0].count);

    // LOGIC: If first user, OR if email matches ADMIN_EMAIL env var
    let role = 'player';
    if (count === 0) {
        role = 'admin';
        console.log("✅ First user registered. Granting ADMIN.");
    } else if (email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
        role = 'admin';
        console.log("✅ Admin email used. Granting ADMIN.");
    }

    try {
        const result = await pool.query(
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
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`✅ Backend running on port ${PORT}`);
        console.log("✅ Database connected and tables ready.");
    });
}).catch(err => {
    console.error("Failed to start server:", err);
});
// --- 8. User: Request to Add Question (Queued) ---
app.post('/api/requests/add-question', authMiddleware, async (req, res) => {
    const { categoryName, text, options, correctAnswer, complexity } = req.body;
    
    try {
        const result = await pool.query(`
            INSERT INTO pending_questions (user_id, category_name, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [req.user.id, categoryName, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
        
        res.status(201).json({ message: "Question request submitted for review!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to submit request" });
    }
});

// --- 9. Admin: Get Pending Queue ---
app.get('/api/admin/queue', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    
    try {
        const result = await pool.query(`
            SELECT pq.*, u.email as submitted_by_email 
            FROM pending_questions pq
            JOIN users u ON pq.user_id = u.id
            WHERE pq.status = 'pending'
            ORDER BY pq.submitted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load queue" });
    }
});

// --- 10. Admin: Approve Question (Moves to Active) ---
app.post('/api/admin/approve/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    
    const questionId = req.params.id;
    
    try {
        // 1. Get the pending question
        const qResult = await pool.query('SELECT * FROM pending_questions WHERE id = $1', [questionId]);
        const question = qResult.rows[0];
        
        if (!question) return res.status(404).json({ error: 'Question not found' });

        // 2. Create Category if it doesn't exist (Simple upsert logic)
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [question.category_name]);
        
        const catResult = await pool.query('SELECT id FROM categories WHERE name = $1', [question.category_name]);
        const categoryId = catResult.rows[0].id;

        // 3. Insert into active questions
        await pool.query(`
            INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [categoryId, question.text, question.option_a, question.option_b, question.option_c, question.option_d, question.correct_answer, question.complexity]);

        // 4. Update status to approved
        await pool.query('UPDATE pending_questions SET status = $1 WHERE id = $2', ['approved', questionId]);
        
        res.json({ message: "Question approved and added to the game!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to approve question" });
    }
});

// --- 11. Admin: Deny Question ---
app.post('/api/admin/deny/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    
    try {
        await pool.query('UPDATE pending_questions SET status = $1 WHERE id = $2', ['denied', req.params.id]);
        res.json({ message: "Question denied" });
    } catch (err) {
        res.status(500).json({ error: "Failed to deny question" });
    }
});
