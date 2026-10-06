import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { progressApi } from '../services/api';
import type { Progress } from '../types';

export default function ProgressPage() {
  const { courseId } = useParams<{ courseId: string }>();

  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    progressApi
      .get(courseId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          color: '#94a3b8',
          minHeight: '100vh',
          background: '#0f172a',
        }}
      >
        Loading progress...
      </div>
    );
  }

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
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
          }}
        >
          <BarChart3 size={20} color="#34d399" />
          Progress
        </div>
      </nav>

      {/* Main */}
      <main
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '2rem 1.5rem',
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: 24,
            fontSize: '2rem',
            fontWeight: 700,
          }}
        >
          Learning Progress
        </h1>

        {/* No quiz data */}
        {!data || data.quiz_count === 0 ? (
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '3rem',
            }}
          >
            <BarChart3
              size={48}
              color="#475569"
              style={{ marginBottom: 16 }}
            />

            <h3 style={{ marginBottom: 8 }}>
              No quiz data yet
            </h3>

            <p
              style={{
                color: '#94a3b8',
                marginBottom: 0,
              }}
            >
              Take a quiz to see your progress and get personalized
              recommendations.
            </p>

            <Link
              to={`/courses/${courseId}/quiz`}
              className="btn-primary"
              style={{
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: 16,
              }}
            >
              Take Quiz
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                className="card"
                style={{ textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: '#818cf8',
                  }}
                >
                  {data.overall_accuracy}%
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  Overall Accuracy
                </div>
              </div>

              <div
                className="card"
                style={{ textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                  }}
                >
                  {data.questions_attempted}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  Questions
                </div>
              </div>

              <div
                className="card"
                style={{ textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                  }}
                >
                  {data.quiz_count}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  Quizzes
                </div>
              </div>
            </div>

            {/* Topics */}
            {data.topics.length > 0 && (
              <div
                className="card"
                style={{ marginBottom: 20 }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Topic Performance
                </h3>

                {data.topics.map((t) => (
                  <div
                    key={t.topic}
                    style={{ marginBottom: 14 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      <span>{t.topic}</span>

                      <span
                        style={{
                          color:
                            t.accuracy >= 80
                              ? '#34d399'
                              : t.accuracy >= 50
                                ? '#fbbf24'
                                : '#f87171',
                        }}
                      >
                        {t.accuracy}% · {t.difficulty_level}
                      </span>
                    </div>

                    <div
                      style={{
                        height: 8,
                        background: '#1e293b',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${t.accuracy}%`,
                          background:
                            t.accuracy >= 80
                              ? '#34d399'
                              : t.accuracy >= 50
                                ? '#fbbf24'
                                : '#f87171',
                          borderRadius: 4,
                          transition: 'width 0.5s',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Strong / Weak */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {/* Strong */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <CheckCircle
                    size={18}
                    color="#34d399"
                  />

                  <strong>Strong</strong>
                </div>

                {data.strong_topics.length ? (
                  data.strong_topics.map((t) => (
                    <div
                      key={t}
                      style={{
                        fontSize: 14,
                        color: '#94a3b8',
                        marginBottom: 4,
                      }}
                    >
                      {t}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: '#64748b',
                    }}
                  >
                    None yet
                  </div>
                )}
              </div>

              {/* Weak */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    color="#f87171"
                  />

                  <strong>Needs Work</strong>
                </div>

                {data.weak_topics.length ? (
                  data.weak_topics.map((t) => (
                    <div
                      key={t}
                      style={{
                        fontSize: 14,
                        color: '#94a3b8',
                        marginBottom: 4,
                      }}
                    >
                      {t}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: '#64748b',
                    }}
                  >
                    None — great job!
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <TrendingUp
                  size={18}
                  color="#818cf8"
                />

                <strong>Recommendations</strong>
              </div>

              {data.recommendations.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.6rem 0',
                    borderBottom:
                      i < data.recommendations.length - 1
                        ? '1px solid #1e293b'
                        : 'none',
                    fontSize: 14,
                    color: '#cbd5e1',
                  }}
                >
                  {r}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}