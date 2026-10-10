import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Code2,
  Trophy,
  Flame,
} from 'lucide-react';
import { codingApi, progressApi } from '../services/api';

type CodingProblem = {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language?: 'c' | 'python' | 'java' | 'sql';
};

type CodingProgressRecord = {
  problem_id: string;
  solved?: boolean;
  attempts?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  code?: string;
  updated_at?: string;
};

function readLocalSolved(courseId?: string): string[] {
  const keys = [
    `ai_studymate_coding_solved_v1:${courseId || 'general'}`,
    'ai_studymate_coding_solved_v1',
  ];
  for (const key of keys) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      // If local storage is unavailable, use cloud progress only.
    }
  }
  return [];
}

export default function ProgressPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [courseData, setCourseData] = useState<Record<string, unknown> | null>(null);
  const [codingProblems, setCodingProblems] = useState<CodingProblem[]>([]);
  const [codingRecords, setCodingRecords] = useState<CodingProgressRecord[]>([]);
  const [localSolved, setLocalSolved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    setLocalSolved(readLocalSolved(courseId));

    Promise.allSettled([
      progressApi.get(courseId),
      codingApi.problems(courseId),
      codingApi.progress(courseId),
    ]).then((results) => {
      if (!alive) return;
      const [courseResult, problemsResult, codingResult] = results;
      if (courseResult.status === 'fulfilled') {
        setCourseData(courseResult.value as Record<string, unknown>);
      } else {
        setCourseData(null);
        setMessage('Course progress could not be loaded. Coding progress from this browser is still shown where available.');
      }
      if (problemsResult.status === 'fulfilled' && Array.isArray(problemsResult.value)) {
        setCodingProblems(problemsResult.value as CodingProblem[]);
      } else {
        setCodingProblems([]);
      }
      if (codingResult.status === 'fulfilled' && Array.isArray(codingResult.value)) {
        setCodingRecords(codingResult.value as CodingProgressRecord[]);
      } else {
        setCodingRecords([]);
        setMessage('Cloud coding history is unavailable. Run the coding_progress.sql setup in Supabase to keep progress across devices.');
      }
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, [courseId]);

  const solvedIds = useMemo(() => new Set([
    ...localSolved,
    ...codingRecords.filter((item) => item.solved).map((item) => item.problem_id),
  ]), [localSolved, codingRecords]);

  const codingSolved = codingProblems.filter((problem) => solvedIds.has(problem.id)).length;
  const codingTotal = codingProblems.length;
  const codingPercent = codingTotal ? Math.round((codingSolved / codingTotal) * 100) : 0;
  const difficultyStats = (['Easy', 'Medium', 'Hard'] as const).map((level) => {
    const inLevel = codingProblems.filter((problem) => problem.difficulty === level);
    const done = inLevel.filter((problem) => solvedIds.has(problem.id)).length;
    return { level, total: inLevel.length, solved: done, percent: inLevel.length ? Math.round(done / inLevel.length * 100) : 0 };
  });

  const courseProgress = Math.max(0, Math.min(100, Number(courseData?.progress ?? 0) || 0));
  const quizAccuracy = Number(courseData?.overall_accuracy ?? 0) || 0;
  const quizCount = Number(courseData?.quiz_count ?? 0) || 0;
  const questionsAttempted = Number(courseData?.questions_attempted ?? 0) || 0;
  const strongTopics = Array.isArray(courseData?.strong_topics) ? courseData?.strong_topics as string[] : [];
  const weakTopics = Array.isArray(courseData?.weak_topics) ? courseData?.weak_topics as string[] : [];
  const recommendations = Array.isArray(courseData?.recommendations) ? courseData?.recommendations as string[] : [];

  if (loading) {
    return <div style={{ padding: 40, color: '#a5b4d6', minHeight: '100vh', background: '#070b18' }}>Loading your learning progress…</div>;
  }

  const cardStyle = {
    borderRadius: 20,
    border: '1px solid rgba(157,163,255,.16)',
    background: 'linear-gradient(145deg, rgba(20,31,71,.82), rgba(8,15,38,.9))',
    boxShadow: '0 18px 42px rgba(0,0,0,.16), inset 0 1px rgba(255,255,255,.05)',
    padding: 20,
  };

  return (
    <div style={{ minHeight: '100vh', color: '#f4f5ff', background: 'radial-gradient(ellipse at 80% 0,rgba(69,76,218,.2),transparent 32%),radial-gradient(ellipse at 5% 60%,rgba(114,65,204,.13),transparent 35%),#070b18' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 24px', borderBottom: '1px solid rgba(157,163,255,.12)', background: 'rgba(5,10,31,.64)', backdropFilter: 'blur(22px)' }}>
        <Link to={`/courses/${courseId}`} style={{ color: '#a5b4d6', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}><ArrowLeft size={18} /> Back</Link>
        <span style={{ color: '#52618c' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 750 }}><BarChart3 size={20} color="#9d8aff" /> Learning Progress</div>
      </nav>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 22px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#a08dff', fontWeight: 800, fontSize: 10, letterSpacing: 1.7 }}>YOUR LEARNING ANALYTICS</div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 'clamp(28px,4vw,38px)', letterSpacing: '-1px' }}>Progress at a glance</h1>
          <p style={{ margin: 0, color: '#91a0c4', fontSize: 13 }}>Quiz completion and coding practice are tracked separately so you can see what you have actually solved.</p>
        </div>

        {message && <div role="status" style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 13, color: '#c6d4ff', background: 'rgba(99,102,241,.09)', border: '1px solid rgba(129,140,248,.2)', fontSize: 12 }}>{message}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 13, marginBottom: 24 }}>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#b8a8ff', fontSize: 12 }}><TrendingUp size={17} /> Course completion</div><div style={{ marginTop: 13, fontSize: 31, fontWeight: 850 }}>{courseProgress}%</div><div style={{ height: 7, borderRadius: 99, background: 'rgba(133,147,196,.17)', overflow: 'hidden', marginTop: 10 }}><div style={{ height: '100%', width: `${courseProgress}%`, background: 'linear-gradient(90deg,#7565ff,#48d6e8)', borderRadius: 99 }} /></div></article>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#79e7e5', fontSize: 12 }}><Code2 size={17} /> Coding problems solved</div><div style={{ marginTop: 13, fontSize: 31, fontWeight: 850 }}>{codingSolved}<span style={{ color: '#8190b6', fontSize: 17 }}> / {codingTotal || '—'}</span></div><div style={{ color: '#8190b6', fontSize: 11, marginTop: 6 }}>{codingTotal ? `${codingPercent}% of the current practice set` : 'Open Coding Practice to load the current set'}</div></article>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#ffcf7f', fontSize: 12 }}><Trophy size={17} /> Quiz attempts</div><div style={{ marginTop: 13, fontSize: 31, fontWeight: 850 }}>{quizCount}</div><div style={{ color: '#8190b6', fontSize: 11, marginTop: 6 }}>{questionsAttempted} questions attempted{quizCount ? ` · ${quizAccuracy}% accuracy` : ''}</div></article>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#6de2af', fontSize: 12 }}><Flame size={17} /> Saved coding drafts</div><div style={{ marginTop: 13, fontSize: 31, fontWeight: 850 }}>{codingRecords.filter((item) => Boolean(item.code)).length}</div><div style={{ color: '#8190b6', fontSize: 11, marginTop: 6 }}>Drafts stored for later</div></article>
        </section>

        <section style={{ ...cardStyle, marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <div><h2 style={{ margin: 0, fontSize: 19 }}>Coding practice by difficulty</h2><p style={{ margin: '6px 0 0', color: '#8493b8', fontSize: 12 }}>Only problems submitted successfully count as solved.</p></div>
            <Link to={`/courses/${courseId}/coding-practice`} style={{ color: '#c7b9ff', textDecoration: 'none', fontSize: 12, fontWeight: 750 }}>Continue practicing →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 15 }}>
            {difficultyStats.map((item) => {
              const color = item.level === 'Easy' ? '#62dfad' : item.level === 'Medium' ? '#ffd17d' : '#ff91b5';
              return <div key={item.level} style={{ padding: 15, borderRadius: 15, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(157,163,255,.11)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><strong style={{ color }}>{item.level}</strong><span style={{ color: '#9cadd2', fontSize: 11 }}>{item.solved} / {item.total} solved</span></div>
                <div style={{ height: 7, borderRadius: 99, overflow: 'hidden', background: 'rgba(133,147,196,.16)', marginTop: 12 }}><div style={{ height: '100%', width: `${item.percent}%`, background: color, borderRadius: 99, transition: 'width .3s ease' }} /></div>
                <div style={{ color: '#8090b5', fontSize: 11, marginTop: 8 }}>{item.percent}% complete</div>
              </div>;
            })}
          </div>
        </section>

        {(strongTopics.length > 0 || weakTopics.length > 0 || recommendations.length > 0) && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14 }}>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><CheckCircle size={17} color="#62dfad" /><strong>Strong topics</strong></div>{strongTopics.length ? strongTopics.map((topic) => <div key={topic} style={{ color: '#9daccd', fontSize: 12, marginBottom: 7 }}>{topic}</div>) : <div style={{ color: '#7b8aaf', fontSize: 12 }}>Quiz topic history will appear here when saved by the backend.</div>}</article>
          <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><AlertTriangle size={17} color="#ff9eaa" /><strong>Needs work</strong></div>{weakTopics.length ? weakTopics.map((topic) => <div key={topic} style={{ color: '#9daccd', fontSize: 12, marginBottom: 7 }}>{topic}</div>) : <div style={{ color: '#7b8aaf', fontSize: 12 }}>No weak quiz topics recorded yet.</div>}</article>
          {recommendations.length > 0 && <article style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><TrendingUp size={17} color="#9d8aff" /><strong>Recommendations</strong></div>{recommendations.map((item, index) => <div key={`${item}-${index}`} style={{ color: '#c1c9e4', fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>{item}</div>)}</article>}
        </section>}

        {codingProblems.length > 0 && <section style={{ ...cardStyle, marginTop: 22 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Recent coding activity</h2>
          {codingProblems.filter((problem) => solvedIds.has(problem.id)).length === 0 ? <p style={{ color: '#8190b6', fontSize: 12 }}>No accepted coding solutions recorded yet. Solve a problem and click Submit to start tracking progress.</p> : codingProblems.filter((problem) => solvedIds.has(problem.id)).slice(0, 12).map((problem) => <div key={problem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(157,163,255,.08)' }}><span style={{ color: '#e3e8ff', fontSize: 12 }}>{problem.title}</span><span style={{ color: problem.difficulty === 'Easy' ? '#62dfad' : problem.difficulty === 'Medium' ? '#ffd17d' : '#ff91b5', fontSize: 10 }}>{problem.difficulty} · Solved</span></div>)}
        </section>}
      </main>
    </div>
  );
}
