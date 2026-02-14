import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

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
            const res = await axios.post(`${API_URL}/requests/add-question`, {
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
            console.error("Submission error:", err);
            alert("Failed to submit. The admin might have disabled this feature.");
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="card" style={{ 
                width: '90%', 
                maxWidth: '600px', 
                position: 'relative',
                padding: '30px'
            }}>
                <button 
                    onClick={onClose} 
                    style={{ 
                        float: 'right', 
                        background: 'none', 
                        border: 'none', 
                        fontSize: '28px', 
                        cursor: 'pointer',
                        color: '#888'
                    }}
                >
                    &times;
                </button>
                <h2 style={{ marginBottom: '20px' }}>📝 Request to Add a Trivia Card</h2>
                <p style={{ color: 'var(--text-color)', marginBottom: '20px' }}>
                    Suggest a question. An Admin must approve it before it appears in the game.
                </p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category Name</label>
                        <input 
                            type="text" 
                            value={formData.categoryName}
                            onChange={e => setFormData({...formData, categoryName: e.target.value})}
                            placeholder="e.g. Space, History, Coding"
                            required
                            className="btn"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Question Text</label>
                        <textarea 
                            value={formData.text}
                            onChange={e => setFormData({...formData, text: e.target.value})}
                            placeholder="What is the question?"
                            required
                            className="btn"
                            style={{ width: '100%', minHeight: '100px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label>Option A</label>
                            <input 
                                value={formData.optionA} 
                                onChange={e => setFormData({...formData, optionA: e.target.value})}
                                placeholder="A" 
                                required 
                                className="btn" 
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label>Option B</label>
                            <input 
                                value={formData.optionB} 
                                onChange={e => setFormData({...formData, optionB: e.target.value})}
                                placeholder="B" 
                                required 
                                className="btn" 
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label>Option C</label>
                            <input 
                                value={formData.optionC} 
                                onChange={e => setFormData({...formData, optionC: e.target.value})}
                                placeholder="C" 
                                required 
                                className="btn" 
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label>Option D</label>
                            <input 
                                value={formData.optionD} 
                                onChange={e => setFormData({...formData, optionD: e.target.value})}
                                placeholder="D" 
                                required 
                                className="btn" 
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div>
                        <strong>Correct Answer:</strong>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                            {['A','B','C','D'].map(c => (
                                <label key={c} style={{ cursor: 'pointer' }}>
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
                    </div>

                    <div>
                        <label style={{ marginRight: '10px' }}>Complexity: </label>
                        <select 
                            value={formData.complexity}
                            onChange={e => setFormData({...formData, complexity: e.target.value})}
                            className="btn"
                            style={{ padding: '8px' }}
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
