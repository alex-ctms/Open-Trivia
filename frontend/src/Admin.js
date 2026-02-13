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

    useEffect(() => {
        fetchCategories();
    }, []);

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
        <div className="card">
            <h2>Admin Dashboard</h2>
            <h3>Add Category</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
                <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category Name" className="btn" />
                <button onClick={addCategory} className="btn btn-primary">Add</button>
            </div>
            
            <div style={{ marginTop: '30px' }}>
                <h3>Add Question</h3>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label>Question Text</label>
                    <textarea value={qText} onChange={e => setQText(e.target.value)} className="btn" style={{ width: '100%', minHeight: '60px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input value={qOptionA} onChange={e => setQOptionA(e.target.value)} placeholder="Option A" className="btn" />
                    <input value={qOptionB} onChange={e => setQOptionB(e.target.value)} placeholder="Option B" className="btn" />
                    <input value={qOptionC} onChange={e => setQOptionC(e.target.value)} placeholder="Option C" className="btn" />
                    <input value={qOptionD} onChange={e => setQOptionD(e.target.value)} placeholder="Option D" className="btn" />
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', alignItems: 'center' }}>
                    <label>Correct Answer:</label>
                    {['A','B','C','D'].map(c => (
                        <label key={c} style={{ cursor: 'pointer' }}>
                            <input type="radio" name="correct" value={c} checked={qCorrect === c} onChange={e => setQCorrect(e.target.value)} /> {c}
                        </label>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                    <label>Complexity:</label>
                    <select value={qComplexity} onChange={e => setQComplexity(e.target.value)} className="btn">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>

                    <label>Category:</label>
                    <select value={qCategory} onChange={e => setQCategory(e.target.value)} className="btn">
                        <option value="" disabled>Select Category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <button onClick={addQuestion} className="btn btn-primary" style={{ marginTop: '20px' }}>Submit Question</button>
            </div>
        </div>
    );
}
