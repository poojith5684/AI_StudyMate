import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Brain, ArrowLeft, Send, BookOpen } from 'lucide-react';
import { tutorApi } from '../services/api';
import type { ChatMessage, Citation } from '../types';

export default function Tutor() {
  const { courseId } = useParams<{ courseId: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [mode, setMode] = useState('detailed');

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, loading]);

  /**
   * Safely converts any API answer into displayable text.
   * Prevents [object Object].
   */
  const extractAnswerText = (answer: unknown): string => {
    if (typeof answer === 'string') {
      return answer;
    }

    if (answer === null || answer === undefined) {
      return 'The AI returned an empty response.';
    }

    if (typeof answer === 'object') {
      const obj = answer as Record<string, unknown>;

      if (typeof obj.answer === 'string') {
        return obj.answer;
      }

      if (typeof obj.content === 'string') {
        return obj.content;
      }

      if (typeof obj.text === 'string') {
        return obj.text;
      }

      if (typeof obj.response === 'string') {
        return obj.response;
      }

      if (
        obj.response &&
        typeof obj.response === 'object'
      ) {
        const nested = obj.response as Record<string, unknown>;

        if (typeof nested.answer === 'string') {
          return nested.answer;
        }

        if (typeof nested.content === 'string') {
          return nested.content;
        }

        if (typeof nested.text === 'string') {
          return nested.text;
        }
      }

      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return 'The AI returned a response that could not be displayed.';
      }
    }

    return String(answer);
  };

  /**
   * Safely extracts citations from different possible API response shapes.
   */
  const extractCitations = (res: any): Citation[] => {
    let citations = res?.citations;

    if (!citations && res?.answer?.citations) {
      citations = res.answer.citations;
    }

    if (!Array.isArray(citations)) {
      return [];
    }

    return citations
      .map((citation: any) => {
        if (!citation) return null;

        if (typeof citation === 'string') {
          return {
            source: citation,
          } as Citation;
        }

        return {
          source:
            citation.source ||
            citation.filename ||
            citation.file_name ||
            'Study material',
          page_or_slide:
            citation.page_or_slide ||
            citation.page ||
            citation.slide ||
            citation.slide_number ||
            undefined,
        } as Citation;
      })
      .filter(Boolean) as Citation[];
  };

  const send = async () => {
    if (!input.trim() || !courseId || loading) {
      return;
    }

    const question = input.trim();

    setInput('');

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: question,
      },
    ]);

    setLoading(true);

    try {
      const res = await tutorApi.ask({
        course_id: courseId,
        question,
        session_id: sessionId,
        mode,
      });

      // Useful during development.
      console.log('AI Tutor API response:', res);

      if (res?.session_id) {
        setSessionId(res.session_id);
      }

      const answerText = extractAnswerText(res?.answer);

      const citations = extractCitations(res);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: answerText,
          citations,
        },
      ]);
    } catch (err: any) {
      console.error('AI Tutor error:', err);

      let errorMessage =
        'Failed to get an answer. Please try again.';

      if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (question: string) => {
    if (loading) return;

    setInput(question);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        color: '#e2e8f0',
      }}
    >
      {/* ================= NAVBAR ================= */}

      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
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

          <span
            style={{
              color: '#334155',
            }}
          >
            |
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
            }}
          >
            <Brain
              size={20}
              color="#818cf8"
            />

            AI Tutor
          </div>
        </div>

        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="input"
          style={{
            width: 'auto',
            padding: '0.4rem 0.75rem',
            fontSize: 13,
          }}
          disabled={loading}
        >
          <option value="simple">
            Simple
          </option>

          <option value="detailed">
            Detailed
          </option>

          <option value="summary">
            Summary
          </option>

          <option value="examples">
            Examples
          </option>
        </select>
      </nav>

      {/* ================= CHAT AREA ================= */}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          maxWidth: 800,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* EMPTY STATE */}

        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              color: '#64748b',
            }}
          >
            <BookOpen
              size={48}
              style={{
                marginBottom: 16,
                opacity: 0.5,
              }}
            />

            <h3
              style={{
                color: '#94a3b8',
              }}
            >
              Ask anything about your study materials
            </h3>

            <p
              style={{
                fontSize: 14,
              }}
            >
              Answers are grounded in your uploaded
              PDFs and slides with citations.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              {[
                'Explain the main concept simply',
                'Summarize key points',
                'Give me an example',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() =>
                    handleSuggestion(q)
                  }
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 20,
                    padding:
                      '0.4rem 1rem',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= MESSAGES ================= */}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 20,
              display: 'flex',
              justifyContent:
                msg.role === 'user'
                  ? 'flex-end'
                  : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding:
                  '0.85rem 1.1rem',
                borderRadius: 16,
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                    : '#1e293b',
                border:
                  msg.role === 'assistant'
                    ? '1px solid #334155'
                    : 'none',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
                fontSize: 15,
                wordBreak: 'break-word',
              }}
            >
              {/* MESSAGE CONTENT */}

              <div>
                {typeof msg.content === 'string'
                  ? msg.content
                  : extractAnswerText(
                      msg.content
                    )}
              </div>

              {/* ================= CITATIONS ================= */}

              {msg.citations &&
                msg.citations.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop:
                        '1px solid #334155',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Sources:
                    </div>

                    {msg.citations.map(
                      (
                        c: Citation,
                        j: number
                      ) => (
                        <div
                          key={j}
                          style={{
                            fontSize: 12,
                            color: '#a5b4fc',
                            marginBottom: 4,
                          }}
                        >
                          📄{' '}
                          {c.source ||
                            'Study material'}

                          {c.page_or_slide
                            ? ` — ${c.page_or_slide}`
                            : ''}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          </div>
        ))}

        {/* ================= LOADING ================= */}

        {loading && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: 14,
              padding: '0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>
              Thinking...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ================= INPUT ================= */}

      <div
        style={{
          borderTop:
            '1px solid #1e293b',
          padding: '1rem 1.5rem',
          background: '#0f172a',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'flex',
            gap: 10,
          }}
        >
          <input
            className="input"
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask a question about your materials..."
            disabled={loading}
          />

          <button
            className="btn-primary"
            onClick={send}
            disabled={
              loading ||
              !input.trim()
            }
            style={{
              padding:
                '0.75rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 52,
            }}
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}