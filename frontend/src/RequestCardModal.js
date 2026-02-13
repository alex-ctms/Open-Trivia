import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://backend:5000/api';

export default function RequestCardModal({ onClose }) {
    const [formData, setFormData] = useState({
        categoryName: 'General Knowledge',
        text: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A',
        complexity: 'medium'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/requests/add-question`, {
                categoryName: formData.categoryName,
                text: formData.text,
                options: {
                    a: formData.optionA,
                    b: formData.optionB,
                    c: formData.optionC,
                    d: formData.optionD
                },
                correctAnswer: formData.correctAnswer,
                complexity: formData.complexity
            });
            alert("Thank you! Your question has been submitted to the admins for approval.");
            onClose();
        } catch (err) {
            alert("Failed to submit. Please try again.");
            console.error(err);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="card" style={{ width: '90%', maxWidth: '600px', position: 'relative' }}>
                <button onClick={onClose} style={{ float: 'right', background: 'none', border: 'none', fontSize: '24px' }}>×</button>
                <h2>📝 Request to Add a Trivia Card</h2>
                <p style={{ color: 'var(--text-color)' }}>Suggest a question. An Admin must approve it before it appears in the game.</p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>Category</label>
                    <input 
                        type="text" 
                        value={formData.categoryName}
                        onChange={e => setFormData({...formData, categoryName: e.target.value})}
                        placeholder="e.g. Space, History, Coding"
                        required
                        className="btn"
                    />
                    
                    <label>Question</label>
                    <textarea 
                        value={formData.text}
                        onChange={e => setFormData({...formData, text: e.target.value})}
                        placeholder="What is the question?"
                        required
                        className="btn"
                        style={{ minHeight: '80px' }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input 
                            value={formData.optionA} 
                            onChange={e => setFormData({...formData, optionA: e.target.value})}
                            placeholder="Option A" 
                            required 
                            className="btn" 
                        />
                        <input 
                            value={formData.optionB} 
                            onChange={e => setFormData({...formData, optionB: e.target.value})}
                            placeholder="Option B" 
                            required 
                            className="btn" 
                        />
                        <input 
                            value={formData.optionC} 
                            onChange={e => setFormData({...formData, optionC: e.target.value})}
                            placeholder="Option C" 
                            required 
                            className="btn" 
                        />
                        <input 
                            value={formData.optionD} 
                            onChange={e => setFormData({...formData, optionD: e.target.value})}
                            placeholder="Option D" 
                            required 
                            className="btn" 
                        />
                    </div>

                    <div>
                        <strong>Correct Answer:</strong>
                        {['A','B','C','D'].map(c => (
                            <label key={c} style={{ cursor: 'pointer', marginLeft: '10px' }}>
                                <input 
                                    type="radio" 
                                    name="correct" 
                                    value={c} 
                                    checked={formData.correctAnswer === c} 
                                    onChange={e => setFormData({...formData, correctAnswer: e.target.value})}
                                /> {c}
                            </label>
                        ))}
                    </div>

                    <div>
                        <label>Complexity: </label>
                        <select 
                            value={formData.complexity}
                            onChange={e => setFormData({...formData, complexity: e.target.value})}
                            className="btn"
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }}>
                        Submit for Approval
                    </button>
                </form>
            </div>
        </div>
    );
}
