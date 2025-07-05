import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:5000/api';
const AUTH_BASE = 'http://localhost:5000/auth';

interface User {
  _id: string;
  name: string;
  email: string;
  picture: string;
  fikaPoints: number;
  referralCode: string;
}

const LoginPage: React.FC = () => {
  return (
    <div className="login-container">
      <h1 className="main-title">Quiz Learning Platform</h1>
      <h2 className="subtitle">Sign in to continue</h2>
      <button 
        className="login-btn"
        onClick={() => window.location.href = `${AUTH_BASE}/google`}
      >
        Sign in with Google
      </button>
    </div>
  );
};

interface QuizScore {
  chapter: number;
  score: number;
  date: string;
}

interface UserProgress {
  quizScores: QuizScore[];
  fikaPoints: number;
  unlockedModules: Record<string, number[]>;
}

const ChapterModules: React.FC = () => {
  const { chapter } = useParams<{ chapter: string }>();
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get<UserProgress>(`${API_BASE}/user/progress`, { withCredentials: true })
      .then(res => {
        setUserProgress(res.data);
        setLoading(false);
      }).catch(err => {
        setLoading(false);
      });
  }, []);

  const handleUnlock = async (module: number) => {
    if (userProgress && userProgress.fikaPoints < 10) {
      setToast('Oops you have less fika points! Do refer your friend and earn more points! Happy learning!');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      const response = await axios.post<{ newTotalPoints: number, unlockedModules: Record<string, number[]> }>(`${API_BASE}/unlock/${chapter}/${module}`, {}, { withCredentials: true });
      setUserProgress(prev => prev ? { ...prev, fikaPoints: response.data.newTotalPoints, unlockedModules: response.data.unlockedModules } : null);
      setToast(`Module ${module} unlocked!`);
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Failed to unlock module');
      setTimeout(() => setToast(null), 2000);
    }
  };

  const getModuleStatus = (module: number) => {
    if (!userProgress) return 'locked';
    const unlocked = userProgress.unlockedModules?.[chapter ?? ''] || [1];
    if (unlocked.includes(module)) return 'unlocked';
    return 'locked';
  };

  if (loading) return <div className="chapter-selection-container"><h2>Loading...</h2></div>;

  return (
    <div className="chapter-selection-container">
      <h1 className="main-title">Chapter {chapter} Modules</h1>
      {userProgress && (
        <div className="user-stats">
          <p>Your Fika Points: {userProgress.fikaPoints}</p>
        </div>
      )}
      <div className="modules-grid">
        {[1, 2, 3, 4, 5].map(module => {
          const status = getModuleStatus(module);
          return (
            <div key={module} className={`module-item ${status}`}>
              {status === 'unlocked' ? (
                <button
                  className="module-btn unlocked"
                  onClick={() => navigate(`/quiz/${chapter}/${module}`)}
                >
                  Module {module} <span className="tick">✔</span>
                </button>
              ) : (
                <div className="module-locked">
                  <div className="lock-icon">🔒</div>
                  <p>Module {module}</p>
                  <p className="unlock-cost">10 Fika Points</p>
                  <button
                    className="unlock-btn"
                    onClick={() => handleUnlock(module)}
                    disabled={!userProgress || userProgress.fikaPoints < 10}
                  >
                    Unlock
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {toast && <div className="toast-pop">{toast}</div>}
    </div>
  );
};

const ChapterSelection: React.FC = () => {
  const [chapters, setChapters] = useState<number[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [referral, setReferral] = useState<{ referralCode: string; referralCount: number; referralPoints: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get<{ chapters: number[] }>(`${API_BASE}/chapters`),
      axios.get<{ user: User }>(`${AUTH_BASE}/user`, { withCredentials: true }),
      axios.get<{ referralCode: string; referralCount: number; referralPoints: number }>(`${API_BASE}/user/referrals`, { withCredentials: true })
    ]).then(([chaptersRes, userRes, referralRes]) => {
      setChapters(chaptersRes.data.chapters);
      setUser(userRes.data.user);
      setReferral(referralRes.data);
      setLoading(false);
    }).catch(() => {
      navigate('/login');
    });
  }, [navigate]);

  const handleCopyReferral = () => {
    if (referral) {
      const link = `${window.location.origin.replace('3000', '5000')}/auth/google?ref=${referral.referralCode}`;
      navigator.clipboard.writeText(link);
      setToast('Referral link copied!');
      setTimeout(() => setToast(null), 2000);
    }
  };

  if (loading) return <div className="chapter-selection-container"><h2>Loading...</h2></div>;

  return (
    <div className="chapter-selection-container">
      <div className="chapter-header-row">
        {user && (
          <div className="user-info-top">
            <img src={user.picture} alt={user.name} className="user-avatar" />
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-points">Fika Points: {user.fikaPoints}</div>
            </div>
          </div>
        )}
        {referral && (
          <div className="referral-box">
            <div className="referral-msg">Want more points? Refer and earn if your friend signs up!</div>
            <button className="referral-link-btn" onClick={handleCopyReferral}>Copy Referral Link</button>
            <div className="referral-link">{window.location.origin.replace('3000', '5000')}/auth/google?ref={referral.referralCode}</div>
            <div className="referral-stats">Referrals: {referral.referralCount} | Points from referrals: {referral.referralPoints}</div>
          </div>
        )}
      </div>
      <h1 className="main-title">Quiz Learning Platform</h1>
      <h2 className="subtitle">Select a Chapter</h2>
      <div className="chapter-list-vertical">
        {chapters.map(chap => (
          <button
            key={chap}
            className="chapter-list-btn"
            onClick={() => navigate(`/modules/${chap}`)}
          >
            Chapter {chap}
          </button>
        ))}
      </div>
      {toast && <div className="toast-pop">{toast}</div>}
    </div>
  );
};

interface Question {
  _id: string;
  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  answer: string;
}

const QuizPage: React.FC = () => {
  const { chapter, module } = useParams<{ chapter: string; module: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [showScore, setShowScore] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const scoreSaved = useRef(false);

  useEffect(() => {
    setLoading(true);
    axios.get<{ questions: Question[] }>(`${API_BASE}/questions/${chapter}/${module}`, { withCredentials: true }).then(res => {
      setQuestions(res.data.questions);
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching questions:', err);
      setLoading(false);
    });
  }, [chapter, module]);

  const handleSelect = (option: string) => {
    setAnswers({ ...answers, [current]: option });
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setShowScore(true);
    }
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const saveScore = async (score: number) => {
    try {
      const response = await axios.post<{ pointsEarned: number }>(`${API_BASE}/quiz/score`, {
        chapter: Number(chapter),
        score,
        totalQuestions: questions.length
      }, { withCredentials: true });
      
      setPointsEarned(response.data.pointsEarned);
    } catch (err) {
      console.error('Error saving score:', err);
    }
  };

  if (loading) return <div className="quiz-page-container"><h2>Loading...</h2></div>;
  if (!questions.length) return <div className="quiz-page-container"><h2>No questions found.</h2></div>;

  if (showScore && !reviewMode) {
    let score = 0;
    questions.forEach((q, idx) => {
      const opt = answers[idx] as 'A' | 'B' | 'C' | 'D';
      if (opt && q[opt] === q.answer) score++;
    });
    
    // Save score only once
    if (pointsEarned === 0 && !scoreSaved.current) {
      saveScore(score);
      scoreSaved.current = true;
    }
    
    let emoji = '😢';
    if (score >= 8) emoji = '😄';
    else if (score >= 4) emoji = '🙂';
    
    return (
      <div className="quiz-page-container">
        <h2>Quiz Complete!</h2>
        <div className="score-block">Your Score: {score} / {questions.length}</div>
        {pointsEarned > 0 && (
          <div className="points-earned">+{pointsEarned} Fika Points Earned!</div>
        )}
        <div style={{ fontSize: '3rem', marginTop: '1em' }}>{emoji}</div>
        <button className="nav-btn colored" style={{ marginTop: '2em' }} onClick={() => { setReviewMode(true); setReviewIdx(0); }}>See Answers</button>
      </div>
    );
  }

  if (showScore && reviewMode) {
    const q = questions[reviewIdx];
    const userOpt = answers[reviewIdx] as 'A' | 'B' | 'C' | 'D';
    const correctOpt = (['A', 'B', 'C', 'D'] as const).find(opt => q[opt] === q.answer);
    return (
      <div className="quiz-page-container">
        <h2>Review Answers</h2>
        <div className="question-block">
          <div className="question-text">Q{reviewIdx + 1}. {q.question}</div>
          <div className="options-list-vertical">
            {(['A', 'B', 'C', 'D'] as const).map(opt => {
              let btnClass = 'option-btn-vertical';
              if (userOpt === opt && q[opt] === q.answer) btnClass += ' correct';
              else if (userOpt === opt) btnClass += ' wrong';
              else if (correctOpt === opt) btnClass += ' correct';
              return (
                <button key={opt} className={btnClass} disabled>
                  {opt}. {q[opt]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="quiz-nav">
          <button
            className="nav-btn colored"
            onClick={() => setReviewIdx(i => i - 1)}
            disabled={reviewIdx === 0}
          >Previous</button>
          <button
            className="nav-btn colored"
            onClick={() => setReviewIdx(i => i + 1)}
            disabled={reviewIdx === questions.length - 1}
          >Next</button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const options = ['A', 'B', 'C', 'D'] as const;
  const answered = answers[current] !== undefined;

  return (
    <div className="quiz-page-container">
      <h2>Chapter {chapter} Quiz</h2>
      <div className="question-block">
        <div className="question-text">Q{current + 1}. {q.question}</div>
        <div className="options-list-vertical">
          {options.map(opt => (
            <button
              key={opt}
              className={`option-btn-vertical${answers[current] === opt ? ' selected' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {opt}. {q[opt]}
            </button>
          ))}
        </div>
      </div>
      <div className="quiz-nav">
        <button
          className="nav-btn colored"
          onClick={handlePrev}
          disabled={current === 0}
        >Previous</button>
        <button
          className="nav-btn colored"
          onClick={handleNext}
          disabled={!answered}
        >{current === questions.length - 1 ? 'Submit' : 'Next'}</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/chapters" element={<ChapterSelection />} />
      <Route path="/modules/:chapter" element={<ChapterModules />} />
      <Route path="/quiz/:chapter/:module" element={<QuizPage />} />
      <Route path="/" element={<LoginPage />} />
    </Routes>
  );
};

export default App;
