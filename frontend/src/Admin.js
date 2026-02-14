import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export default function Admin({ user }) {
    const [activeTab, setActiveTab] = useState('add'); // 'add' or 'review'
    const [pendingQueue, setPendingQueue] = useState([]);
    const [categories, setCategories] = useState(['General Knowledge', 'Science', 'History']);

    // Form State
    const [qText, setQText] = useState('');
    const [qOptionA, setQOptionA] = useState('');
    const [qOptionB, setQOptionB] = useState('');
    const [qOptionC, setQOptionC] = useState('');
    const [qOptionD, setQOptionD] = useState('');
    const [qCorrect, setQCorrect] = useState('A');
    const [qComplexity, setQComplexity] = useState('easy');

    useEffect(() => {
        if (activeTab === 'review') {
            fetchQueue();
        }
    }, [activeTab]);

    const fetchQueue = async () => {
        try {
            const res = await axios.get(`${API_URL}/admin/queue`);
            setPendingQueue(res.data);
        } catch (err) {
            console.error("Failed to load queue", err);
            alert("Could not load queue. Are you logged in as Admin?");
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.post(`${API_URL}/admin/approve/${id}`);
            alert("Question Approved and added to game!");
            fetchQueue();
        } catch (err) {
            alert("Approval failed. Check console.");
        }
    };

    const handleDeny = async (id) => {
        try {
            await axios.post(`${API_URL}/admin/deny/${id}`);
            alert("Question Denied.");
            fetchQueue();
        } catch (err) {
            alert("Denial failed.");
        }
    };

    const addCategory = async () => {
        alert("Category adding feature disabled for this demo. Use 'General Knowledge' as default.");
        // Implementation similar to previous code
    };

    const addQuestion = async () => {
        if (!qText || !qOptionA || !qOptionB || !qOptionC || !qOptionD) {
            alert("Please fill in all fields.");
            return;
        }

        const payload = {
            categoryId: 1, 
            text: qText,
            options: { a: qOptionA, b: qOptionB, c: qOptionC, d: qOptionD },
            correctAnswer: qCorrect,
            complexity: qComplexity
        };

        try {
            await axios.post(`${API_URL}/questions`, payload);
            alert("✅ Question Added Directly to Game!");
            // Clear form
            setQText(''); setQOptionA(''); setQOptionB(''); setQOptionC(''); setQOptionD('');
            setQCorrect('A');
        } catch (err) {
            alert("Error adding question. Is the backend running?");
        }
    };

    return (
        <div className="card" style={{ padding: '30px' }}>
            <h2>🏆 Admin Dashboard</h2>
            
            <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className={`btn ${activeTab === 'add' ? 'btn-primary' : ''}`} 
                        onClick={() => setActiveTab('add')}
                    >
                        ➕ Add Question (Direct)
                    </button>
                    <button 
                        className={`btn ${activeTab === 'review' ? 'btn-primary' : ''}`} 
                        onClick={() => setActiveTab('review')}
                    >
                        📋 Review Queue ({pendingQueue.length})
                    </button>
                </div>
            </div>

            {activeTab === 'add' ? (
                <div style={{ marginTop: '20px' }}>
                    <h3>Direct Question Entry</h3>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label>Question Text</label>
                        <textarea 
                            value={qText} 
                            onChange={e => setQText(e.target.value)} 
                            className="btn"
                            style={{ width: '100%', minHeight: '80px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input value={qOptionA} onChange={e => setQOptionA(e.target.value)} placeholder="Option A" className="btn" />
                        <input value={qOptionB} onChange={e => setQOptionB(e.target.value)} placeholder="Option B" className="btn" />
                        <input value={qOptionC} onChange={e => setQOptionC(e.target.value)} placeholder="Option C" className="btn" />
                        <input value={qOptionD} onChange={e => setQOptionD(e.target.value)} placeholder="Option D" className="btn" />
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'center' }}>
                        <div>
                            <strong>Correct Answer:</strong>
                            {['A','B','C','D'].map(c => (
                                <label key={c} style={{ cursor: 'pointer', marginLeft: '10px' }}>
                                    <input type="radio" name="correct" value={c} checked={qCorrect === c} onChange={e => setQCorrect(e.target.value)} /> {c}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px', alignItems: 'center' }}>
                         <div>
                            <strong>Complexity:</strong>
                            <select value={qComplexity} onChange={e => setQComplexity(e.target.value)} className="btn" style={{ marginLeft: '10px' }}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                         </div>
                    </div>

                    <button onClick={addQuestion} className="btn btn-primary" style={{ marginTop: '30px', width: '100%', padding: '15px' }}>
                        ✅ Submit Question
                    </button>
                </div>
            ) : (
                <div style={{ marginTop: '20px' }}>
                    <h3>📥 Pending Question Requests</h3>
                    {pendingQueue.length === 0 ? (
                        <p style={{ color: '#888' }}>No pending questions to review.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {pendingQueue.map(q => (
                                <div key={q.id} className="card" style={{ borderLeft: '5px solid #ffc107', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#888' }}>
                                            User: {q.submitted_by_email} | {new Date(q.submitted_at).toLocaleDateString()}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', backgroundColor: '#ffc107', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>
                                            {q.complexity.toUpperCase()}
                                        </span>
                                    </div>
                                    <h4 style={{ color: 'var(--text-color)', marginTop: '10px' }}>{q.text}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                        <div>A) {q.option_a}</div>
                                        <div>B) {q.option_b}</div>
                                        <div>C) {q.option_c}</div>
                                        <div>D) {q.option_d}</div>
                                    </div>
                                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                        <button 
                                            className="btn" 
                                            style={{ backgroundColor: '#28a745', color: 'white' }}
                                            onClick={() => handleApprove(q.id)}
                                        >
                                            ✅ Approve & Add to Game
                                        </button>
                                        <button 
                                            className="btn" 
                                            style={{ backgroundColor: '#dc3545', color: 'white' }}
                                            onClick={() => handleDeny(q.id)}
                                        >
                                            ❌ Deny
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
