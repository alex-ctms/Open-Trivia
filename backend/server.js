const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Ensure your .env file has these values:
// PG_HOST=db
// PG_PORT=5432
// PG_USER=trivia_user
// PG_PASSWORD=trivia_pass
// PG_DB=trivia_db

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// --- Auth Middleware ---
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

// --- Helper: Registration with Auto-Admin Logic ---
const handleRegistration = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const hashed = await bcrypt.hash(password, 10);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const checkQuery = 'SELECT COUNT(*) FROM users';
        const countRes = await client.query(checkQuery);
        const count = parseInt(countRes.rows[0].count);

        let role = 'player';
        if (count === 0) {
            role = 'admin';
            console.log("✅ First user registered. Granting ADMIN.");
        } else if (email.toLowerCase() === (process.env.ADMIN_EMAIL || 'admin@trivia.com').toLowerCase()) {
            role = 'admin';
            console.log("✅ Admin email used. Granting ADMIN.");
        }

        const insertQuery = `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, score`;
        const result = await client.query(insertQuery, [email, hashed, role]);
        
        await client.query('COMMIT');

        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
        res.json({ user: result.rows[0], token });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            res.status(400).json({ error: 'User already exists' });
        } else {
            console.error('Registration error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    } finally {
        client.release();
    }
};

// --- Helper: Login Logic ---
const handleLogin = async (req, res) => {
    const { email, password } = req.body;
    
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const valid = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Wrong password' });
        }

        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET);
        const { password_hash, ...user } = result.rows[0];
        res.json({ user, token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
};

// --- Routes ---

// 1. Auth: Register
app.post('/api/register', handleRegistration);

// 2. Auth: Login
app.post('/api/login', handleLogin);

// 3. Admin: Add Category
app.post('/api/categories', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const { name } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error adding category' });
    } finally {
        client.release();
    }
});

// 4. Admin: Add Question (Direct)
app.post('/api/questions', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const { categoryId, text, options, correctAnswer, complexity } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query(`
            INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [categoryId, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error adding question' });
    } finally {
        client.release();
    }
});

// 5. Game: Get Random Question
app.get('/api/game/next', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const qResult = await client.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
        if (qResult.rows.length === 0) return res.json(null);

        const question = qResult.rows[0];
        const catResult = await client.query('SELECT name FROM categories WHERE id = $1', [question.category_id]);
        
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
    } catch (err) {
        res.status(500).json({ error: 'Error fetching question' });
    } finally {
        client.release();
    }
});

// 6. Game: Submit Answer
app.post('/api/game/submit', authMiddleware, async (req, res) => {
    const { questionId, selectedAnswer, isReport } = req.body;
    const client = await pool.connect();
    
    try {
        if (isReport) {
            await client.query('INSERT INTO question_reports (question_id, reason) VALUES ($1, $2)', [questionId, 'User report submitted']);
            return res.json({ message: 'Reported' });
        }

        const qResult = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
        const question = qResult.rows[0];
        
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const isCorrect = selectedAnswer === question.correct_answer.toUpperCase();
        
        // Update Score
        if (isCorrect) {
            let points = 10;
            if (question.complexity === 'medium') points = 20;
            if (question.complexity === 'hard') points = 30;
            
            await client.query('UPDATE users SET score = score + $1 WHERE id = $2', [points, req.user.id]);
        }

        await client.query(
            'INSERT INTO game_sessions (user_id, question_id, selected_answer, is_correct) VALUES ($1, $2, $3, $4)',
            [req.user.id, questionId, selectedAnswer, isCorrect]
        );

        res.json({ isCorrect, correctAnswer: question.correct_answer });
    } catch (err) {
        res.status(500).json({ error: 'Error submitting answer' });
    } finally {
        client.release();
    }
});

// 7. Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, email, score, role FROM users ORDER BY score DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching leaderboard' });
    } finally {
        client.release();
    }
});

// 8. User Profile
app.get('/api/user', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, email, score, role FROM users WHERE id = $1', [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching user' });
    } finally {
        client.release();
    }
});

// --- 9. Pending Questions (User Request) ---
app.post('/api/requests/add-question', authMiddleware, async (req, res) => {
    const { categoryName, text, options, correctAnswer, complexity } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query(`
            INSERT INTO pending_questions (user_id, category_name, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [req.user.id, categoryName, text, options.a, options.b, options.c, options.d, correctAnswer, complexity]);
        res.status(201).json({ message: "Question request submitted for review!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to submit request" });
    } finally {
        client.release();
    }
});

// --- 10. Admin: Review Queue ---
app.get('/api/admin/queue', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT pq.*, u.email as submitted_by_email 
            FROM pending_questions pq
            JOIN users u ON pq.user_id = u.id
            WHERE pq.status = 'pending'
            ORDER BY pq.submitted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load queue" });
    } finally {
        client.release();
    }
});

// --- 11. Admin: Approve Question ---
app.post('/api/admin/approve/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    
    const client = await pool.connect();
    try {
        const qResult = await client.query('SELECT * FROM pending_questions WHERE id = $1', [req.params.id]);
        const question = qResult.rows[0];
        if (!question) return res.status(404).json({ error: 'Question not found' });

        await client.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [question.category_name]);
        const catResult = await client.query('SELECT id FROM categories WHERE name = $1', [question.category_name]);
        const categoryId = catResult.rows[0].id;

        await client.query(`
            INSERT INTO questions (category_id, text, option_a, option_b, option_c, option_d, correct_answer, complexity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [categoryId, question.text, question.option_a, question.option_b, question.option_c, question.option_d, question.correct_answer, question.complexity]);

        await client.query('UPDATE pending_questions SET status = $1 WHERE id = $2', ['approved', req.params.id]);
        
        res.json({ message: "Question approved and added to the game!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to approve question" });
    } finally {
        client.release();
    }
});

// --- 12. Admin: Deny Question ---
app.post('/api/admin/deny/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
    const client = await pool.connect();
    try {
        await client.query('UPDATE pending_questions SET status = $1 WHERE id = $2', ['denied', req.params.id]);
        res.json({ message: "Question denied" });
    } catch (err) {
        res.status(500).json({ error: "Failed to deny question" });
    } finally {
        client.release();
    }
});

// --- Database Initialization with Retry Logic ---
async function initDBWithRetry(maxRetries = 10) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            console.log(`🔄 Attempt ${attempts + 1}/${maxRetries}: Initializing database...`);
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

            // Create Admin User Fallback (if none exist)
            await client.query(`
                DO $$
                DECLARE
                    user_count INTEGER;
                BEGIN
                    SELECT COUNT(*) INTO user_count FROM users;
                    IF user_count = 0 THEN
                        INSERT INTO users (email, password_hash, role, score)
                        VALUES ('asierputowski@ctmsit.com', '\$2a\$10\$PASTE_YOUR_HASH_HERE', 'admin', 0);
                    END IF;
                END $$;
            `);

            client.release();
            console.log("✅ Database tables initialized and admin user ready.");
            return;
        } catch (err) {
            attempts++;
            console.warn(`❌ Database initialization attempt ${attempts}/${maxRetries} failed: ${err.message}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error("❌ Failed to initialize database after multiple retries.");
}

// --- Start Server ---
const PORT = process.env.PORT || 5000;

initDBWithRetry().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Backend server running on port ${PORT}`);
    });
}).catch(err => {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
});
