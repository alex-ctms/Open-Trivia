import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Game from './Game';
import Admin from './Admin';
import Leaderboard from './Leaderboard';
import { ThemeProvider, useTheme } from './ThemeContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

console.log('🔧 API URL configured as:', API_URL);

// ── Header ─────────────────────────────────────────────────────────────────────
const AppHeader = ({ user, onLogout, urlResetToken = '' }) => {
    const { isDark, toggleTheme } = useTheme();
    const token = localStorage.getItem('token');
    const [storedUser, setStoredUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (user) setStoredUser(user);
    }, [user]);

    const userRole = storedUser?.role || 'player';
    const userEmail = storedUser?.email || 'Guest';

    return (
        <div className="header" style={{
            padding: '20px',
            backgroundColor: 'var(--header-bg)',
            color: 'var(--header-text)',
            borderRadius: '12px 12px 0 0',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                    🏆 TriviaMaster
                </h1>
                {token && storedUser && (
                    <div style={{ marginLeft: '20px' }}>
                        <span className="badge" style={{
                            padding: '5px 10px', borderRadius: '15px',
                            backgroundColor: userRole === 'admin' ? '#ff9800' : '#28a745',
                            fontSize: '12px', fontWeight: 'bold'
                        }}>
                            {userRole.toUpperCase()}
                        </span>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button
                    className="btn"
                    style={{
                        backgroundColor: 'transparent', border: '1px solid var(--header-text)',
                        color: 'var(--header-text)', borderRadius: '50px', padding: '8px 15px', cursor: 'pointer'
                    }}
                    onClick={toggleTheme}
                >
                    {isDark ? '☀ Light' : '🌙 Dark'}
                </button>
                {!token ? (
                    <LoginModal initialToken={urlResetToken} />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9rem' }}>
                            Welcome, <strong>{userEmail.split('@')[0]}</strong>
                        </span>
                        <button
                            className="btn"
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.2)', color: 'white',
                                padding: '8px 16px', border: 'none', borderRadius: '5px', cursor: 'pointer'
                            }}
                            onClick={onLogout}
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Login / Register / Forgot Password Modal ───────────────────────────────────
const LoginModal = ({ initialView = 'login', initialToken = '' }) => {
    const [isOpen, setIsOpen] = useState(!!initialToken); // auto-open if landing from email link
    // 'login' | 'register' | 'forgot' | 'reset'
    const [view, setView] = useState(initialToken ? 'reset' : initialView);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [resetToken, setResetToken] = useState(initialToken);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const clearMessages = () => { setError(''); setSuccess(''); };

    const handleLogin = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const res = await axios.post(`${API_URL}/login`, { email, password });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your credentials.');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const res = await axios.post(`${API_URL}/register`, { email, password });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. User might already exist.');
        }
    };

    const handleRequestReset = async (e) => {
        e.preventDefault();
        clearMessages();
        try {
            const res = await axios.post(`${API_URL}/auth/request-reset`, { email });
            if (res.data.emailSent) {
                // Real email was dispatched — just show confirmation, stay on this view
                setSuccess('📧 Reset link sent! Check your inbox (and spam folder).');
            } else if (res.data.token) {
                // Dev mode: no SMTP configured, token returned in response
                setResetToken(res.data.token);
                setSuccess('⚠️ No email server configured — token pre-filled below (dev mode).');
                setView('reset');
            } else {
                // User not found — show generic message (no enumeration)
                setSuccess('If that email is registered, a reset link has been sent.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Request failed.');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        clearMessages();
        if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
        try {
            await axios.post(`${API_URL}/auth/reset-password`, { token: resetToken, newPassword });
            setSuccess('Password updated! You can now log in.');
            setResetToken('');
            setNewPassword('');
            setTimeout(() => setView('login'), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Reset failed. Token may have expired.');
        }
    };

    const switchView = (v) => { clearMessages(); setView(v); };

    if (!isOpen) {
        return (
            <button
                className="btn"
                style={{
                    backgroundColor: 'white', color: 'var(--header-bg)',
                    padding: '8px 16px', fontWeight: 'bold', borderRadius: '5px', cursor: 'pointer'
                }}
                onClick={() => setIsOpen(true)}
            >
                Login / Register
            </button>
        );
    }

    const iStyle = {
        width: '100%', padding: '10px', boxSizing: 'border-box',
        borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px'
    };
    const linkStyle = {
        color: '#007bff', cursor: 'pointer', textDecoration: 'underline',
        background: 'none', border: 'none', padding: 0, fontSize: '0.85rem'
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="card" style={{ width: '90%', maxWidth: '420px', padding: '30px', position: 'relative' }}>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#888' }}
                >
                    ×
                </button>

                {/* Admin hint */}
                <div style={{ fontSize: '0.85rem', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '18px' }}>
                    <strong>🔑 Admin credentials:</strong><br />
                    Email: <code>admin@trivia.com</code> · Password: <code>admin123</code>
                </div>

                {error && (
                    <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '8px 12px', borderRadius: '5px', marginBottom: '12px', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{ color: '#155724', backgroundColor: '#d4edda', padding: '8px 12px', borderRadius: '5px', marginBottom: '12px', fontSize: '0.9rem' }}>
                        {success}
                    </div>
                )}

                {/* ── LOGIN ── */}
                {view === 'login' && (
                    <>
                        <h3 style={{ marginBottom: '16px' }}>Sign In</h3>
                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={iStyle} />
                            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={iStyle} />
                            <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>Sign In</button>
                        </form>
                        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <button style={linkStyle} onClick={() => switchView('forgot')}>Forgot password?</button>
                            <button style={linkStyle} onClick={() => switchView('register')}>Create an account →</button>
                        </div>
                    </>
                )}

                {/* ── REGISTER ── */}
                {view === 'register' && (
                    <>
                        <h3 style={{ marginBottom: '16px' }}>Create Account</h3>
                        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={iStyle} />
                            <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required style={iStyle} />
                            <button type="submit" className="btn" style={{ padding: '10px', backgroundColor: '#6c757d', color: 'white' }}>Register</button>
                        </form>
                        <div style={{ marginTop: '14px' }}>
                            <button style={linkStyle} onClick={() => switchView('login')}>← Back to sign in</button>
                        </div>
                    </>
                )}

                {/* ── FORGOT PASSWORD ── */}
                {view === 'forgot' && (
                    <>
                        <h3 style={{ marginBottom: '8px' }}>Reset Password</h3>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
                            Enter your email to generate a reset token.
                        </p>
                        <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} required style={iStyle} />
                            <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>Generate Reset Token</button>
                        </form>
                        <div style={{ marginTop: '14px' }}>
                            <button style={linkStyle} onClick={() => switchView('login')}>← Back to sign in</button>
                        </div>
                    </>
                )}

                {/* ── RESET PASSWORD ── */}
                {view === 'reset' && (
                    <>
                        <h3 style={{ marginBottom: '8px' }}>Set New Password</h3>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
                            Paste your reset token and choose a new password.
                        </p>
                        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="text" placeholder="Reset token"
                                value={resetToken} onChange={e => setResetToken(e.target.value)}
                                required style={{ ...iStyle, fontFamily: 'monospace', fontSize: '12px' }}
                            />
                            <input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={iStyle} />
                            <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>Reset Password</button>
                        </form>
                        <div style={{ marginTop: '14px', display: 'flex', gap: '12px' }}>
                            <button style={linkStyle} onClick={() => switchView('forgot')}>← Re-send token</button>
                            <button style={linkStyle} onClick={() => switchView('login')}>Back to sign in</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ── Main App ───────────────────────────────────────────────────────────────────
function App() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    // If the user lands via a password-reset email link (?reset_token=xxx),
    // extract the token and clear it from the URL so it isn't bookmarked.
    const [urlResetToken] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('reset_token') || '';
        if (t) {
            // Remove the token from the address bar without a reload
            const clean = window.location.pathname;
            window.history.replaceState({}, '', clean);
        }
        return t;
    });

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Keep anonymousId so guest tracking persists across sessions
        setUser(null);
        window.location.reload();
    };

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
    }, []);

    return (
        <ThemeProvider>
            <Router>
                <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
                    <AppHeader user={user} onLogout={handleLogout} urlResetToken={urlResetToken} />

                    <nav style={{ marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', gap: '30px' }}>
                        <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Play Game</Link>
                        <Link to="/leaderboard" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Leaderboard</Link>
                        {user && user.role === 'admin' && (
                            <Link to="/admin" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Admin Panel</Link>
                        )}
                    </nav>

                    <Routes>
                        <Route path="/" element={<Game />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
                    </Routes>

                    <footer style={{ textAlign: 'center', marginTop: '50px', color: '#888', fontSize: '0.9rem' }}>
                        <p>© 2026 TriviaMaster PWA</p>
                    </footer>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;
