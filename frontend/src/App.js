import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Game from './Game';
import Admin from './Admin';
import Leaderboard from './Leaderboard';
import { ThemeProvider, useTheme } from './ThemeContext';
import axios from 'axios';

// FIXED: Hardcode the API URL for Docker development mode
// In production, you would use process.env.REACT_APP_API_URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

console.log('🔧 API URL configured as:', API_URL);

// 1. Create the Header Component INSIDE this file to avoid import conflicts
const AppHeader = ({ user, onLogout }) => {
    const { isDark, toggleTheme } = useTheme();
    const token = localStorage.getItem('token');
    // Retrieve the user object from local storage if it exists
    const [storedUser, setStoredUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    // Sync user state if it changes
    useEffect(() => {
        if (user) {
            setStoredUser(user);
        }
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
                            padding: '5px 10px',
                            borderRadius: '15px',
                            backgroundColor: userRole === 'admin' ? '#ff9800' : '#28a745',
                            fontSize: '12px',
                            fontWeight: 'bold'
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
                        backgroundColor: 'transparent',
                        border: '1px solid var(--header-text)',
                        color: 'var(--header-text)',
                        borderRadius: '50px',
                        padding: '8px 15px',
                        cursor: 'pointer'
                    }}
                    onClick={toggleTheme}
                >
                    {isDark ? '☀ Light' : '🌙 Dark'}
                </button>
                {!token ? (
                    <LoginModal />
                ) : (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9rem' }}>
                            Welcome, <strong>{userEmail.split('@')[0]}</strong>
                        </span>
                        <button
                            className="btn"
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'white',
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
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

// --- Login Modal Component (New) ---
const LoginModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        console.log('🔐 Attempting login to:', `${API_URL}/login`);
        console.log('📧 Email:', email);
        
        try {
            const res = await axios.post(`${API_URL}/login`, {
                email: email,
                password: password
            });

            console.log('✅ Login successful:', res.data);
            
            // Save user and token
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            // Update window to reflect login
            window.location.reload();
        } catch (err) {
            console.error('❌ Login error:', err);
            console.error('Error response:', err.response?.data);
            setError(err.response?.data?.error || "Login failed. Check your credentials.");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        console.log('📝 Attempting registration to:', `${API_URL}/register`);
        console.log('📧 Email:', email);

        try {
            const res = await axios.post(`${API_URL}/register`, {
                email: email,
                password: password
            });

            console.log('✅ Registration successful:', res.data);
            
            // If registration succeeds, automatically log in
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            // Update window to reflect login
            window.location.reload();
        } catch (err) {
            console.error('❌ Registration error:', err);
            console.error('Error response:', err.response?.data);
            setError(err.response?.data?.error || "Registration failed. User might already exist.");
        }
    };

    if (!isOpen) {
        return (
            <button
                className="btn"
                style={{
                    backgroundColor: 'white',
                    color: 'var(--header-bg)',
                    padding: '8px 16px',
                    fontWeight: 'bold',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}
                onClick={() => setIsOpen(true)}
            >
                Login / Register
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '30px', position: 'relative' }}>
                <button 
                    onClick={() => setIsOpen(false)}
                    style={{ float: 'right', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#888' }}
                >
                    ×
                </button>
                <h3 style={{ marginBottom: '20px' }}>TriviaMaster Login</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
                    <strong>🔑 Admin Credentials:</strong><br/>
                    Email: <code>admin@trivia.com</code><br/>
                    Password: <code>admin123</code>
                </p>
                
                <div style={{ marginTop: '20px' }}>
                    <h4>Login</h4>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        <input 
                            type="email" 
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="btn"
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                        />
                        <input 
                            type="password" 
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="btn"
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                        />
                        {error && <span style={{ color: 'red', fontSize: '0.9rem' }}>{error}</span>}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>Sign In</button>
                    </form>

                    <div style={{ borderTop: '1px solid #ddd', margin: '20px 0' }}></div>
                    
                    <h4>Not registered?</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-color)' }}>Create a new account.</p>
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input 
                            type="email" 
                            placeholder="Choose Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="btn"
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                        />
                        <input 
                            type="password" 
                            placeholder="Choose Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="btn"
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                        />
                        {error && <span style={{ color: 'red', fontSize: '0.9rem' }}>{error}</span>}
                        <button type="submit" className="btn" style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white' }}>Register</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// 2. Main App Component
function App() {
    // Global user state for App component
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        // Force refresh to reset React state
        window.location.reload();
    };

    // Effect to update user state when token changes
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    return (
        <ThemeProvider>
            <Router>
                <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
                    <AppHeader user={user} onLogout={handleLogout} />
                    
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
