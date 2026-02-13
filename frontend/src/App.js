import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './ThemeContext'; // Add this import
import './App.css'; // Add this import
import Game from './Game';
import Admin from './Admin';
import Leaderboard from './Leaderboard';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// --- Header Component (Separate for Clean UI) ---
const AppHeader = () => {
    const { isDark, toggleTheme } = useTheme();
    
    // Check if user is logged in (simplified logic)
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
    const [userRole, setUserRole] = useState('player');
    
    // Simulate user check
    useEffect(() => {
        if (isLoggedIn) {
            // In a real app, decode the JWT here
            setUserRole('player'); // Default to player unless admin
        }
    }, [isLoggedIn]);

    return (
        <div className="header" style={{ 
            padding: '20px', 
            backgroundColor: 'var(--header-bg)', 
            color: 'var(--header-text)',
            borderRadius: '12px 12px 0 0',
            marginBottom: '20px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <h1 style={{ margin: 0 }}>TriviaMaster</h1>
                {isLoggedIn && (
                     <div style={{ marginLeft: '20px', fontSize: '0.9rem' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                 {/* Dark Mode Toggle Button */}
                <button 
                    className="btn"
                    style={{ 
                        backgroundColor: 'transparent', 
                        border: '1px solid var(--header-text)', 
                        color: 'var(--header-text)',
                        borderRadius: '50px',
                        padding: '5px 15px'
                    }}
                    onClick={toggleTheme}
                >
                    {isDark ? '☀ Light Mode' : '🌙 Dark Mode'}
                </button>

                {!isLoggedIn ? (
                    <button 
                        className="btn" 
                        style={{ 
                            backgroundColor: 'white', 
                            color: 'var(--header-bg)',
                            padding: '8px 16px',
                            fontWeight: 'bold'
                        }}
                        onClick={() => {
                             const email = prompt("Enter email to login (or register):");
                             if(email) {
                                 localStorage.setItem('token', 'mock-token');
                                 setIsLoggedIn(true);
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
                            setIsLoggedIn(false);
                        }}
                    >
                        Logout
                    </button>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---
function App() {
    return (
        <ThemeProvider>
            <Router>
                <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
                    <AppHeader />

                    <nav style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', gap: '20px' }}>
                        <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-color)' }}>Play Game</Link>
                        <Link to="/leaderboard" style={{ textDecoration: 'none', color: 'var(--text-color)' }}>Leaderboard</Link>
                        {/* Only show Admin if we had real auth */}
                        <Link to="/admin" style={{ textDecoration: 'none', color: 'var(--text-color)' }}>Admin Panel</Link>
                    </nav>

                    <Routes>
                        <Route path="/" element={<Game />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/admin" element={<Admin />} />
                    </Routes>

                    <footer style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
                        <p>© 2023 TriviaMaster PWA</p>
                    </footer>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;
