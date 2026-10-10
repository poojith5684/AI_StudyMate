import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Code2,
  Copy,
  Play,
  RotateCcw,
  Search,
  Send,
  Terminal,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import { codingApi } from '../services/api';
import './CodingPractice.css';

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type DifficultyFilter = 'All' | Difficulty;
type StageBusy = 'run' | 'submit' | 'load' | '';
type ResultTab = 'run' | 'tests';

type Example = {
  input: string;
  output: string;
  explanation?: string;
};

type Problem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  examples: Example[];
  constraints: string[];
  starter_code: string;
  tags: string[];
  language: 'c' | 'python';
  track: 'basics' | 'dsa';
};

type RunResult = {
  status: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
};

type TestResult = {
  case_number: number;
  passed: boolean;
  expected: string;
  actual: string;
  status: string;
  stderr?: string | null;
  compile_output?: string | null;
};

type SubmitResult = {
  accepted: boolean;
  passed: number;
  total: number;
  results: TestResult[];
};

const SOLVED_KEY = 'ai_studymate_coding_solved_v1';
const CODE_KEY = 'ai_studymate_coding_code_v1';

function readSolved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function readSavedCode(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CODE_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function saveLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Unable to save ${key} in local storage.`, error);
    return false;
  }
}

function normaliseError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export default function CodingPractice() {
  const { courseId } = useParams<{ courseId?: string }>();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [activeId, setActiveId] = useState('sum-two-numbers');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All');
  const [sourceCode, setSourceCode] = useState('');
  const [customInput, setCustomInput] = useState('3 5');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState<StageBusy>('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [solved, setSolved] = useState<string[]>(readSolved);
  const [savedCode, setSavedCode] = useState<Record<string, string>>(readSavedCode);
  const [resultTab, setResultTab] = useState<ResultTab>('run');
  const [copyLabel, setCopyLabel] = useState('Copy code');

  useEffect(() => {
    let alive = true;

    const loadProblems = async () => {
      setBusy('load');
      setError('');
      try {
        const data = await codingApi.problems(courseId);
        if (!alive) return;

        if (!Array.isArray(data)) {
          throw new Error('The server returned an invalid problems list.');
        }

        setProblems(data as Problem[]);
        setActiveId((current) =>
          data.some((problem: Problem) => problem.id === current)
            ? current
            : (data[0]?.id || ''),
        );
      } catch (err) {
        if (!alive) return;
        setError(normaliseError(err, 'Could not load coding problems.'));
      } finally {
        if (alive) setBusy('');
      }
    };

    void loadProblems();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const activeProblem = useMemo(
    () => problems.find((problem) => problem.id === activeId) || null,
    [problems, activeId],
  );

  useEffect(() => {
    if (!activeProblem) return;

    setSourceCode(savedCode[activeProblem.id] ?? activeProblem.starter_code ?? '');
    setCustomInput(activeProblem.examples?.[0]?.input ?? '');
    setRunResult(null);
    setSubmitResult(null);
    setError('');
    setNotice('');
    setResultTab('run');
    setCopyLabel('Copy code');
  }, [activeProblem?.id]); // Deliberately reset output when changing problems.

  const filteredProblems = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    return problems.filter((problem) => {
      const tags = Array.isArray(problem.tags) ? problem.tags.join(' ') : '';
      const matchesSearch =
        !searchText || `${problem.title} ${tags}`.toLowerCase().includes(searchText);
      return matchesSearch && (difficulty === 'All' || problem.difficulty === difficulty);
    });
  }, [problems, query, difficulty]);

  const solvedCount = useMemo(
    () => problems.filter((problem) => solved.includes(problem.id)).length,
    [problems, solved],
  );
  const progressPercent = problems.length
    ? Math.round((solvedCount / problems.length) * 100)
    : 0;
  const isBusy = busy !== '';
  const codeLanguage = activeProblem?.language ?? problems[0]?.language ?? 'c';
  const isPython = codeLanguage === 'python';
  const codeLanguageLabel = isPython ? 'Python 3' : 'C · GCC';
  const problemListTitle = activeProblem?.track === 'dsa' || problems[0]?.track === 'dsa'
    ? 'DSA problems'
    : (isPython ? 'Python problems' : 'C problems');

  const persistCode = (value: string) => {
    setSourceCode(value);
    if (!activeProblem) return;

    const next = { ...savedCode, [activeProblem.id]: value };
    setSavedCode(next);
    if (!saveLocal(CODE_KEY, next)) {
      setNotice('Code is available for this session, but browser storage is unavailable.');
    } else {
      setNotice('');
    }
  };

  const runCode = async () => {
    if (!activeProblem) {
      setError('Choose a problem first.');
      return;
    }
    if (!sourceCode.trim()) {
      setError('Enter your code before running it.');
      return;
    }

    setBusy('run');
    setError('');
    setNotice('');
    setRunResult(null);
    setSubmitResult(null);
    setResultTab('run');

    try {
      const result = await codingApi.run({
        source_code: sourceCode,
        stdin: customInput,
        course_id: courseId,
        language: activeProblem.language,
      });
      setRunResult(result as RunResult);
    } catch (err) {
      setError(normaliseError(err, 'Code execution failed. Check the backend and code runner settings.'));
    } finally {
      setBusy('');
    }
  };

  const submitCode = async () => {
    if (!activeProblem) {
      setError('Choose a problem first.');
      return;
    }
    if (!sourceCode.trim()) {
      setError('Enter your code before validating it.');
      return;
    }

    setBusy('submit');
    setError('');
    setNotice('');
    setRunResult(null);
    setSubmitResult(null);
    setResultTab('tests');

    try {
      const raw = await codingApi.submit({
        problem_id: activeProblem.id,
        source_code: sourceCode,
        course_id: courseId,
        language: activeProblem.language,
      });
      const result = raw as SubmitResult;

      if (
        typeof result.accepted !== 'boolean' ||
        !Array.isArray(result.results)
      ) {
        throw new Error('The server returned an invalid test-validation response.');
      }

      setSubmitResult(result);
      if (result.accepted) {
        const next = Array.from(new Set([...solved, activeProblem.id]));
        setSolved(next);
        if (!saveLocal(SOLVED_KEY, next)) {
          setNotice('Accepted! Browser storage is unavailable, so solved status may not persist after closing the browser.');
        } else {
          setNotice('Accepted! Your solved status has been saved in this browser.');
        }
      }
    } catch (err) {
      setError(normaliseError(err, 'Test validation failed. Check the backend and code runner settings.'));
    } finally {
      setBusy('');
    }
  };

  const resetCode = () => {
    if (!activeProblem) return;
    persistCode(activeProblem.starter_code ?? '');
    setRunResult(null);
    setSubmitResult(null);
    setError('');
    setNotice('Starter code restored.');
    setResultTab('run');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(sourceCode);
      setCopyLabel('Copied!');
      window.setTimeout(() => setCopyLabel('Copy code'), 1600);
    } catch {
      setError('Clipboard access failed. Select the code and copy it manually.');
    }
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) void submitCode();
      else void runCode();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const editor = event.currentTarget;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const nextCode = `${sourceCode.slice(0, start)}  ${sourceCode.slice(end)}`;
      persistCode(nextCode);
      requestAnimationFrame(() => {
        editor.selectionStart = editor.selectionEnd = start + 2;
      });
      return;
    }

    // Keep indentation when pressing Enter inside the editor.
    if (event.key === 'Enter') {
      const editor = event.currentTarget;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const lineStart = sourceCode.lastIndexOf('\n', start - 1) + 1;
      const currentLine = sourceCode.slice(lineStart, start);
      const indentation = currentLine.match(/^\s*/)?.[0] ?? '';
      const extraIndent = /[({\[]\s*$/.test(currentLine.trimEnd()) ? '  ' : '';
      if (indentation || extraIndent) {
        event.preventDefault();
        const inserted = `\n${indentation}${extraIndent}`;
        const nextCode = `${sourceCode.slice(0, start)}${inserted}${sourceCode.slice(end)}`;
        persistCode(nextCode);
        requestAnimationFrame(() => {
          editor.selectionStart = editor.selectionEnd = start + inserted.length;
        });
      }
    }
  };

  return (
    <div className="cp-page">
      <header className="cp-topbar">
        <div className="cp-brand-row">
          <Link
            to={courseId ? `/courses/${courseId}` : '/dashboard'}
            className="cp-back"
            aria-label="Go back"
            title="Back to course"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="cp-brand-icon"><Code2 size={20} /></div>
          <div className="cp-brand-name">AI <strong>StudyMate</strong><span>Coding Lab</span></div>
        </div>
        <div className="cp-topbar-right">
          <span className="cp-language-pill"><span /> {codeLanguageLabel}</span>
          <span className="cp-solved-mini"><Trophy size={15} /> {solvedCount}/{problems.length} solved</span>
          <Link className="cp-exit-link" to={courseId ? `/courses/${courseId}` : '/dashboard'}>Exit practice</Link>
        </div>
      </header>

      <div className="cp-workspace">
        <aside className="cp-sidebar">
          <div className="cp-sidebar-heading">
            <div><span className="cp-eyebrow">PRACTICE ARENA</span><h1>{problemListTitle}</h1></div>
            <span className="cp-count">{filteredProblems.length}</span>
          </div>

          <label className="cp-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search problems..."
              aria-label="Search coding problems"
            />
          </label>

          <div className="cp-filter-row" aria-label="Filter by difficulty">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={difficulty === item ? 'active' : ''}
                aria-pressed={difficulty === item}
                onClick={() => setDifficulty(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="cp-problem-list">
            {filteredProblems.map((problem) => {
              const isSolved = solved.includes(problem.id);
              const originalIndex = problems.findIndex((item) => item.id === problem.id);

              return (
                <button
                  key={problem.id}
                  type="button"
                  className={`cp-problem-item ${activeId === problem.id ? 'selected' : ''}`}
                  onClick={() => setActiveId(problem.id)}
                  aria-current={activeId === problem.id ? 'true' : undefined}
                >
                  <span className={`cp-problem-number ${isSolved ? 'done' : ''}`}>
                    {isSolved ? <Check size={14} /> : String(originalIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="cp-problem-main">
                    <strong>{problem.title}</strong>
                    <small>
                      <span className={`cp-difficulty ${(problem.difficulty || 'Easy').toLowerCase()}`}>
                        {problem.difficulty}
                      </span>
                      {problem.tags?.[0] ? <span>· {problem.tags[0]}</span> : null}
                    </small>
                  </span>
                  {activeId === problem.id ? <ChevronRight size={16} className="cp-problem-chevron" /> : null}
                </button>
              );
            })}
            {filteredProblems.length === 0 && (
              <div className="cp-no-problems">
                {busy === 'load' ? 'Loading problems…' : 'No problems match your search.'}
              </div>
            )}
          </div>

          <div className="cp-sidebar-footer">
            <div className="cp-progress-caption"><span>Your practice progress</span><strong>{progressPercent}%</strong></div>
            <div className="cp-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <p>Solved status is saved in this browser.</p>
          </div>
        </aside>

        <main className="cp-main">
          {!activeProblem ? (
            <section className="cp-empty-state">
              <Code2 size={36} />
              <h2>{busy === 'load' ? 'Loading practice problems…' : 'Coding Practice'}</h2>
              <p>{error || 'Choose a problem from the list to start.'}</p>
              {busy !== 'load' && problems.length === 0 && (
                <button type="button" className="cp-run-button" onClick={() => window.location.reload()}>
                  <RotateCcw size={15} /> Retry
                </button>
              )}
            </section>
          ) : (
            <>
              <section className="cp-problem-panel">
                <div className="cp-problem-title-row">
                  <div>
                    <div className="cp-section-kicker">PROBLEM {String(problems.findIndex((p) => p.id === activeProblem.id) + 1).padStart(2, '0')}</div>
                    <h2>{activeProblem.title}</h2>
                  </div>
                  {solved.includes(activeProblem.id) && (
                    <span className="cp-accepted-badge"><CheckCircle2 size={15} /> Solved</span>
                  )}
                </div>
                <div className="cp-meta-row">
                  <span className={`cp-difficulty large ${(activeProblem.difficulty || 'Easy').toLowerCase()}`}>{activeProblem.difficulty}</span>
                  <span><Timer size={14} /> 2 sec time limit</span>
                  <span><Terminal size={14} /> {codeLanguageLabel}</span>
                </div>
                <p className="cp-description">{activeProblem.description}</p>

                <div className="cp-example-list">
                  {(activeProblem.examples || []).map((example, index) => (
                    <div className="cp-example" key={`${activeProblem.id}-${index}`}>
                      <div className="cp-example-head">Example {index + 1}</div>
                      <div className="cp-io-grid">
                        <div><span>INPUT</span><pre>{example.input || '(empty)'}</pre></div>
                        <div><span>OUTPUT</span><pre>{example.output || '(empty)'}</pre></div>
                      </div>
                      {example.explanation && <p>{example.explanation}</p>}
                    </div>
                  ))}
                </div>

                {(activeProblem.constraints?.length ?? 0) > 0 && (
                  <div className="cp-constraints">
                    <h3>Constraints</h3>
                    <ul>{activeProblem.constraints.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
                  </div>
                )}
              </section>

              <section className="cp-editor-panel">
                <div className="cp-editor-header">
                  <div className="cp-editor-title"><Code2 size={17} /><strong>Solution</strong><span className="cp-file-tab">{isPython ? 'solution.py' : 'solution.c'}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="cp-reset-button" onClick={() => void copyCode()} disabled={isBusy} title="Copy code">
                      <Copy size={14} /> {copyLabel}
                    </button>
                    <button type="button" className="cp-reset-button" onClick={resetCode} disabled={isBusy}>
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>
                <div className="cp-editor-caption">
                  <span><span className="cp-live-dot" /> {isPython ? 'Python source editor' : 'C source editor'}</span>
                  <span>Ctrl+Enter: Run · Ctrl+Shift+Enter: Validate</span>
                </div>
                <textarea
                  className="cp-code-editor"
                  aria-label="Code editor"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  value={sourceCode}
                  onChange={(event) => persistCode(event.target.value)}
                  onKeyDown={handleEditorKeyDown}
                />
                <div className="cp-runbar">
                  <div className="cp-runbar-note"><span className="cp-dot-green" /> Code runs in a sandboxed {codeLanguageLabel} environment</div>
                  <div className="cp-action-row">
                    <button type="button" className="cp-run-button" onClick={() => void runCode()} disabled={isBusy}>
                      {busy === 'run' ? <span className="cp-spinner" /> : <Play size={15} fill="currentColor" />}
                      {busy === 'run' ? 'Running…' : 'Run Code'}
                    </button>
                    <button type="button" className="cp-submit-button" onClick={() => void submitCode()} disabled={isBusy}>
                      {busy === 'submit' ? <span className="cp-spinner" /> : <Send size={15} />}
                      {busy === 'submit' ? 'Checking…' : 'Validate Test Cases'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="cp-console-panel">
                <div className="cp-console-tabs">
                  <button type="button" className={resultTab === 'run' ? 'active' : ''} onClick={() => setResultTab('run')}>
                    <Terminal size={15} /> Run output
                  </button>
                  <button type="button" className={resultTab === 'tests' ? 'active' : ''} onClick={() => setResultTab('tests')}>
                    <CheckCircle2 size={15} /> Test cases {submitResult ? `(${submitResult.passed}/${submitResult.total})` : ''}
                  </button>
                </div>

                {error && (
                  <div className="cp-error-banner">
                    <CircleAlert size={16} /><span>{error}</span>
                    <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><XCircle size={15} /></button>
                  </div>
                )}
                {notice && <div className="cp-notice-banner"><Clipboard size={15} /><span>{notice}</span></div>}

                {resultTab === 'run' ? (
                  <div className="cp-run-output">
                    <label htmlFor="cp-custom-input">CUSTOM INPUT <span>stdin</span></label>
                    <textarea
                      id="cp-custom-input"
                      className="cp-custom-input"
                      value={customInput}
                      onChange={(event) => setCustomInput(event.target.value)}
                      spellCheck={false}
                      aria-label="Custom standard input"
                    />
                    {runResult ? (
                      <div className="cp-output-result">
                        <div className="cp-output-status">
                          <span className={runResult.status === 'Accepted' ? 'good' : 'bad'}>
                            {runResult.status === 'Accepted' ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                            {runResult.status || 'Completed'}
                          </span>
                          {runResult.time && <small>{runResult.time}s</small>}
                        </div>
                        {runResult.compile_output ? (
                          <pre className="cp-terminal-text error-text">{runResult.compile_output}</pre>
                        ) : runResult.stderr ? (
                          <pre className="cp-terminal-text error-text">{runResult.stderr}</pre>
                        ) : (
                          <pre className="cp-terminal-text">{runResult.stdout || '(No output)'}</pre>
                        )}
                        {runResult.message && <p>{runResult.message}</p>}
                      </div>
                    ) : (
                      <div className="cp-console-placeholder"><Terminal size={19} /><p>Run your code to see output here.</p><span>Use custom input to test different cases.</span></div>
                    )}
                  </div>
                ) : (
                  <div className="cp-test-results">
                    {!submitResult ? (
                      <div className="cp-console-placeholder"><CheckCircle2 size={19} /><p>Test results will appear here.</p><span>Validate your solution against hidden test cases.</span></div>
                    ) : (
                      <>
                        <div className={`cp-submit-summary ${submitResult.accepted ? 'accepted' : 'failed'}`}>
                          <div className="cp-summary-icon">{submitResult.accepted ? <CheckCircle2 size={22} /> : <XCircle size={22} />}</div>
                          <div><strong>{submitResult.accepted ? 'Accepted' : 'Not Accepted'}</strong><span>{submitResult.passed} of {submitResult.total} test cases passed</span></div>
                          <b>{submitResult.total ? Math.round((submitResult.passed / submitResult.total) * 100) : 0}%</b>
                        </div>
                        {(submitResult.results || []).map((test) => (
                          <div key={test.case_number} className={`cp-test-case ${test.passed ? 'passed' : 'failed'}`}>
                            <div className="cp-test-case-title">
                              {test.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                              <strong>Test Case {test.case_number}</strong>
                              <span>{test.status}</span>
                            </div>
                            {!test.passed && (
                              <div className="cp-test-diff">
                                <div><label>Expected</label><pre>{test.expected || '(empty)'}</pre></div>
                                <div><label>Output</label><pre>{test.actual || test.compile_output || test.stderr || '(empty)'}</pre></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </section>

              <footer className="cp-bottom-note">
                <span><CheckCircle2 size={14} /> Your code is sent to a separate code-execution service.</span>
                <span>Keep learning, one problem at a time.</span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
