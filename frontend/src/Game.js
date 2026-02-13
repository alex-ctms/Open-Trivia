import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function Game({ user }) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState({ A: 0, B: 0, C: 0, D: 0 }); // Mock ratio
  const [result, setResult] = useState(null);
  const [reportMessage, setReportMessage] = useState('');

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/game/next`);
      setQuestion(res.data);
      setGuesses({ A: 20, B: 30, C: 25, D: 25 }); // Reset mock stats
      setResult(null);
    } catch (err) {
      alert("No questions available yet. Ask an admin to add some!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleAnswer = async (optionChar) => {
    if (!question) return;
    
    try {
      const res = await axios.post(`${API_URL}/game/submit`, {
        questionId: question.id,
        selectedAnswer: optionChar
      });
      
      setResult({
        isCorrect: res.data.isCorrect,
        correctAnswer: res.data.correctAnswer
      });

      // Update mock stats to show "Ratio of guesses" change
      setGuesses(prev => {
          const newGuesses = { ...prev };
          newGuesses[optionChar] += 15; // Increase percentage for selected
          return newGuesses;
      });

      // Refresh after a delay
      setTimeout(fetchQuestion, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReport = async () => {
      try {
          await axios.post(`${API_URL}/game/submit`, {
              questionId: question.id,
              selectedAnswer: 'X', // Dummy
              isReport: true
          });
          setReportMessage("Thanks! This question has been flagged for review.");
      } catch (err) {
          setReportMessage("Error reporting question.");
      }
  };

  if (loading) return <div className="card">Loading Question...</div>;

  return (
    <div className="card">
      {question && (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ 
                    padding: '5px 10px', 
                    borderRadius: '20px', 
                    backgroundColor: '#e2e6ea',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    Category: {question.category}
                </span>
                <span style={{ 
                    padding: '5px 10px', 
                    borderRadius: '20px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    Complexity: {question.complexity.toUpperCase()}
                </span>
            </div>

            <h2 style={{ marginTop: '20px' }}>{question.text}</h2>

            {/* Mock Ratio Display (The "Report" Logic context) */}
            <div style={{ marginBottom: '20px', borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
                <small className="text-muted">Current User Guess Ratios (Mock Data)</small>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                    {['A','B','C','D'].map(char => (
                        <div key={char} style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', marginBottom: '2px' }}>Option {char}</div>
                            <div style={{ 
                                width: '100%', 
                                backgroundColor: '#e9ecef', 
                                borderRadius: '5px', 
                                height: '10px',
                                overflow: 'hidden'
                            }}>
                                <div style={{ 
                                    width: `${guesses[char]}%`, 
                                    backgroundColor: '#007bff', 
                                    height: '100%' 
                                }}></div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '10px', marginTop: '2px' }}>{guesses[char]}%</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {question.options.map((opt) => (
                    <button 
                        key={opt.char} 
                        className="btn btn-block"
                        style={{ 
                            backgroundColor: result ? (opt.char === result.correctAnswer ? '#28a745' : '#dc3545') : 'white',
                            color: result ? 'white' : 'black',
                            border: '1px solid #ccc'
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
                    <h3 style={{ margin: 0, color: result.isCorrect ? 'green' : 'red' }}>
                        {result.isCorrect ? "Correct! +Points" : "Wrong! Better luck next time."}
                    </h3>
                )}
                <button className="btn btn-danger" onClick={handleReport}>
                    ⚠ Report Question
                </button>
            </div>
            {reportMessage && <p style={{ color: 'orange', marginTop: '10px' }}>{reportMessage}</p>}
        </>
      )}
    </div>
  );
}
