import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RequestCardModal from './RequestCardModal';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export default function Game() {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track guesses by the actual option char (A, B, C, D)
  const [guessCounts, setGuessCounts] = useState({});
  const [result, setResult] = useState(null);
  const [reportMessage, setReportMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [answered, setAnswered] = useState(null); // which char user clicked

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/game/next`);
      if (!res.data || !res.data.id) {
        setQuestion(null);
        return;
      }
      setQuestion(res.data);
      // Reset guess counts to equal 25% each for display
      setGuessCounts({ A: 25, B: 25, C: 25, D: 25 });
      setResult(null);
      setAnswered(null);
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

  const handleAnswer = async (optionChar) => {
    if (!question || result || answered) return;

    setAnswered(optionChar);

    // Optimistically update guess ratio display
    setGuessCounts(prev => {
      const total = Object.values(prev).reduce((a, b) => a + b, 0) + 10;
      const updated = { ...prev, [optionChar]: (prev[optionChar] || 25) + 10 };
      // Normalize to percentages
      const normalized = {};
      Object.keys(updated).forEach(k => {
        normalized[k] = Math.round((updated[k] / total) * 100);
      });
      return normalized;
    });

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/game/submit`,
        { questionId: question.id, selectedAnswer: optionChar },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );

      setResult({
        isCorrect: res.data.isCorrect,
        correctAnswer: res.data.correctAnswer
      });

      setTimeout(() => {
        fetchQuestion();
      }, 3000);
    } catch (err) {
      console.error('Submit error:', err);
      // Show error but don't fake a result - let user try again
      setAnswered(null);
      alert('Error submitting answer. Please try again.');
    }
  };

  const handleReport = async () => {
    if (!question) return;
    try {
      await axios.post(`${API_URL}/game/report`, { questionId: question.id, reason: 'User report' });
      setReportMessage("Question reported successfully.");
    } catch (err) {
      setReportMessage("Question flagged for review.");
    }
  };

  const getButtonStyle = (optChar) => {
    const base = {
      border: '1px solid var(--border-color)',
      padding: '15px',
      fontWeight: 'bold',
      cursor: answered ? 'default' : 'pointer',
      transition: 'all 0.3s ease'
    };

    if (!result) {
      // Before answering
      return {
        ...base,
        backgroundColor: answered === optChar ? '#6c757d' : 'var(--card-bg)',
        color: answered === optChar ? 'white' : 'var(--text-color)',
      };
    }

    // After answering - show correct/wrong
    if (optChar === result.correctAnswer) {
      return { ...base, backgroundColor: '#28a745', color: 'white' };
    }
    if (optChar === answered && optChar !== result.correctAnswer) {
      return { ...base, backgroundColor: '#dc3545', color: 'white' };
    }
    return { ...base, backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', opacity: 0.6 };
  };

  // Loading state
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h3>Loading Question...</h3>
      </div>
    );
  }

  // No questions available
  if (!question) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📝</div>
        <h2>No Questions Available Yet!</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Ask an admin to add some trivia questions to get started.
        </p>
        <button onClick={fetchQuestion} className="btn btn-primary" style={{ padding: '12px 30px' }}>
          🔄 Retry
        </button>
      </div>
    );
  }

  const complexityColors = { easy: '#28a745', medium: '#ffc107', hard: '#dc3545' };

  return (
    <div className="card" style={{ position: 'relative' }}>

      {/* Category + Difficulty header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <span style={{
          padding: '5px 12px',
          borderRadius: '20px',
          backgroundColor: '#e2e6ea',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          📁 {question?.category || 'General'}
        </span>
        <span style={{
          padding: '5px 12px',
          borderRadius: '20px',
          backgroundColor: complexityColors[question?.complexity] || '#ffc107',
          color: question?.complexity === 'medium' ? '#856404' : 'white',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          {question?.complexity?.toUpperCase() || 'MEDIUM'}
        </span>
      </div>

      {/* Question text */}
      <h2 style={{ marginTop: '10px', marginBottom: '25px', color: 'var(--text-color)', lineHeight: '1.4' }}>
        {question.text}
      </h2>

      {/* Guess ratio bars - keyed by actual option char */}
      <div style={{ marginBottom: '20px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
        <small style={{ color: 'var(--text-color)', opacity: 0.7 }}>Community Guess Ratios</small>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          {question.options.map(opt => {
            const pct = guessCounts[opt.char] || 25;
            return (
              <div key={opt.char} style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', marginBottom: '2px', color: 'var(--text-color)' }}>
                  {opt.char}
                </div>
                <div style={{
                  width: '100%',
                  backgroundColor: 'var(--border-color)',
                  borderRadius: '5px',
                  height: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: result && opt.char === result.correctAnswer ? '#28a745' : 'var(--btn-primary)',
                    height: '100%',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px', marginTop: '2px', color: 'var(--text-color)' }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Answer buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {question.options.map((opt) => (
          <button
            key={opt.char}
            className="btn"
            style={getButtonStyle(opt.char)}
            onClick={() => handleAnswer(opt.char)}
            disabled={!!answered}
          >
            <strong>{opt.char})</strong> {opt.text}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          borderRadius: '8px',
          backgroundColor: result.isCorrect ? '#d4edda' : '#f8d7da',
          color: result.isCorrect ? '#155724' : '#721c24',
          textAlign: 'center',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          border: result.isCorrect ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
        }}>
          {result.isCorrect
            ? '🎉 Correct! +10 points! Next question in 3 seconds...'
            : `❌ Wrong! The correct answer was ${result.correctAnswer}. Next question in 3 seconds...`}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          className="btn"
          style={{ backgroundColor: 'var(--header-bg)', color: 'white', padding: '8px 15px' }}
          onClick={() => setShowRequestModal(true)}
        >
          📝 Suggest a Question
        </button>
        <button
          className="btn"
          style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 20px' }}
          onClick={handleReport}
        >
          ⚠ Report
        </button>
      </div>

      {reportMessage && (
        <p style={{ color: 'orange', marginTop: '10px', fontStyle: 'italic', textAlign: 'center' }}>
          {reportMessage}
        </p>
      )}

      {showRequestModal && (
        <RequestCardModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}
