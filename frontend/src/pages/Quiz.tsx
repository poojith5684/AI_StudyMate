import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Brain, ArrowLeft, Target } from 'lucide-react';
import { quizApi } from '../services/api';
import type { QuizQuestion, QuizResult, Difficulty } from '../types';

type Stage = 'setup' | 'taking' | 'result';

export default function Quiz() {
  const { courseId } = useParams<{ courseId: string }>();

  const [stage, setStage] = useState<Stage>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const generate = async () => {
    if (!courseId) return;

    setLoading(true);

    try {
      const res = await quizApi.generate({
        course_id: courseId,
        difficulty,
        question_count: count,
        topic: topic || undefined,
      });

      setQuizId(res.quiz_id);
      setQuestions(res.questions);
      setAnswers({});
      setCurrent(0);
      setStage('taking');
    } catch (err: any) {
      alert(
        err.message ||
          'Failed to generate quiz. Upload materials and set AI_API_KEY first.'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qid: string, idx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: idx,
    }));
  };

  const submit = async () => {
    if (!courseId) return;

    setLoading(true);

    try {
      const res = await quizApi.submit({
        quiz_id: quizId,
        course_id: courseId,
        answers,
      });

      setResult(res);
      setStage('result');
    } catch (err: any) {
      alert(err.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  const q = questions[current];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
      }}
    >
      {/* Navigation */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <Link
          to={`/courses/${courseId}`}
          style={{
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} />
          Back
        </Link>

        <span style={{ color: '#334155' }}>|</span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
          }}
        >
          <Target size={20} color="#06b6d4" />
          Quiz
        </div>
      </nav>

      <main
        style={{
          maxWidth: 700,
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        {/* =====================================================
            SETUP
        ====================================================== */}

        {stage === 'setup' && (
          <div className="card">
            <h1
              style={{
                marginTop: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Brain size={28} color="#818cf8" />
              Generate Quiz
            </h1>

            <p
              style={{
                color: '#94a3b8',
                marginBottom: 24,
              }}
            >
              Questions are generated from your uploaded study materials.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Topic */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  Topic (optional)
                </label>

                <input
                  className="input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. PN Junction, Semiconductors"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  Difficulty
                </label>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor:
                          difficulty === d ? '#4f46e5' : '#334155',
                        background:
                          difficulty === d
                            ? 'rgba(79,70,229,0.2)'
                            : 'transparent',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of questions */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  Number of questions
                </label>

                <select
                  className="input"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generate */}
              <button
                className="btn-primary"
                onClick={generate}
                disabled={loading}
                style={{
                  marginTop: 8,
                }}
              >
                {loading ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        )}

        {/* =====================================================
            TAKING QUIZ
        ====================================================== */}

        {stage === 'taking' && q && (
          <div className="card">
            {/* Question info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 16,
                fontSize: 14,
                color: '#94a3b8',
              }}
            >
              <span>
                Question {current + 1} of {questions.length}
              </span>

              <span
                style={{
                  textTransform: 'capitalize',
                }}
              >
                {q.difficulty} · {q.topic}
              </span>
            </div>

            {/* Question */}
            <h2
              style={{
                fontSize: '1.2rem',
                margin: '0 0 1.5rem',
                lineHeight: 1.45,
              }}
            >
              {q.question}
            </h2>

            {/* Options */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => selectAnswer(q.id, idx)}
                  style={{
                    textAlign: 'left',
                    padding: '0.85rem 1rem',
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor:
                      answers[q.id] === idx ? '#4f46e5' : '#334155',
                    background:
                      answers[q.id] === idx
                        ? 'rgba(79,70,229,0.2)'
                        : '#0f172a',
                    color: '#e2e8f0',
                    fontSize: 15,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      marginRight: 10,
                      color: '#818cf8',
                    }}
                  >
                    {String.fromCharCode(65 + idx)}.
                  </span>

                  {opt}
                </button>
              ))}
            </div>

            {/* Navigation buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 24,
              }}
            >
              <button
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'transparent',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  opacity: current === 0 ? 0.4 : 1,
                }}
              >
                Previous
              </button>

              {current < questions.length - 1 ? (
                <button
                  className="btn-primary"
                  onClick={() => setCurrent((c) => c + 1)}
                  disabled={answers[q.id] === undefined}
                >
                  Next
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={submit}
                  disabled={
                    loading ||
                    Object.keys(answers).length < questions.length
                  }
                >
                  {loading ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* =====================================================
            RESULT
        ====================================================== */}

        {stage === 'result' && result && (
          <div className="card">
            <h1
              style={{
                marginTop: 0,
                textAlign: 'center',
              }}
            >
              Quiz Results
            </h1>

            {/* Score */}
            <div
              style={{
                textAlign: 'center',
                margin: '1.5rem 0',
              }}
            >
              <div
                style={{
                  fontSize: '3rem',
                  fontWeight: 800,
                  color:
                    result.accuracy >= 70
                      ? '#34d399'
                      : result.accuracy >= 40
                        ? '#fbbf24'
                        : '#f87171',
                }}
              >
                {result.score}/{result.total}
              </div>

              <div
                style={{
                  color: '#94a3b8',
                }}
              >
                {result.accuracy}% accuracy
              </div>
            </div>

            {/* Topic Breakdown */}
            {result.topic_breakdown.length > 0 && (
              <div
                style={{
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    fontSize: '1rem',
                    marginBottom: 10,
                  }}
                >
                  Topic Performance
                </h3>

                {result.topic_breakdown.map((t) => (
                  <div
                    key={t.topic}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #1e293b',
                      fontSize: 14,
                    }}
                  >
                    <span>{t.topic}</span>

                    <span
                      style={{
                        color:
                          t.accuracy >= 70
                            ? '#34d399'
                            : t.accuracy >= 40
                              ? '#fbbf24'
                              : '#f87171',
                      }}
                    >
                      {t.correct}/{t.total} ({t.accuracy}%)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Weak Topics */}
            {result.weak_topics.length > 0 && (
              <div
                style={{
                  background: 'rgba(248,113,113,0.1)',
                  border:
                    '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 10,
                  padding: '0.85rem 1rem',
                  marginBottom: 16,
                  fontSize: 14,
                }}
              >
                <strong>Weak topics:</strong>{' '}
                {result.weak_topics.join(', ')}. Review these and try an
                Easy quiz.
              </div>
            )}

            {/* Strong Topics */}
            {result.strong_topics.length > 0 && (
              <div
                style={{
                  background: 'rgba(52,211,153,0.1)',
                  border:
                    '1px solid rgba(52,211,153,0.3)',
                  borderRadius: 10,
                  padding: '0.85rem 1rem',
                  marginBottom: 16,
                  fontSize: 14,
                }}
              >
                <strong>Strong topics:</strong>{' '}
                {result.strong_topics.join(', ')}
              </div>
            )}

            {/* Bottom buttons */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                className="btn-primary"
                onClick={() => {
                  setStage('setup');
                  setResult(null);
                  setQuestions([]);
                  setAnswers({});
                  setCurrent(0);
                }}
                style={{
                  flex: 1,
                }}
              >
                New Quiz
              </button>

              <Link
                to={`/courses/${courseId}/progress`}
                className="btn-primary"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                View Progress
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}