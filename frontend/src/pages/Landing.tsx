import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  FileText,
  GraduationCap,
  LockKeyhole,
  MessageCircle,
  Sparkles,
  Target,
  Youtube,
  Zap,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleExplore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim()) {
      try { sessionStorage.setItem('asm_pending_course_search', query.trim()); } catch { /* Continue without session storage. */ }
    }
    navigate('/register');
  };

  return (
    <main className="asm-landing">
      <style>{`
        .asm-landing, .asm-landing * { box-sizing: border-box; }
        .asm-landing { min-height: 100vh; color:#f5f6ff; overflow:hidden; position:relative; isolation:isolate; background:radial-gradient(ellipse at 6% 8%,rgba(83,64,222,.23),transparent 30%),radial-gradient(ellipse at 94% 36%,rgba(16,148,229,.15),transparent 28%),radial-gradient(ellipse at 72% 94%,rgba(155,64,238,.13),transparent 32%),linear-gradient(135deg,#04091b 0%,#080e27 58%,#110d2a 100%); }
        .asm-landing::before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.2; background-image:radial-gradient(rgba(197,205,255,.7) .7px,transparent .7px); background-size:27px 27px; mask-image:linear-gradient(115deg,#000,transparent 75%); }
        .asm-l-wrap { width:min(1380px,100%); margin:0 auto; padding:0 clamp(18px,4vw,60px); }
        .asm-l-nav { display:flex; align-items:center; justify-content:space-between; gap:22px; min-height:78px; border-bottom:1px solid rgba(160,173,255,.1); }
        .asm-l-brand { display:inline-flex; align-items:center; gap:11px; color:#fff; font-weight:800; text-decoration:none; letter-spacing:-.25px; white-space:nowrap; }
        .asm-l-brand-mark { width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(173,156,255,.35);border-radius:14px;color:#d6caff;background:linear-gradient(145deg,rgba(145,108,255,.36),rgba(44,174,235,.15));box-shadow:0 0 26px rgba(127,95,255,.22),inset 0 1px rgba(255,255,255,.24); }
        .asm-l-navlinks { display:flex; align-items:center; justify-content:center; gap:clamp(14px,2vw,30px); }
        .asm-l-navlinks a { color:#bac4e1;text-decoration:none;font-size:13px;transition:color .2s; }
        .asm-l-navlinks a:hover { color:#fff; }
        .asm-l-actions { display:flex; align-items:center; gap:10px; }
        .asm-l-login { color:#dfe4fb;text-decoration:none;padding:10px 14px;font-size:13px; }
        .asm-l-cta { display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 17px;border-radius:13px;color:#fff;text-decoration:none;font-size:13px;font-weight:750;border:1px solid rgba(208,196,255,.34);background:linear-gradient(110deg,#6861fa,#8751f1 58%,#b44fe5);box-shadow:0 11px 30px rgba(104,86,255,.29),inset 0 1px rgba(255,255,255,.28);transition:transform .2s,box-shadow .2s,filter .2s; }
        .asm-l-cta:hover { transform:translateY(-2px); filter:brightness(1.08); box-shadow:0 16px 37px rgba(115,85,255,.39),inset 0 1px rgba(255,255,255,.3); }
        .asm-l-secondary { display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 17px;border-radius:13px;color:#e5e9ff;text-decoration:none;font-size:13px;font-weight:700;border:1px solid rgba(169,183,255,.22);background:rgba(255,255,255,.04);backdrop-filter:blur(12px);transition:transform .2s,background .2s,border .2s; }
        .asm-l-secondary:hover { transform:translateY(-2px);background:rgba(255,255,255,.08);border-color:rgba(172,156,255,.38); }
        .asm-l-hero { min-height:600px; display:grid;grid-template-columns:minmax(0,1.03fr) minmax(0,.97fr);align-items:center;gap:clamp(26px,5vw,70px);padding:64px 0 42px; }
        .asm-l-copy { position:relative;z-index:2; }
        .asm-l-eyebrow { display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;color:#d9d1ff;font-size:12px;font-weight:700;border:1px solid rgba(166,146,255,.24);background:rgba(126,92,255,.11);box-shadow:inset 0 1px rgba(255,255,255,.06); }
        .asm-l-title { max-width:700px;margin:23px 0 18px;font-size:clamp(44px,5.5vw,76px);line-height:.99;letter-spacing:-3.8px;font-weight:850;color:#fbfbff; }
        .asm-l-title span { display:inline-block;padding-bottom:8px;color:transparent;background:linear-gradient(94deg,#bca8ff 1%,#8c8aff 48%,#4ddaf0 100%);-webkit-background-clip:text;background-clip:text; }
        .asm-l-description { max-width:570px;margin:0 0 25px;color:#a9b5d3;font-size:16px;line-height:1.8; }
        .asm-l-search { display:flex;align-items:center;gap:11px;max-width:620px;min-height:62px;padding:7px 8px 7px 17px;border:1px solid rgba(157,164,235,.22);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035));box-shadow:0 20px 50px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.1);backdrop-filter:blur(20px);transition:border-color .2s,box-shadow .2s; }
        .asm-l-search:focus-within { border-color:rgba(155,132,255,.62);box-shadow:0 0 0 4px rgba(137,106,255,.1),0 20px 50px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.1); }
        .asm-l-search-icon { color:#8492bb;flex-shrink:0; }
        .asm-l-search input { min-width:0;flex:1;color:#f2f4ff;background:transparent;border:0;outline:0;box-shadow:none;font:inherit;font-size:13px; }
        .asm-l-search input::placeholder { color:#7987ab; }
        .asm-l-search button { border:0;white-space:nowrap; }
        .asm-l-suggestions { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:13px;color:#7080a4;font-size:11px; }
        .asm-l-suggestions button { color:#aab7d9;border:1px solid rgba(157,164,235,.13);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.035);cursor:pointer;transition:all .2s; }
        .asm-l-suggestions button:hover { color:#fff;border-color:rgba(156,137,255,.4);background:rgba(123,92,255,.12); }
        .asm-l-proof { display:flex;align-items:center;gap:17px;flex-wrap:wrap;margin-top:30px;color:#b5c0df;font-size:11px; }
        .asm-l-proof span { display:flex;align-items:center;gap:7px; }
        .asm-l-proof svg { color:#9c8aff; }
        .asm-l-art { position:relative;min-height:470px;display:grid;place-items:center;isolation:isolate; }
        .asm-l-art-orbit { position:absolute;width:min(410px,90%);aspect-ratio:1;border-radius:50%;border:1px solid rgba(147,133,255,.15);box-shadow:0 0 90px rgba(97,73,255,.12),inset 0 0 65px rgba(84,113,255,.06);animation:asm-l-spin 34s linear infinite; }
        .asm-l-art-orbit::before,.asm-l-art-orbit::after { content:"";position:absolute;border-radius:50%;border:1px dashed rgba(123,177,255,.16);inset:24px; }
        .asm-l-art-orbit::after { inset:58px;border-style:solid;border-color:rgba(139,120,255,.13); }
        .asm-l-mascot-glow { position:absolute;width:240px;height:240px;border-radius:50%;background:rgba(111,83,255,.31);filter:blur(48px); }
        .asm-l-mascot { position:relative;z-index:2;display:grid;place-items:center;width:190px;height:190px;border-radius:50%;color:#e0d9ff;background:radial-gradient(circle at 32% 22%,rgba(255,255,255,.3),transparent 24%),linear-gradient(145deg,rgba(129,99,255,.52),rgba(39,106,217,.26));border:1px solid rgba(198,185,255,.43);box-shadow:0 0 70px rgba(124,92,255,.32),inset 0 2px 0 rgba(255,255,255,.25),inset 0 -24px 45px rgba(7,14,43,.3);animation:asm-l-float 5s ease-in-out infinite; }
        .asm-l-mascot svg { filter:drop-shadow(0 0 16px rgba(176,158,255,.5)); }
        .asm-l-cap { position:absolute;z-index:4;top:42px;right:15%;display:grid;place-items:center;width:65px;height:65px;border-radius:21px;color:#f0e8ff;background:linear-gradient(145deg,rgba(158,128,255,.34),rgba(69,177,237,.16));border:1px solid rgba(219,210,255,.3);box-shadow:0 15px 38px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.18);transform:rotate(10deg);animation:asm-l-float 5.5s ease-in-out infinite reverse; }
        .asm-l-float-card { position:absolute;z-index:5;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:15px;background:linear-gradient(145deg,rgba(17,28,62,.86),rgba(13,17,48,.79));border:1px solid rgba(161,166,255,.2);box-shadow:0 18px 38px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(18px);animation:asm-l-float 6s ease-in-out infinite; }
        .asm-l-float-card strong { display:block;color:#f1f2ff;font-size:11px; }
        .asm-l-float-card small { display:block;color:#8f9fc5;font-size:10px;margin-top:3px; }
        .asm-l-float-card--top { top:75px;left:0; }
        .asm-l-float-card--right { right:-4px;top:200px;animation-delay:1.2s; }
        .asm-l-float-card--bottom { left:8%;bottom:44px;animation-delay:2s; }
        .asm-l-float-icon { display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border-radius:11px;color:#d6ceff;background:rgba(132,104,255,.17); }
        .asm-l-books { position:absolute;z-index:1;bottom:3px;width:min(350px,84%);display:flex;flex-direction:column;align-items:center;gap:5px;transform:perspective(600px) rotateX(2deg); }
        .asm-l-book { height:36px;display:flex;align-items:center;justify-content:center;border-radius:7px 13px 13px 7px;border:1px solid rgba(214,204,255,.26);color:#d9d0ff;font-size:13px;font-weight:800;letter-spacing:1px;text-shadow:0 2px 12px rgba(0,0,0,.5);box-shadow:0 12px 20px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.18); }
        .asm-l-book:nth-child(1) { width:70%;background:linear-gradient(100deg,#31276d,#1b326a); }
        .asm-l-book:nth-child(2) { width:83%;background:linear-gradient(100deg,#49317b,#25346f); }
        .asm-l-book:nth-child(3) { width:94%;background:linear-gradient(100deg,#573b80,#27366d); }
        .asm-l-art-floor { position:absolute;bottom:0;width:100%;height:85px;z-index:0;background:radial-gradient(ellipse,rgba(79,66,230,.25),transparent 67%);filter:blur(7px); }
        .asm-l-section { padding:30px 0 78px; }
        .asm-l-section-head { display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:23px; }
        .asm-l-kicker { color:#a69aff;font-weight:800;font-size:10px;letter-spacing:1.8px;text-transform:uppercase; }
        .asm-l-h2 { margin:8px 0 0;font-size:clamp(25px,3vw,35px);letter-spacing:-1.1px;color:#f5f6ff; }
        .asm-l-muted { color:#8998bc;font-size:13px;line-height:1.65; }
        .asm-l-feature-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px; }
        .asm-l-feature { position:relative;overflow:hidden;min-height:190px;padding:22px;border:1px solid rgba(161,166,255,.16);border-radius:22px;background:linear-gradient(145deg,rgba(24,36,76,.76),rgba(9,16,40,.82));box-shadow:0 15px 35px rgba(0,0,0,.13),inset 0 1px rgba(255,255,255,.065);transition:transform .25s,border-color .25s,box-shadow .25s; }
        .asm-l-feature:hover { transform:translateY(-5px);border-color:rgba(157,139,255,.42);box-shadow:0 22px 44px rgba(0,0,0,.22),0 0 30px rgba(112,92,255,.08),inset 0 1px rgba(255,255,255,.08); }
        .asm-l-feature-icon { display:grid;place-items:center;width:47px;height:47px;margin-bottom:22px;border-radius:15px;color:#d8d1ff;background:linear-gradient(145deg,rgba(124,100,255,.28),rgba(43,161,228,.12));border:1px solid rgba(176,161,255,.23); }
        .asm-l-feature h3 { margin:0 0 8px;color:#f0f2ff;font-size:15px; }
        .asm-l-feature p { margin:0;color:#8d9bbd;font-size:12px;line-height:1.65; }
        .asm-l-bottom-cta { display:flex;align-items:center;justify-content:space-between;gap:22px;margin:0 0 70px;padding:clamp(24px,4vw,42px);border:1px solid rgba(165,149,255,.22);border-radius:26px;background:radial-gradient(ellipse at 92% 20%,rgba(76,190,241,.12),transparent 36%),linear-gradient(120deg,rgba(100,76,242,.16),rgba(20,29,70,.78));box-shadow:0 25px 65px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.08); }
        .asm-l-bottom-cta h2 { margin:0 0 8px;color:#f6f6ff;font-size:clamp(22px,3vw,31px);letter-spacing:-1px; }
        .asm-l-footer { display:flex;align-items:center;justify-content:space-between;gap:14px;padding:22px 0 28px;border-top:1px solid rgba(160,173,255,.1);color:#7381a5;font-size:11px; }
        .asm-l-footer-links { display:flex;gap:17px;flex-wrap:wrap; }
        .asm-l-footer a { color:#a4afd0;text-decoration:none; }
        .asm-l-footer a:hover { color:white; }
        @keyframes asm-l-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        @keyframes asm-l-spin { to { transform:rotate(360deg); } }
        @media(max-width:1000px) { .asm-l-navlinks { display:none; } .asm-l-hero { grid-template-columns:1fr 0.85fr;gap:20px;min-height:540px; } .asm-l-title { letter-spacing:-2.7px; } .asm-l-feature-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .asm-l-float-card--right { right:0; } }
        @media(max-width:740px) { .asm-l-wrap { padding:0 17px; } .asm-l-nav { min-height:68px; } .asm-l-actions { gap:3px; } .asm-l-login { padding:9px; } .asm-l-cta { padding:11px 13px; } .asm-l-hero { grid-template-columns:1fr;gap:0;padding:43px 0 24px; } .asm-l-title { font-size:clamp(42px,11vw,63px);letter-spacing:-2.6px; } .asm-l-description { font-size:14px; } .asm-l-art { min-height:360px;max-width:520px;width:100%;margin:5px auto 10px; } .asm-l-mascot { width:150px;height:150px; } .asm-l-mascot svg { width:57px;height:57px; } .asm-l-art-orbit { width:min(330px,80vw); } .asm-l-cap { top:20px;right:17%;width:56px;height:56px; } .asm-l-float-card--top { left:-3px;top:52px; } .asm-l-float-card--right { right:-3px;top:171px; } .asm-l-float-card--bottom { bottom:28px;left:0; } .asm-l-books { width:280px; } .asm-l-book { height:31px; } .asm-l-proof { font-size:10px;gap:10px; } .asm-l-section { padding:25px 0 50px; } .asm-l-feature-grid { gap:11px; } .asm-l-feature { padding:16px;min-height:174px; } .asm-l-feature-icon { width:40px;height:40px;margin-bottom:16px; } .asm-l-section-head { align-items:flex-start;flex-direction:column; } .asm-l-bottom-cta { align-items:flex-start;flex-direction:column;margin-bottom:45px; } .asm-l-footer { align-items:flex-start;flex-direction:column; } }
        @media(prefers-reduced-motion:reduce) { .asm-landing *, .asm-landing *::before, .asm-landing *::after { animation-duration:.01ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:.01ms !important; } }
      `}</style>

      <div className="asm-l-wrap">
        <header className="asm-l-nav">
          <Link className="asm-l-brand" to="/" aria-label="AI StudyMate home">
            <span className="asm-l-brand-mark"><BrainCircuit size={23} /></span>
            <span>AI StudyMate</span>
          </Link>

          <nav className="asm-l-navlinks" aria-label="Main navigation">
            <a href="#top">Home</a>
            <a href="#features">Courses</a>
            <a href="#features">Practice</a>
            <a href="#features">AI Tutor</a>
            <a href="#features">Notes</a>
          </nav>

          <div className="asm-l-actions">
            <Link className="asm-l-login" to="/login">Login</Link>
            <Link className="asm-l-cta" to="/register">Start Learning <ArrowRight size={16} /></Link>
          </div>
        </header>

        <section className="asm-l-hero" id="top">
          <div className="asm-l-copy">
            <div className="asm-l-eyebrow"><Sparkles size={14} /> LEARN · PRACTICE · GROW</div>
            <h1 className="asm-l-title">Learn smarter<br />with AI <span>StudyMate ✦</span></h1>
            <p className="asm-l-description">
              Your all-in-one learning space for AI-powered notes, videos, coding practice, quizzes and personalized study paths.
            </p>

            <form className="asm-l-search" onSubmit={handleExplore}>
              <BookOpen className="asm-l-search-icon" size={21} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search courses, programming, subjects, topics..."
                aria-label="Search courses and subjects"
              />
              <button className="asm-l-cta" type="submit">Explore <ArrowRight size={15} /></button>
            </form>

            <div className="asm-l-suggestions">
              <span>Try:</span>
              {['C Programming', 'Python', 'Data Structures'].map((term) => (
                <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>
              ))}
            </div>

            <div className="asm-l-proof">
              <span><CheckCircle2 size={15} /> Personalized learning</span>
              <span><LockKeyhole size={15} /> Your own learning space</span>
            </div>
          </div>

          <div className="asm-l-art" aria-label="AI StudyMate learning mascot illustration">
            <div className="asm-l-art-orbit" />
            <div className="asm-l-mascot-glow" />
            <div className="asm-l-mascot"><Bot size={78} strokeWidth={1.55} /></div>
            <div className="asm-l-cap"><GraduationCap size={32} /></div>
            <div className="asm-l-float-card asm-l-float-card--top">
              <span className="asm-l-float-icon"><GraduationCap size={18} /></span>
              <span><strong>Smart Learning</strong><small>Personalized for you</small></span>
            </div>
            <div className="asm-l-float-card asm-l-float-card--right">
              <span className="asm-l-float-icon" style={{ color: '#76e8fa', background: 'rgba(29,187,221,.13)' }}><Target size={18} /></span>
              <span><strong>AI Progress</strong><small>Keep improving</small></span>
            </div>
            <div className="asm-l-float-card asm-l-float-card--bottom">
              <span className="asm-l-float-icon" style={{ color: '#ffd27a', background: 'rgba(255,180,64,.12)' }}><Zap size={18} /></span>
              <span><strong>One step at a time</strong><small>Build your study streak</small></span>
            </div>
            <div className="asm-l-books" aria-hidden="true">
              <div className="asm-l-book">LEARN</div>
              <div className="asm-l-book">PRACTICE</div>
              <div className="asm-l-book">GROW</div>
            </div>
            <div className="asm-l-art-floor" />
          </div>
        </section>

        <section className="asm-l-section" id="features">
          <div className="asm-l-section-head">
            <div>
              <div className="asm-l-kicker">YOUR LEARNING TOOLKIT</div>
              <h2 className="asm-l-h2">Everything you need to move forward.</h2>
            </div>
            <p className="asm-l-muted">A little progress every day adds up.</p>
          </div>

          <div className="asm-l-feature-grid">
            {[
              { icon: FileText, title: 'Smart Notes', desc: 'Keep course materials and key ideas organized in one place.' },
              { icon: Youtube, title: 'Video Learning', desc: 'Find topic-focused videos to support your learning.' },
              { icon: Code2, title: 'Coding Practice', desc: 'Practice C, Python, Java and SQL with coding challenges.' },
              { icon: BarChart3, title: 'Track Progress', desc: 'Return to your courses and keep your learning moving.' },
            ].map((feature) => (
              <article className="asm-l-feature" key={feature.title}>
                <div className="asm-l-feature-icon"><feature.icon size={23} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="asm-l-bottom-cta">
          <div>
            <div className="asm-l-kicker">YOUR NEXT CHAPTER</div>
            <h2>Turn curiosity into confidence.</h2>
            <p className="asm-l-muted" style={{ margin: 0 }}>Create your learning space and start with a subject you love.</p>
          </div>
          <Link className="asm-l-cta" to="/register">Create free account <ArrowDownRight size={16} /></Link>
        </section>

        <footer className="asm-l-footer">
          <Link className="asm-l-brand" to="/">
            <span className="asm-l-brand-mark" style={{ width: 30, height: 30, borderRadius: 10 }}><BrainCircuit size={17} /></span>
            <span>AI StudyMate</span>
          </Link>
          <span>Learn · Practice · Grow</span>
          <div className="asm-l-footer-links">
            <Link to="/login">Login</Link>
            <Link to="/register">Create account</Link>
            <a href="#features"><MessageCircle size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Learning tools</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
