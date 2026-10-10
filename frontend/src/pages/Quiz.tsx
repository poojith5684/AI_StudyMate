import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { quizApi } from '../services/api';
import type { Difficulty, QuizResult } from '../types';

type Stage = 'setup' | 'taking' | 'result';

type PublicQuestion = {
  id: string;
  question: string;
  options: string[];
  topic?: string;
  difficulty: Difficulty;
  source?: string;
};

type QuestionReview = {
  question_id: string;
  question: string;
  options: string[];
  selected_answer: number | null;
  correct_answer: number;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  source?: string;
};

type QuizApiResult = QuizResult & {
  percentage?: number;
  message?: string;
  results: QuestionReview[];
  course_progress?: number;
};

export default function Quiz() {
  const { courseId } = useParams<{ courseId: string }>();

  const [stage, setStage] = useState<Stage>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('Course knowledge');

  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizApiResult | null>(null);

  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const completion = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const accuracy = Number(result?.accuracy ?? result?.percentage ?? 0);
  const reviews = Array.isArray(result?.results) ? result.results : [];
  const topicBreakdown = Array.isArray(result?.topic_breakdown) ? result.topic_breakdown : [];
  const weakTopics = Array.isArray(result?.weak_topics) ? result.weak_topics : [];
  const strongTopics = Array.isArray(result?.strong_topics) ? result.strong_topics : [];

  const scoreMessage = useMemo(() => {
    if (!result) return '';
    if (accuracy >= 90) return 'Excellent work — you really know this material.';
    if (accuracy >= 70) return 'Great effort. Review the missed questions to sharpen your understanding.';
    if (accuracy >= 50) return 'Good start. Review the explanations, then try another round.';
    return 'Use the answer explanations as a study guide, then try again.';
  }, [result, accuracy]);

  const generate = async () => {
    if (!courseId) {
      setError('This quiz is not linked to a course. Open it from a course page and try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await quizApi.generate({
        course_id: courseId,
        difficulty,
        question_count: count,
        topic: topic.trim() || undefined,
      }) as {
        quiz_id?: string;
        questions?: PublicQuestion[];
        source_label?: string;
      };

      if (!response.quiz_id || !Array.isArray(response.questions) || response.questions.length === 0) {
        throw new Error('The server did not return any valid questions. Please try again.');
      }

      setQuizId(response.quiz_id);
      setQuestions(response.questions);
      setAnswers({});
      setCurrent(0);
      setResult(null);
      setSourceLabel(response.source_label || 'Course knowledge');
      setStage('taking');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not generate a quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((previous) => ({ ...previous, [questionId]: optionIndex }));
  };

  const submit = async () => {
    if (!courseId || !quizId) {
      setError('This quiz session is missing. Generate a new quiz and try again.');
      return;
    }

    if (Object.keys(answers).length < questions.length) {
      setError('Please answer every question before submitting.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await quizApi.submit({
        quiz_id: quizId,
        course_id: courseId,
        answers,
      }) as QuizApiResult;

      const normalizedAccuracy = Number(
        response.accuracy ?? response.percentage ??
        (response.total ? Math.round((response.score / response.total) * 100) : 0),
      );

      setResult({
        ...response,
        accuracy: normalizedAccuracy,
        topic_breakdown: Array.isArray(response.topic_breakdown) ? response.topic_breakdown : [],
        results: Array.isArray(response.results) ? response.results : [],
        weak_topics: Array.isArray(response.weak_topics) ? response.weak_topics : [],
        strong_topics: Array.isArray(response.strong_topics) ? response.strong_topics : [],
      });
      setStage('result');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit the quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStage('setup');
    setQuizId('');
    setQuestions([]);
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setError('');
  };

  return (
    <div className="asm-quiz-page">
      <style>{`
        .asm-quiz-page,.asm-quiz-page *{box-sizing:border-box}
        .asm-quiz-page{--q-text:#f4f5ff;--q-muted:#8f9fc4;--q-line:rgba(161,164,255,.17);min-height:100vh;min-height:100dvh;color:var(--q-text);background:radial-gradient(ellipse at 12% 0%,rgba(98,72,224,.24),transparent 34%),radial-gradient(ellipse at 94% 36%,rgba(17,169,218,.13),transparent 28%),radial-gradient(ellipse at 45% 100%,rgba(145,57,218,.12),transparent 38%),linear-gradient(135deg,#05091d,#09112b 60%,#100b2c);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden;padding-bottom:45px}
        .asm-quiz-page:before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.12;background-image:radial-gradient(rgba(202,209,255,.7) .6px,transparent .6px);background-size:28px 28px;mask-image:linear-gradient(130deg,#000,transparent 78%)}
        .aq-nav{position:sticky;top:0;z-index:10;min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px clamp(16px,4vw,48px);border-bottom:1px solid rgba(157,163,255,.12);background:rgba(5,10,31,.76);backdrop-filter:blur(24px)}
        .aq-nav-left,.aq-brand,.aq-back,.aq-nav-badge{display:flex;align-items:center;gap:10px}
        .aq-nav-left{min-width:0;gap:16px}
        .aq-back{color:#a3b0d2;text-decoration:none;font-size:12px;white-space:nowrap;transition:color .2s}.aq-back:hover{color:white}
        .aq-divider{height:23px;width:1px;background:rgba(157,163,255,.2)}
        .aq-brand{font-size:13px;font-weight:800;white-space:nowrap;gap:8px}
        .aq-brand-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;color:#e6e0ff;background:linear-gradient(140deg,#8a6bff,#4b63e7 68%,#3dc5da);border:1px solid rgba(220,213,255,.25);box-shadow:0 7px 22px rgba(105,89,255,.22),inset 0 1px rgba(255,255,255,.3)}
        .aq-nav-badge{padding:8px 11px;border-radius:10px;border:1px solid var(--q-line);background:rgba(255,255,255,.035);color:#aebbe0;font-size:10px;white-space:nowrap}
        .aq-wrap{position:relative;z-index:1;width:min(1080px,calc(100% - 36px));margin:0 auto;padding-top:38px}
        .aq-eyebrow{display:inline-flex;align-items:center;gap:7px;color:#bcb0ff;font-size:10px;letter-spacing:1.5px;font-weight:850;text-transform:uppercase}
        .aq-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:22px;margin-bottom:24px}
        .aq-heading h1{margin:10px 0 8px;font-size:clamp(28px,4.3vw,43px);line-height:1.08;letter-spacing:-1.5px;color:#f5f5ff}
        .aq-heading h1 span{background:linear-gradient(90deg,#b5a4ff,#76a8ff,#53d9ed);background-clip:text;-webkit-background-clip:text;color:transparent}
        .aq-heading p{max-width:650px;margin:0;color:#91a0c4;font-size:13px;line-height:1.7}
        .aq-heading-orb{display:grid;place-items:center;width:78px;height:78px;flex-shrink:0;border:1px solid rgba(168,150,255,.24);border-radius:24px;color:#d2c7ff;background:radial-gradient(circle at 25% 20%,rgba(255,255,255,.2),transparent 28%),linear-gradient(145deg,rgba(120,95,255,.25),rgba(24,158,224,.1));box-shadow:0 0 45px rgba(109,82,255,.13),inset 0 1px rgba(255,255,255,.17);animation:aq-float 5s ease-in-out infinite}
        @keyframes aq-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .aq-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(230px,.7fr);align-items:start;gap:18px}
        .aq-card,.aq-side-card{min-width:0;border:1px solid rgba(157,163,255,.19);border-radius:23px;background:linear-gradient(145deg,rgba(20,31,70,.88),rgba(8,16,42,.89));box-shadow:0 24px 65px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.07);backdrop-filter:blur(20px)}
        .aq-card{padding:clamp(20px,3.2vw,32px)}
        .aq-side-card{padding:20px;overflow:hidden;position:relative}
        .aq-side-card:after{content:"";position:absolute;width:145px;height:145px;right:-70px;top:-70px;border-radius:50%;background:rgba(125,94,255,.18);filter:blur(35px);pointer-events:none}
        .aq-card-title{display:flex;align-items:center;gap:12px;margin:0 0 8px;font-size:21px;letter-spacing:-.5px}
        .aq-icon-box{display:grid;place-items:center;width:43px;height:43px;flex-shrink:0;border:1px solid rgba(165,147,255,.21);border-radius:14px;color:#d6cdff;background:rgba(124,100,255,.15);box-shadow:inset 0 1px rgba(255,255,255,.08)}
        .aq-muted{color:var(--q-muted);font-size:12px;line-height:1.7}
        .aq-field{display:grid;gap:8px;margin-top:23px}
        .aq-field label{color:#d1d7f3;font-size:11px;font-weight:750;letter-spacing:.2px}
        .aq-input{width:100%;min-height:46px;padding:12px 14px;border:1px solid rgba(157,163,255,.19);border-radius:12px;outline:none;color:#f4f5ff;background:rgba(4,9,28,.64);font:inherit;font-size:12px;transition:border-color .2s,box-shadow .2s}
        .aq-input::placeholder{color:#6b7a9f}.aq-input:focus{border-color:rgba(163,143,255,.65);box-shadow:0 0 0 3px rgba(123,99,255,.1)}
        .aq-choice-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
        .aq-choice{position:relative;text-align:left;min-height:68px;padding:12px;border:1px solid rgba(157,163,255,.16);border-radius:13px;color:#adb9d9;background:rgba(255,255,255,.025);cursor:pointer;transition:all .2s}
        .aq-choice strong{display:block;text-transform:capitalize;color:#e5e8ff;font-size:12px;margin-bottom:5px}.aq-choice small{display:block;color:#7484a9;font-size:9px;line-height:1.4}
        .aq-choice:hover{border-color:rgba(160,141,255,.4);background:rgba(123,99,255,.08)}.aq-choice.active{border-color:rgba(164,143,255,.55);background:linear-gradient(145deg,rgba(112,89,255,.2),rgba(61,111,219,.08));box-shadow:inset 0 1px rgba(255,255,255,.06),0 0 24px rgba(106,84,255,.08)}.aq-choice.active strong{color:#f3efff}
        .aq-count-row{display:flex;gap:8px;flex-wrap:wrap}.aq-count{min-width:45px;padding:10px 15px;border:1px solid rgba(157,163,255,.17);border-radius:10px;color:#9eadd0;background:rgba(255,255,255,.025);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}.aq-count:hover{border-color:rgba(160,141,255,.4)}.aq-count.active{color:white;border-color:rgba(164,143,255,.5);background:linear-gradient(130deg,rgba(107,94,244,.35),rgba(137,71,220,.22))}
        .aq-primary,.aq-secondary{display:inline-flex;justify-content:center;align-items:center;gap:9px;min-height:43px;padding:11px 16px;border-radius:12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s,filter .2s}
        .aq-primary{color:white;border:1px solid rgba(203,190,255,.32);background:linear-gradient(110deg,#6268f4,#8b4ff0 65%,#b451e1);box-shadow:0 9px 24px rgba(105,81,255,.23),inset 0 1px rgba(255,255,255,.19)}.aq-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 13px 30px rgba(105,81,255,.32);filter:brightness(1.07)}.aq-primary:disabled{opacity:.55;cursor:not-allowed}.aq-spin{animation:aq-spin 1s linear infinite}@keyframes aq-spin{to{transform:rotate(360deg)}}
        .aq-secondary{color:#c3cbea;border:1px solid rgba(157,163,255,.2);background:rgba(255,255,255,.04)}.aq-secondary:hover:not(:disabled){background:rgba(255,255,255,.08)}.aq-actions{display:flex;justify-content:space-between;gap:10px;margin-top:25px}
        .aq-error{display:flex;align-items:flex-start;gap:9px;margin-top:16px;padding:12px 13px;border:1px solid rgba(255,122,139,.24);border-radius:12px;color:#ffc0ca;background:rgba(239,68,68,.08);font-size:11px;line-height:1.6;overflow-wrap:anywhere}
        .aq-source-note{display:flex;align-items:flex-start;gap:9px;margin-top:18px;padding:12px 13px;border:1px solid rgba(157,163,255,.12);border-radius:12px;color:#8798bd;background:rgba(255,255,255,.025);font-size:10px;line-height:1.6}.aq-source-note svg{color:#b8a8ff;flex-shrink:0;margin-top:1px}
        .aq-side-title{position:relative;z-index:1;margin:1px 0 13px;font-size:13px;color:#f0efff}.aq-feature{position:relative;z-index:1;display:flex;gap:10px;padding:12px 0;border-bottom:1px solid rgba(157,163,255,.09)}.aq-feature:last-child{border-bottom:0}.aq-feature-icon{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border-radius:10px;color:#c5b8ff;background:rgba(124,100,255,.14)}.aq-feature strong{display:block;font-size:10px;color:#dfe4ff}.aq-feature small{display:block;margin-top:4px;font-size:9px;color:#7d8db2;line-height:1.55}
        .aq-progress-top{display:flex;justify-content:space-between;gap:12px;color:#92a1c4;font-size:10px;margin-bottom:10px}.aq-progress-top strong{color:#d4cbff}.aq-progress-track{height:6px;border-radius:99px;overflow:hidden;background:rgba(112,128,179,.18)}.aq-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#5d78ff,#a15aff,#4adbe9);box-shadow:0 0 13px rgba(128,92,255,.3);transition:width .25s}
        .aq-question-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#92a0c3;font-size:10px;margin-bottom:17px}.aq-topic-pill{max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 9px;border:1px solid rgba(159,140,255,.17);border-radius:999px;background:rgba(125,99,255,.08);color:#c5b7ff;font-size:9px}
        .aq-question{margin:0 0 22px;font-size:clamp(18px,2.2vw,23px);line-height:1.45;letter-spacing:-.35px;color:#f5f5ff}
        .aq-option-list{display:grid;gap:10px}.aq-option{display:flex;align-items:flex-start;gap:12px;width:100%;padding:14px 15px;text-align:left;border:1px solid rgba(157,163,255,.16);border-radius:13px;color:#d3daf5;background:rgba(255,255,255,.025);font:inherit;font-size:12px;line-height:1.55;cursor:pointer;transition:all .2s}.aq-option:hover{background:rgba(122,102,255,.08);border-color:rgba(160,142,255,.38)}.aq-option.active{background:linear-gradient(110deg,rgba(100,91,255,.19),rgba(49,153,221,.07));border-color:rgba(162,143,255,.62);box-shadow:inset 0 1px rgba(255,255,255,.06),0 0 20px rgba(105,81,255,.07)}.aq-option-letter{display:grid;place-items:center;width:25px;height:25px;flex-shrink:0;border:1px solid rgba(157,163,255,.17);border-radius:8px;color:#abb6ff;background:rgba(255,255,255,.035);font-size:10px;font-weight:800}.aq-option.active .aq-option-letter{color:#fff;border-color:transparent;background:linear-gradient(135deg,#626cf7,#9855f1)}
        .aq-result-head{text-align:center;padding:8px 0 24px}.aq-score-ring{display:grid;place-items:center;width:146px;height:146px;margin:20px auto 16px;border-radius:50%;padding:9px;background:conic-gradient(#8d70ff var(--score-deg),rgba(109,127,181,.15) 0);box-shadow:0 0 38px rgba(120,98,255,.13)}.aq-score-ring-inner{display:flex;align-items:center;justify-content:center;flex-direction:column;width:100%;height:100%;border:1px solid rgba(157,163,255,.16);border-radius:50%;background:linear-gradient(145deg,#111c43,#090f29)}.aq-score-ring-inner strong{font-size:32px;letter-spacing:-1px;color:white}.aq-score-ring-inner span{margin-top:2px;color:#92a0c3;font-size:10px}.aq-result-head h2{margin:0;font-size:22px;letter-spacing:-.5px}.aq-result-head p{max-width:550px;margin:9px auto 0;color:#95a2c5;font-size:12px;line-height:1.7}
        .aq-result-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 24px}.aq-result-stat{padding:15px;border:1px solid rgba(157,163,255,.14);border-radius:14px;background:rgba(255,255,255,.025)}.aq-result-stat span{display:block;color:#8594b7;font-size:9px}.aq-result-stat strong{display:block;margin-top:6px;color:#f0efff;font-size:20px}.aq-subtitle{display:flex;align-items:center;gap:8px;margin:26px 0 12px;color:#f0efff;font-size:14px;font-weight:800}.aq-topic-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid rgba(157,163,255,.09);font-size:11px}.aq-topic-row:last-child{border-bottom:0}.aq-topic-row span:first-child{color:#aab6d6}.aq-topic-score{white-space:nowrap;font-weight:750}.aq-review{padding:15px;margin-top:11px;border:1px solid rgba(157,163,255,.13);border-radius:15px;background:rgba(255,255,255,.025)}.aq-review-top{display:flex;align-items:flex-start;gap:9px}.aq-review-symbol{display:grid;place-items:center;width:27px;height:27px;flex-shrink:0;border-radius:9px}.aq-review-symbol.good{color:#6ce8bd;background:rgba(47,209,145,.12)}.aq-review-symbol.bad{color:#ff9eae;background:rgba(255,97,129,.12)}.aq-review h4{margin:2px 0 0;color:#e8eaff;font-size:12px;line-height:1.6}.aq-review-meta{margin:9px 0 0 36px;color:#7f8db2;font-size:10px;line-height:1.7}.aq-review-meta strong{color:#d8deff}.aq-explanation{margin:10px 0 0 36px;padding:10px 12px;border-radius:10px;background:rgba(123,101,255,.07);color:#aebbe0;font-size:10px;line-height:1.7}.aq-bottom-actions{display:flex;gap:10px;margin-top:23px}.aq-bottom-actions>*{flex:1}
        @media(max-width:860px){.aq-grid{grid-template-columns:minmax(0,1fr)}.aq-side-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.aq-side-title{grid-column:1/-1}.aq-feature{border-bottom:0}.aq-heading-orb{width:65px;height:65px}}
        @media(max-width:560px){.aq-nav{padding:10px 13px;min-height:62px}.aq-nav-left{gap:9px}.aq-brand{font-size:11px}.aq-brand-mark{width:30px;height:30px}.aq-nav-badge{display:none}.aq-wrap{width:calc(100% - 24px);padding-top:25px}.aq-heading{align-items:flex-start}.aq-heading h1{font-size:30px}.aq-heading p{font-size:11px}.aq-heading-orb{width:46px;height:46px;border-radius:14px}.aq-heading-orb svg{width:23px}.aq-card{padding:18px;border-radius:19px}.aq-choice-row{gap:6px}.aq-choice{padding:10px 8px;min-height:70px}.aq-choice strong{font-size:11px}.aq-choice small{font-size:8px}.aq-question-meta{align-items:flex-start;flex-direction:column;gap:8px}.aq-topic-pill{max-width:100%}.aq-option{padding:12px;font-size:11px}.aq-result-stats{gap:7px}.aq-result-stat{padding:11px}.aq-result-stat strong{font-size:17px}.aq-score-ring{width:126px;height:126px}.aq-bottom-actions{flex-direction:column}.aq-side-card{padding:15px}.aq-feature{gap:8px}.aq-feature small{font-size:8px}}
        @media(prefers-reduced-motion:reduce){.asm-quiz-page *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
      `}</style>

      <nav className="aq-nav">
        <div className="aq-nav-left">
          <Link className="aq-back" to={courseId ? `/courses/${courseId}` : '/my-courses'}>
            <ArrowLeft size={16} /> Back to course
          </Link>
          <span className="aq-divider" />
          <div className="aq-brand">
            <span className="aq-brand-mark"><BrainCircuit size={19} /></span>
            AI StudyMate
          </div>
        </div>
        <div className="aq-nav-badge"><Target size={14} /> PERSONALIZED PRACTICE</div>
      </nav>

      <main className="aq-wrap">
        <header className="aq-heading">
          <div>
            <div className="aq-eyebrow"><Sparkles size={13} /> YOUR KNOWLEDGE CHECK</div>
            <h1>Practice with purpose.<br /><span>Know what you know.</span></h1>
            <p>Get subject-specific questions, see your score immediately, and review explanations for every answer.</p>
          </div>
          <div className="aq-heading-orb"><BrainCircuit size={34} /></div>
        </header>

        {stage === 'setup' && (
          <div className="aq-grid">
            <section className="aq-card">
              <h2 className="aq-card-title"><span className="aq-icon-box"><Target size={21} /></span> Build your quiz</h2>
              <p className="aq-muted">Questions are tailored to this course and your chosen topic. Readable PDF, PPTX, DOCX and text uploads can be used when available.</p>

              <div className="aq-field">
                <label htmlFor="aq-topic">Focus topic <span style={{ color: '#7182aa', fontWeight: 500 }}>(optional)</span></label>
                <input id="aq-topic" className="aq-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. pointers, arrays, recursion, SQL joins..." />
              </div>

              <div className="aq-field">
                <label>Difficulty level</label>
                <div className="aq-choice-row">
                  {([
                    { value: 'easy', title: 'Easy', detail: 'Core concepts' },
                    { value: 'medium', title: 'Medium', detail: 'Apply ideas' },
                    { value: 'hard', title: 'Hard', detail: 'Deep reasoning' },
                  ] as { value: Difficulty; title: string; detail: string }[]).map((item) => (
                    <button key={item.value} type="button" className={`aq-choice ${difficulty === item.value ? 'active' : ''}`} onClick={() => setDifficulty(item.value)} aria-pressed={difficulty === item.value}>
                      <strong>{item.title}</strong><small>{item.detail}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="aq-field">
                <label>Number of questions</label>
                <div className="aq-count-row">
                  {[3, 5, 8, 10].map((value) => (
                    <button key={value} type="button" className={`aq-count ${count === value ? 'active' : ''}`} onClick={() => setCount(value)} aria-pressed={count === value}>{value}</button>
                  ))}
                </div>
              </div>

              {error && <div className="aq-error"><CircleAlert size={16} /> <span>{error}</span></div>}

              <button className="aq-primary" type="button" onClick={generate} disabled={loading} style={{ width: '100%', marginTop: 24 }}>
                {loading ? <><RotateCcw size={15} className="aq-spin" /> Creating your questions…</> : <><Sparkles size={15} /> Generate subject quiz <ArrowRight size={15} /></>}
              </button>

              <div className="aq-source-note"><FileText size={15} /><span>For the most material-specific quiz, upload your lecturer’s notes in the course first. If AI question generation is unavailable, the server uses subject-specific practice questions where supported instead of generic study-habit questions.</span></div>
            </section>

            <aside className="aq-side-card">
              <h3 className="aq-side-title">Your quiz, your progress</h3>
              <div className="aq-feature"><span className="aq-feature-icon"><BrainCircuit size={16} /></span><div><strong>Course-aware questions</strong><small>Questions target your course and selected topic, not generic advice.</small></div></div>
              <div className="aq-feature"><span className="aq-feature-icon"><ClipboardCheck size={16} /></span><div><strong>Instant score</strong><small>See your marks and percentage as soon as you submit.</small></div></div>
              <div className="aq-feature"><span className="aq-feature-icon"><BookOpen size={16} /></span><div><strong>Answer explanations</strong><small>Review the correct choice and why it is right.</small></div></div>
              <div className="aq-feature"><span className="aq-feature-icon"><BarChart3 size={16} /></span><div><strong>Topic breakdown</strong><small>Find topics that need another revision round.</small></div></div>
            </aside>
          </div>
        )}

        {stage === 'taking' && question && (
          <div className="aq-grid">
            <section className="aq-card">
              <div className="aq-progress-top"><span>Question {current + 1} of {questions.length}</span><strong>{answeredCount}/{questions.length} answered</strong></div>
              <div className="aq-progress-track" style={{ marginBottom: 24 }}><div className="aq-progress-fill" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>
              <div className="aq-question-meta"><span>{(question.difficulty || difficulty).toUpperCase()} LEVEL</span><span className="aq-topic-pill">{question.topic || topic.trim() || 'Course concepts'}</span></div>
              <h2 className="aq-question">{question.question}</h2>

              <div className="aq-option-list">
                {question.options.map((option, index) => {
                  const selected = answers[question.id] === index;
                  return (
                    <button key={`${question.id}-${index}`} type="button" className={`aq-option ${selected ? 'active' : ''}`} onClick={() => { selectAnswer(question.id, index); setError(''); }} aria-pressed={selected}>
                      <span className="aq-option-letter">{selected ? <Check size={14} /> : String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>

              {error && <div className="aq-error"><CircleAlert size={16} /> <span>{error}</span></div>}

              <div className="aq-actions">
                <button type="button" className="aq-secondary" onClick={() => { setCurrent((previous) => Math.max(0, previous - 1)); setError(''); }} disabled={current === 0}><ArrowLeft size={15} /> Previous</button>
                {current < questions.length - 1 ? (
                  <button type="button" className="aq-primary" onClick={() => { setCurrent((previous) => Math.min(questions.length - 1, previous + 1)); setError(''); }} disabled={answers[question.id] === undefined}>Next question <ArrowRight size={15} /></button>
                ) : (
                  <button type="button" className="aq-primary" onClick={submit} disabled={loading || answeredCount < questions.length}>{loading ? 'Checking answers…' : <>Submit quiz <Send size={14} /></>}</button>
                )}
              </div>
            </section>

            <aside className="aq-side-card">
              <h3 className="aq-side-title">Session progress</h3>
              <div className="aq-progress-top"><span>Answered</span><strong>{completion}%</strong></div>
              <div className="aq-progress-track"><div className="aq-progress-fill" style={{ width: `${completion}%` }} /></div>
              <p className="aq-muted" style={{ margin: '14px 0 6px' }}>Choose one best answer for each question. You can move back and change answers before submitting.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 7, marginTop: 17 }}>
                {questions.map((item, index) => <button key={item.id} type="button" aria-label={`Go to question ${index + 1}`} onClick={() => { setCurrent(index); setError(''); }} style={{ height: 32, borderRadius: 9, border: index === current ? '1px solid rgba(186,171,255,.75)' : '1px solid rgba(157,163,255,.16)', color: answers[item.id] !== undefined ? '#fff' : '#8392b7', background: answers[item.id] !== undefined ? 'linear-gradient(135deg,rgba(104,105,245,.65),rgba(144,78,231,.55))' : index === current ? 'rgba(123,99,255,.15)' : 'rgba(255,255,255,.025)', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{index + 1}</button>)}
              </div>
              <div className="aq-source-note" style={{ marginTop: 20 }}><Sparkles size={14} /><span>Source: {sourceLabel}</span></div>
            </aside>
          </div>
        )}

        {stage === 'result' && result && (
          <div className="aq-grid">
            <section className="aq-card">
              <div className="aq-result-head">
                <div className="aq-eyebrow" style={{ justifyContent: 'center' }}><Trophy size={14} /> QUIZ COMPLETE</div>
                <div className="aq-score-ring" style={{ '--score-deg': `${Math.max(0, Math.min(100, accuracy)) * 3.6}deg` } as CSSProperties}>
                  <div className="aq-score-ring-inner"><strong>{accuracy}%</strong><span>accuracy</span></div>
                </div>
                <h2>{result.score} out of {result.total} correct</h2>
                <p>{scoreMessage}</p>
              </div>

              <div className="aq-result-stats">
                <div className="aq-result-stat"><span>Correct answers</span><strong>{result.score}</strong></div>
                <div className="aq-result-stat"><span>Questions</span><strong>{result.total}</strong></div>
                <div className="aq-result-stat"><span>Course progress</span><strong>{result.course_progress !== undefined ? `${result.course_progress}%` : 'Saved'}</strong></div>
              </div>

              {topicBreakdown.length > 0 && (
                <>
                  <h3 className="aq-subtitle"><BarChart3 size={17} /> Topic performance</h3>
                  {topicBreakdown.map((item) => <div className="aq-topic-row" key={item.topic}><span>{item.topic}</span><span className="aq-topic-score" style={{ color: item.accuracy >= 80 ? '#6ce8bd' : item.accuracy >= 60 ? '#ffd27a' : '#ff9eae' }}>{item.correct}/{item.total} · {item.accuracy}%</span></div>)}
                </>
              )}

              {weakTopics.length > 0 && <div className="aq-source-note" style={{ borderColor: 'rgba(255,130,150,.2)', background: 'rgba(239,68,68,.06)' }}><XCircle size={15} style={{ color: '#ff9eae' }} /><span><strong style={{ color: '#ffc0ca' }}>Review next:</strong> {weakTopics.join(', ')}</span></div>}
              {strongTopics.length > 0 && <div className="aq-source-note" style={{ borderColor: 'rgba(93,224,180,.2)', background: 'rgba(36,190,139,.06)' }}><CheckCircle2 size={15} style={{ color: '#6ce8bd' }} /><span><strong style={{ color: '#9af0cd' }}>Strong topics:</strong> {strongTopics.join(', ')}</span></div>}

              {reviews.length > 0 && (
                <>
                  <h3 className="aq-subtitle"><BookOpen size={17} /> Review every answer</h3>
                  {reviews.map((item, index) => (
                    <article className="aq-review" key={item.question_id || `${index}-${item.question}`}>
                      <div className="aq-review-top">
                        <span className={`aq-review-symbol ${item.is_correct ? 'good' : 'bad'}`}>{item.is_correct ? <Check size={15} /> : <X size={15} />}</span>
                        <h4>{index + 1}. {item.question}</h4>
                      </div>
                      <div className="aq-review-meta">
                        Your answer: <strong style={{ color: item.is_correct ? '#6ce8bd' : '#ff9eae' }}>{item.selected_option || 'Not answered'}</strong><br />
                        Correct answer: <strong style={{ color: '#9ed9ff' }}>{item.correct_option}</strong>
                        {item.topic ? <><br />Topic: {item.topic}</> : null}
                      </div>
                      {item.explanation && <p className="aq-explanation">{item.explanation}</p>}
                    </article>
                  ))}
                </>
              )}

              <div className="aq-bottom-actions">
                <button className="aq-primary" type="button" onClick={startOver}><RotateCcw size={15} /> New quiz</button>
                <Link className="aq-secondary" to={courseId ? `/courses/${courseId}/progress` : '/my-courses'}><BarChart3 size={15} /> View progress</Link>
              </div>
            </section>

            <aside className="aq-side-card">
              <h3 className="aq-side-title">Keep improving</h3>
              <div className="aq-feature"><span className="aq-feature-icon"><CheckCircle2 size={16} /></span><div><strong>Review mistakes</strong><small>Read each explanation before starting another attempt.</small></div></div>
              <div className="aq-feature"><span className="aq-feature-icon"><BookOpen size={16} /></span><div><strong>Revisit your notes</strong><small>Focus on topics where your accuracy was lowest.</small></div></div>
              <div className="aq-feature"><span className="aq-feature-icon"><Target size={16} /></span><div><strong>Try again</strong><small>Choose a narrower topic for more targeted practice.</small></div></div>
              <Link to={courseId ? `/courses/${courseId}` : '/my-courses'} className="aq-primary" style={{ width: '100%', marginTop: 16 }}><ArrowLeft size={15} /> Back to course</Link>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
