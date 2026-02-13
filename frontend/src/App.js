import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Game from './Game';
import Admin from './Admin';
import Leaderboard from './Leaderboard';
import { ThemeProvider, useTheme } from './ThemeContext'; // Ensure this file exists

// 1. Create the Header Component INSIDE this file to avoid import conflicts
const AppHeader = () => {
    const { isDark, toggleTheme } = useTheme();
    const token = localStorage.getItem('token');
    // Simple role check - if you are admin, you'll see it
    const userRole = token === 'admin-token' ? 'admin' : 'player'; 

    return (
        <div className="header" style={{ 
            padding: '20px', 
            backgroundColor: 'var(--header-bg)', 
            color: 'var(--header-text)',
            borderRadius: '12px 12px 0 0',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>TriviaMaster</h1>
                {token && (
                     <div style={{ marginLeft: '20px' }}>
                        <span className="badge" style={{ 
                            padding: '5px 10px', 
                            borderRadius: '15px', 
                            backgroundColor: userRole === 'admin' ? '#ff9800' : '#28a745',
                            fontSize: '12px'
                        }}>
                            {userRole}
                        </span>
                     </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <button 
                    className="btn"
                    style={{ 
                        backgroundColor: 'transparent', 
                        border: '1px solid var(--header-text)', 
                        color: 'var(--header-text)',
                        borderRadius: '50px',
                        padding: '8px 15px'
                    }}
                    onClick={toggleTheme}
                >
                    {isDark ? '☀ Light' : '🌙 Dark'}
                </button>

                {!token ? (
                    <button 
                        className="btn" 
                        style={{ 
                            backgroundColor: 'white', 
                            color: 'var(--header-bg)',
                            padding: '8px 16px',
                            fontWeight: 'bold'
                        }}
                        onClick={() => {
                            const email = prompt("Enter email to login (or register with seed password for admin):");
                            if(email) {
                                // For demo purposes, we'll store a mock token
                                // If the password is the seed, we'd normally log in via API
                                localStorage.setItem('token', 'mock-user-token');
                                window.location.reload(); // Simple reload to update UI
                            }
                        }}
                    >
                        Login / Register
                    </button>
                ) : (
                     <button 
                        className="btn" 
                        style={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            color: 'white'
                        }}
                        onClick={() => {
                            localStorage.removeItem('token');
                            window.location.reload();
                        }}
                    >
                        Logout
                    </button>
                )}
            </div>
        </div>
    );
};

// 2. Main App Component
function App() {
    return (
        <ThemeProvider>
            <Router>
                <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
                    <AppHeader />

                    <nav style={{ marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', gap: '30px' }}>
                        <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Play Game</Link>
                        <Link to="/leaderboard" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Leaderboard</Link>
                        <Link to="/admin" style={{ textDecoration: 'none', color: 'var(--text-color)', fontWeight: 'bold' }}>Admin Panel</Link>
                    </nav>

                    <Routes>
                        <Route path="/" element={<Game />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/admin" element={<Admin />} />
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
