import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function Admin({ user }) {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [questions, setQuestions] = useState([]);
    
    // Form State
    const [qText, setQText] = useState('');
    const [qOptionA, setQOptionA] = useState('');
    const [qOptionB, setQOptionB] = useState('');
    const [qOptionC, setQOptionC] = useState('');
    const [qOptionD, setQOptionD] = useState('');
    const [qCorrect, setQCorrect] = useState('A');
    const [qComplexity, setQComplexity] = useState('easy');
    const [qCategory, setQCategory] = useState('');
    const [pendingQueue, setPendingQueue] = useState([]);
    const [activeTab, setActiveTab] = useState('add'); // 'add' or 'review'



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
            alert("Could not load queue. Are you logged in as Admin?");
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.post(`${API_URL}/admin/approve/${id}`);
            alert("Question Approved!");
            fetchQueue(); // Refresh list
        } catch (err) { alert("Approval failed"); }
    };

    const handleDeny = async (id) => {
        try {
            await axios.post(`${API_URL}/admin/deny/${id}`);
            alert("Question Denied.");
            fetchQueue(); // Refresh list
        } catch (err) { alert("Denial failed"); }
    };

    const fetchCategories = async () => {
        try {
            // We can't list categories via API yet, so just simulate
            // In a full app, add a GET /categories endpoint
            setCategories(['Science', 'History', 'Geography']);
        } catch (e) { console.error(e); }
    };

    const addCategory = async () => {
        if (!newCategory) return;
        try {
            const res = await axios.post(`${API_URL}/categories`, { name: newCategory });
            setCategories([...categories, res.data]);
            setNewCategory('');
        } catch (err) { alert("Error adding category"); }
    };

    const addQuestion = async () => {
        if (!qText || !qCategory) return alert("Fill all fields");
        const payload = {
            categoryId: 1, // Hardcoded for this demo, ideally find ID by name
            text: qText,
            options: { a: qOptionA, b: qOptionB, c: qOptionC, d: qOptionD },
            correctAnswer: qCorrect,
            complexity: qComplexity
        };

        try {
            await axios.post(`${API_URL}/questions`, payload);
            alert("Question Added Successfully!");
            // Clear form
            setQText(''); setQOptionA(''); setQOptionB(''); setQOptionC(''); setQOptionD(''); setQCorrect('A');
        } catch (err) {
            alert("Error adding question. Check console.");
        }
    };

return (
    <div className="card" style={{ padding: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
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

        {activeTab === 'add' ? (
            // ... existing direct add form code ...
        ) : (
            // --- NEW: Review Queue Logic ---
            <div>
                <h3>📥 Pending Question Requests</h3>
                {pendingQueue.length === 0 ? (
                    <p>No pending questions.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {pendingQueue.map(q => (
                            <div key={q.id} className="card" style={{ borderLeft: '5px solid #ffc107' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                                        Requested by: {q.submitted_by_email} on {new Date(q.submitted_at).toLocaleString()}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', backgroundColor: '#ffc107', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>
                                        {q.complexity.toUpperCase()}
                                    </span>
                                </div>
                                <h4 style={{ color: 'var(--text-color)' }}>{q.text}</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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

