import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function Game() {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [result, setResult] = useState(null);
  const [reportMessage, setReportMessage] = useState('');

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/game/next`);
      if (!res.data) {
          setQuestion(null);
          return;
      }
      setQuestion(res.data);
      // Mock stats update
      setGuesses(prev => {
          const newGuesses = { ...prev };
          return newGuesses;
      });
      setResult(null);
    } catch (err) {
      alert("No questions available yet. Ask an admin to add some!");
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleAnswer = async (optionChar) => {
    if (!question || result) return;
    
    try {
      const res = await axios.post(`${API_URL}/game/submit`, {
        questionId: question.id,
        selectedAnswer: optionChar
      });
      
      setResult({
        isCorrect: res.data.isCorrect,
        correctAnswer: res.data.correctAnswer
      });

      // Simulate "Ratio of guesses" update
      setGuesses(prev => {
          const newGuesses = { ...prev };
          newGuesses[optionChar] += 20; // Increase selected percentage
          // Normalize others
          return newGuesses;
      });

      setTimeout(fetchQuestion, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReport = async () => {
      try {
          await axios.post(`${API_URL}/game/submit`, {
              questionId: question.id,
              selectedAnswer: 'X',
              isReport: true
          });
          setReportMessage("Thanks! This question has been flagged for review.");
      } catch (err) {
          setReportMessage("Error reporting question.");
      }
  };

  if (loading) return <div className="card" style={{ textAlign: 'center' }}>Loading Question...</div>;
  
  if (!question) return (
      <div className="card">
          <h3>No Questions Available</h3>
          <p>Admins need to add trivia questions before you can play.</p>
          <button onClick={fetchQuestion} className="btn btn-primary">Retry</button>
      </div>
  );

  return (
    <div className="card" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ 
                padding: '5px 12px', 
                borderRadius: '20px', 
                backgroundColor: '#e2e6ea',
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'var(--text-color)'
            }}>
                Category: {question.category}
            </span>
            <span style={{ 
                padding: '5px 12px', 
                borderRadius: '20px',
                backgroundColor: '#fff3cd',
                color: '#856404',
                fontSize: '14px',
                fontWeight: 'bold'
            }}>
                Difficulty: {question.complexity.toUpperCase()}
            </span>
        </div>

        <h2 style={{ marginTop: '20px', color: 'var(--text-color)' }}>{question.text}</h2>

        <div style={{ marginBottom: '20px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
            <small style={{ color: 'var(--text-color)' }}>Current Guess Ratios (Mock Data)</small>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {['A','B','C','D'].map(char => (
                    <div key={char} style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', marginBottom: '2px' }}>Option {char}</div>
                        <div style={{ 
                            width: '100%', 
                            backgroundColor: 'var(--border-color)', 
                            borderRadius: '5px', 
                            height: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                width: `${guesses[char] || 25}%`, 
                                backgroundColor: 'var(--btn-primary)', 
                                height: '100%' 
                            }}></div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '10px', marginTop: '2px' }}>{guesses[char] || 25}%</div>
                    </div>
                ))}
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {question.options.map((opt) => (
                <button 
                    key={opt.char} 
                    className="btn"
                    style={{ 
                        backgroundColor: result ? (opt.char === result.correctAnswer ? '#28a745' : '#dc3545') : 'var(--card-bg)',
                        color: result ? 'white' : 'var(--text-color)',
                        border: '1px solid var(--border-color)',
                        padding: '15px'
                    }}
                    onClick={() => handleAnswer(opt.char)}
                    disabled={!!result}
                >
                    <strong>{opt.char})</strong> {opt.text}
                </button>
            ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {result && (
                <h3 style={{ margin: 0, color: result.isCorrect ? 'green' : 'red', fontSize: '1.2rem' }}>
                    {result.isCorrect ? "🎉 Correct! +Points" : "❌ Wrong! Correct was " + result.correctAnswer}
                </h3>
            )}
            <button className="btn" style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 20px' }} onClick={handleReport}>
                ⚠ Report Question
            </button>
        </div>
        {reportMessage && <p style={{ color: 'orange', marginTop: '10px', fontStyle: 'italic' }}>{reportMessage}</p>}
    </div>
  );
}
