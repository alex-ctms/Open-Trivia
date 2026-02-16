import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RequestCardModal from './RequestCardModal';

// Using the same API configuration as your App.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Game() {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [result, setResult] = useState(null);
  const [reportMessage, setReportMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Fetch the next random question from the backend
  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/game/next`);
      if (!res.data || !res.data.id) {
        setQuestion(null);
        return;
      }
      setQuestion(res.data);
      // Reset mock ratios for the new question
      setGuesses({ A: 25, B: 25, C: 25, D: 25 });
      setResult(null);
      setReportMessage('');
    } catch (err) {
      console.error("Error fetching question:", err);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleAnswer = async (choice) => {
    // FIX: Retrieve user from localStorage so 'userId' isn't undefined
    const storedUser = JSON.parse(localStorage.getItem('user'));
    
    try {
      // FIX: Assign the result to 'res' so it can be used below
      const res = await axios.post(`${API_URL}/game/submit`, {
        userId: storedUser?.id, 
        questionId: question?.id,
        selectedAnswer: choice
      });
      
      setResult({
        isCorrect: res.data.isCorrect,
        correctAnswer: res.data.correctAnswer
      });

      // Update the mock guess ratios
      setGuesses(prev => {
        const newGuesses = { ...prev };
        // FIX: Use 'choice' to match the function parameter
        newGuesses[choice] = (newGuesses[choice] || 0) + 25;
        return newGuesses;
      });

      // Wait 3 seconds so the user can see the result, then load next question
      setTimeout(() => {
        fetchQuestion();
      }, 3000);
    } catch (err) {
      console.error("Error submitting answer:", err);
      alert("Error submitting answer. Please check your connection.");
    }
  };

  const handleReport = async () => {
    try {
      // Using the report logic provided in your previous snippet
      await axios.post(`${API_URL}/game/submit`, {
        questionId: question.id,
        selectedAnswer: 'X',
        isReport: true
      });
      setReportMessage("Question reported successfully.");
    } catch (err) {
      console.error("Error reporting question:", err);
      setReportMessage("Error reporting question.");
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h3>Loading Question...</h3>
      </div>
    );
  }
  
  if (!question) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📝</div>
        <h2>No Questions Available Yet!</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Ask an admin to add some trivia questions to get started.
        </p>
        <button 
          onClick={fetchQuestion} 
          className="btn btn-primary"
          style={{ padding: '12px 30px' }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ 
                padding: '5px 12px', 
                borderRadius: '20px', 
                backgroundColor: '#e2e6ea',
                fontSize: '14px',
                fontWeight: 'bold'
            }}>
                Category: {question?.category?.toUpperCase() || 'UNKNOWN'}
            </span>
            <span style={{ 
                padding: '5px 12px', 
                borderRadius: '20px',
                backgroundColor: '#fff3cd',
                color: '#856404',
                fontSize: '14px',
                fontWeight: 'bold'
            }}>
                Difficulty: {question?.complexity?.toUpperCase() || 'UNKNOWN'}
            </span>
        </div>

        <h2 style={{ marginTop: '20px' }}>{question.text}</h2>

        <div style={{ marginBottom: '20px', borderTop: '1px dashed #ddd', paddingTop: '10px' }}>
            <small>Current Guess Ratios (Community Stats)</small>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {['A','B','C','D'].map(char => (
                    <div key={char} style={{ flex: 1 }}>
                        <div style={{ fontSize: '10px', marginBottom: '2px' }}>Option {char}</div>
                        <div style={{ 
                            width: '100%', 
                            backgroundColor: '#eee', 
                            borderRadius: '5px', 
                            height: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                width: `${guesses[char] > 100 ? 100 : guesses[char]}%`, 
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
            {question.options && question.options.map((opt) => (
                <button 
                    key={opt.char} 
                    className="btn"
                    style={{ 
                        backgroundColor: result ? (opt.char === result.correctAnswer ? '#28a745' : (opt.char === result.selectedChoice ? '#dc3545' : 'white')) : 'white',
                        color: result ? 'white' : 'black',
                        border: '1px solid #ddd',
                        padding: '15px',
                        fontWeight: 'bold',
                        cursor: result ? 'default' : 'pointer'
                    }}
                    onClick={() => handleAnswer(opt.char)}
                    disabled={!!result}
                >
                    <span>
                        <strong>{opt.char})</strong> {opt.text}
                    </span>
                </button>
            ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            {result && (
                <h3 style={{ margin: 0, color: result.isCorrect ? 'green' : 'red', fontSize: '1.2rem' }}>
                    {result.isCorrect ? "🎉 Correct! Well done." : "❌ Wrong! The correct answer was " + result.correctAnswer}
                </h3>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                 <button 
                    className="btn" 
                    style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 15px' }} 
                    onClick={() => setShowRequestModal(true)}
                >
                    📝 Suggest Question
                </button>
                
                <button 
                    className="btn" 
                    style={{ backgroundColor: '#dc3545', color: 'white', padding: '8px 20px' }} 
                    onClick={handleReport}
                >
                    ⚠ Report
                </button>
            </div>
        </div>
        
        {reportMessage && <p style={{ color: 'orange', marginTop: '10px', fontStyle: 'italic' }}>{reportMessage}</p>}
        
        {showRequestModal && (
            <RequestCardModal onClose={() => setShowRequestModal(false)} />
        )}
    </div>
  );
}
