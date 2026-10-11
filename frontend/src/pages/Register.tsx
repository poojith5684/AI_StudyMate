import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { supabase, syncStoredSession } from '../services/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session?.access_token) {
        syncStoredSession(data.session);
        navigate('/dashboard');
      } else {
        setNotice('Account created. Check your email to confirm your account, then sign in.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (googleError) throw googleError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <main className="asm-login">
      <style>{`
        .asm-login, .asm-login * { box-sizing: border-box; }
        .asm-login {
          --asm-ink: #f5f3ff;
          --asm-muted: #a8b0cc;
          --asm-purple: #9b87ff;
          --asm-cyan: #6ee7f9;
          min-height: 100vh;
          min-height: 100dvh;
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 34px 24px;
          color: var(--asm-ink);
          background:
            radial-gradient(ellipse at 13% 12%, rgba(111, 76, 255, .24), transparent 34%),
            radial-gradient(ellipse at 87% 84%, rgba(41, 188, 219, .14), transparent 33%),
            linear-gradient(135deg, #080b1a 0%, #11142d 49%, #171238 100%);
          isolation: isolate;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .asm-login::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: .16;
          pointer-events: none;
          background-image: radial-gradient(rgba(205, 211, 255, .6) .7px, transparent .7px);
          background-size: 25px 25px;
          mask-image: linear-gradient(to bottom right, black, transparent 78%);
        }
        .asm-login__orb { position: absolute; z-index: -1; border-radius: 999px; filter: blur(1px); pointer-events: none; }
        .asm-login__orb--one { width: 300px; height: 300px; top: -150px; left: 12%; background: radial-gradient(circle, rgba(130, 91, 255, .2), transparent 72%); animation: asm-login-drift 13s ease-in-out infinite alternate; }
        .asm-login__orb--two { width: 360px; height: 360px; right: -170px; bottom: -170px; background: radial-gradient(circle, rgba(65, 219, 233, .17), transparent 72%); animation: asm-login-drift 16s ease-in-out infinite alternate-reverse; }
        .asm-login__layout { width: min(1120px, 100%); display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 440px); align-items: center; gap: clamp(42px, 7vw, 100px); }
        .asm-login__hero { position: relative; padding: 20px 0 24px; }
        .asm-login__brand { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 58px; color: white; font-size: 15px; font-weight: 750; letter-spacing: -.2px; }
        .asm-login__brand-mark { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 15px; color: white; background: linear-gradient(135deg, #9675ff, #6252dc 60%, #44c9e6); box-shadow: 0 10px 34px rgba(126, 95, 255, .32), inset 0 1px 0 rgba(255,255,255,.45); }
        .asm-login__eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 20px; color: #d5ccff; background: rgba(151, 126, 255, .1); border: 1px solid rgba(177, 158, 255, .22); border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .4px; box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
        .asm-login__headline { max-width: 610px; margin: 0; font-size: clamp(38px, 5vw, 64px); line-height: 1.05; letter-spacing: -2.8px; font-weight: 800; }
        .asm-login__headline span { display: block; padding-bottom: 7px; color: transparent; background: linear-gradient(100deg, #c7bbff 4%, #9c8aff 45%, #72e7f3 98%); background-clip: text; -webkit-background-clip: text; }
        .asm-login__description { max-width: 490px; margin: 23px 0 28px; color: #a8b0cc; font-size: 16px; line-height: 1.8; }
        .asm-login__features { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 34px; }
        .asm-login__feature { display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; color: #d7dcf3; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); border-radius: 12px; font-size: 12px; backdrop-filter: blur(12px); }
        .asm-login__feature svg { color: #a99aff; }
        .asm-login__art { position: relative; height: 190px; max-width: 440px; }
        .asm-login__art-glow { position: absolute; width: 245px; height: 125px; left: 50%; top: 32px; transform: translateX(-50%); border-radius: 50%; background: rgba(126, 100, 255, .22); filter: blur(38px); }
        .asm-login__study-card { position: absolute; left: 38px; top: 26px; width: 270px; padding: 17px; border: 1px solid rgba(255,255,255,.15); border-radius: 20px; background: linear-gradient(145deg, rgba(255,255,255,.13), rgba(255,255,255,.045)); box-shadow: 0 22px 55px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.18); backdrop-filter: blur(20px); transform: rotate(-4deg); animation: asm-login-float 6s ease-in-out infinite; }
        .asm-login__study-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; color: #dfe3f9; font-size: 11px; font-weight: 700; }
        .asm-login__mini-icon { display: grid; place-items: center; width: 33px; height: 33px; border-radius: 11px; color: #d7ceff; background: rgba(155,135,255,.18); }
        .asm-login__progress-label { display: flex; justify-content: space-between; gap: 12px; margin: 14px 0 8px; color: #c1c9e2; font-size: 10px; }
        .asm-login__progress-track { height: 6px; overflow: hidden; background: rgba(255,255,255,.09); border-radius: 999px; }
        .asm-login__progress-fill { width: 72%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #9a83ff, #68e2f4); box-shadow: 0 0 13px rgba(111, 225, 245, .35); }
        .asm-login__floating-cap { position: absolute; right: 39px; top: 0; display: grid; place-items: center; width: 65px; height: 65px; border-radius: 22px; color: #e6e0ff; background: linear-gradient(145deg, rgba(151,126,255,.3), rgba(93,207,239,.13)); border: 1px solid rgba(216,209,255,.25); box-shadow: 0 17px 37px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.2); transform: rotate(9deg); animation: asm-login-float 5s ease-in-out infinite reverse; }
        .asm-login__floating-book { position: absolute; right: 4px; bottom: 12px; display: grid; place-items: center; width: 51px; height: 51px; border-radius: 17px; color: #83e6f5; background: rgba(55,197,224,.12); border: 1px solid rgba(110,231,249,.24); box-shadow: 0 12px 28px rgba(0,0,0,.18); animation: asm-login-float 5.5s ease-in-out infinite; }
        .asm-login__trust { display: flex; align-items: center; gap: 9px; color: #8f9ab9; font-size: 12px; }
        .asm-login__trust svg { color: #6ee7b7; }
        .asm-login__panel { position: relative; padding: 31px; overflow: hidden; border: 1px solid rgba(255,255,255,.15); border-radius: 28px; background: linear-gradient(145deg, rgba(255,255,255,.115), rgba(255,255,255,.045)); box-shadow: 0 30px 90px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.17); backdrop-filter: blur(26px); }
        .asm-login__panel::before { content: ""; position: absolute; top: -120px; right: -90px; width: 240px; height: 200px; pointer-events: none; background: radial-gradient(circle, rgba(154,130,255,.2), transparent 70%); }
        .asm-login__panel-head { position: relative; margin-bottom: 27px; }
        .asm-login__panel-icon { display: grid; place-items: center; width: 46px; height: 46px; margin-bottom: 19px; border: 1px solid rgba(181,164,255,.27); border-radius: 15px; color: #ded7ff; background: linear-gradient(145deg, rgba(151,126,255,.25), rgba(91,211,236,.12)); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
        .asm-login__panel-title { margin: 0 0 7px; color: #fff; font-size: 28px; letter-spacing: -.9px; font-weight: 760; }
        .asm-login__panel-subtitle { margin: 0; color: #a8b0cc; font-size: 13px; line-height: 1.6; }
        .asm-login__form { display: flex; flex-direction: column; gap: 17px; }
        .asm-login__field-label { display: block; margin-bottom: 8px; color: #d8ddf0; font-size: 12px; font-weight: 650; }
        .asm-login__input-wrap { position: relative; }
        .asm-login__field-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #8d98bb; pointer-events: none; }
        .asm-login__input { width: 100%; min-height: 49px; padding: 13px 44px 13px 42px; color: #f7f6ff; background: rgba(8,12,31,.48); border: 1px solid rgba(192,198,238,.16); border-radius: 12px; outline: none; font: inherit; font-size: 13px; box-shadow: inset 0 1px 2px rgba(0,0,0,.12); transition: border-color .2s, box-shadow .2s, background .2s; }
        .asm-login__input::placeholder { color: #697493; }
        .asm-login__input:focus { background: rgba(8,12,31,.67); border-color: rgba(166,146,255,.8); box-shadow: 0 0 0 3px rgba(151,126,255,.13), inset 0 1px 2px rgba(0,0,0,.12); }
        .asm-login__input:disabled { opacity: .65; }
        .asm-login__password-toggle { position: absolute; top: 50%; right: 11px; display: grid; place-items: center; width: 29px; height: 29px; transform: translateY(-50%); color: #97a1c0; background: transparent; border: 0; border-radius: 8px; cursor: pointer; }
        .asm-login__password-toggle:hover { color: #fff; background: rgba(255,255,255,.07); }
        .asm-login__error { margin: 0; padding: 11px 12px; color: #fecaca; background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.23); border-radius: 10px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
        .asm-login__submit { display: flex; justify-content: center; align-items: center; gap: 9px; width: 100%; min-height: 49px; margin-top: 3px; padding: 12px 16px; color: white; font: inherit; font-size: 13px; font-weight: 750; border: 1px solid rgba(216,208,255,.32); border-radius: 12px; cursor: pointer; background: linear-gradient(105deg, #8871f5, #7657e8 55%, #536ee7); box-shadow: 0 9px 23px rgba(112,88,233,.29), inset 0 1px 0 rgba(255,255,255,.25); transition: transform .2s, box-shadow .2s, filter .2s; }
        .asm-login__submit:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 13px 29px rgba(112,88,233,.38), inset 0 1px 0 rgba(255,255,255,.3); }
        .asm-login__submit:active:not(:disabled) { transform: translateY(0); }
        .asm-login__submit:disabled, .asm-login__google:disabled { cursor: wait; opacity: .7; }
        .asm-login__divider { display: flex; align-items: center; gap: 12px; margin: 21px 0; color: #7f89a9; font-size: 10px; font-weight: 700; letter-spacing: 1px; }
        .asm-login__divider::before, .asm-login__divider::after { content: ""; flex: 1; height: 1px; background: rgba(185,191,229,.14); }
        .asm-login__google { display: flex; justify-content: center; align-items: center; gap: 11px; width: 100%; min-height: 49px; padding: 12px 16px; color: #f4f5ff; font: inherit; font-size: 13px; font-weight: 700; border: 1px solid rgba(204,210,244,.2); border-radius: 12px; background: rgba(255,255,255,.065); cursor: pointer; transition: background .2s, transform .2s, border-color .2s; }
        .asm-login__google:hover:not(:disabled) { transform: translateY(-1px); border-color: rgba(212,207,255,.38); background: rgba(255,255,255,.105); }
        .asm-login__google-mark { display: grid; place-items: center; width: 22px; height: 22px; flex: 0 0 auto; border-radius: 50%; color: #fff; background: #fff; }
        .asm-login__register { margin: 24px 0 0; text-align: center; color: #9ca6c4; font-size: 12px; }
        .asm-login__register a { color: #d1c8ff; font-weight: 750; text-decoration: none; }
        .asm-login__register a:hover { color: #fff; text-decoration: underline; }
        .asm-login__footnote { display: flex; justify-content: center; align-items: center; gap: 7px; margin-top: 19px; color: #74809f; font-size: 10px; }
        .asm-login__footnote svg { color: #79dfb3; }
        @keyframes asm-login-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -10px; } }
        @keyframes asm-login-drift { from { transform: translate3d(-8px, 0, 0) scale(.96); } to { transform: translate3d(18px, 18px, 0) scale(1.08); } }
        @media (max-width: 860px) {
          .asm-login { padding: 24px 17px; }
          .asm-login__layout { width: min(470px, 100%); grid-template-columns: 1fr; gap: 20px; }
          .asm-login__hero { padding: 0; }
          .asm-login__brand { margin-bottom: 25px; }
          .asm-login__headline { max-width: 540px; font-size: clamp(32px, 8vw, 45px); letter-spacing: -1.8px; }
          .asm-login__description { margin: 13px 0 16px; font-size: 13px; line-height: 1.65; }
          .asm-login__eyebrow { margin-bottom: 13px; }
          .asm-login__features, .asm-login__art, .asm-login__trust { display: none; }
          .asm-login__panel { padding: 26px 22px; border-radius: 23px; }
          .asm-login__panel-head { margin-bottom: 22px; }
          .asm-login__panel-icon { margin-bottom: 14px; }
        }
        @media (max-width: 390px) {
          .asm-login__panel { padding: 23px 17px; }
          .asm-login__brand { margin-bottom: 21px; }
          .asm-login__panel-title { font-size: 25px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .asm-login *, .asm-login *::before, .asm-login *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }

        .asm-login__notice { margin:0; padding:11px 12px; color:#a7f3d0; background:rgba(16,185,129,.1); border:1px solid rgba(110,231,183,.22); border-radius:10px; font-size:12px; line-height:1.55; }
        .asm-login__input--name { padding-left:42px; }
`}</style>
      <div className="asm-login__orb asm-login__orb--one" />
      <div className="asm-login__orb asm-login__orb--two" />

      <div className="asm-login__layout">
        <section className="asm-login__hero" aria-label="AI StudyMate introduction">
          <Link to="/" className="asm-login__brand" style={{ textDecoration: 'none' }}>
            <span className="asm-login__brand-mark"><Brain size={23} /></span>
            <span>AI StudyMate</span>
          </Link>

          <div className="asm-login__eyebrow"><Sparkles size={14} /> YOUR PERSONAL AI LEARNING SPACE</div>
          <h1 className="asm-login__headline">
            Start your learning journey.
            <span>Make your next step count.</span>
          </h1>
          <p className="asm-login__description">
            Build your own study space for courses, notes, coding practice and AI-powered learning — all in one place.
          </p>

          <div className="asm-login__features">
            <span className="asm-login__feature"><Brain size={15} /> AI-powered learning</span>
            <span className="asm-login__feature"><BookOpen size={15} /> Notes & smart quizzes</span>
            <span className="asm-login__feature"><CheckCircle2 size={15} /> Progress tracking</span>
          </div>

          <div className="asm-login__art" aria-hidden="true">
            <div className="asm-login__art-glow" />
            <div className="asm-login__study-card">
              <div className="asm-login__study-card-top">
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="asm-login__mini-icon"><BookOpen size={17} /></span>
                  YOUR LEARNING JOURNEY
                </span>
                <Sparkles size={16} color="#8fe8f5" />
              </div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 750 }}>Every expert starts somewhere.</div>
              <div className="asm-login__progress-label"><span>First step</span><span>100%</span></div>
              <div className="asm-login__progress-track"><div className="asm-login__progress-fill" style={{ width: '100%' }} /></div>
            </div>
            <div className="asm-login__floating-cap"><GraduationCap size={32} /></div>
            <div className="asm-login__floating-book"><BookOpen size={23} /></div>
          </div>

          <div className="asm-login__trust"><ShieldCheck size={16} /> A focused space for your learning journey</div>
        </section>

        <section className="asm-login__panel" aria-label="Create an AI StudyMate account">
          <div className="asm-login__panel-head">
            <div className="asm-login__panel-icon"><GraduationCap size={24} /></div>
            <h2 className="asm-login__panel-title">Create your account</h2>
            <p className="asm-login__panel-subtitle">Set up your learning space and start exploring.</p>
          </div>

          <form className="asm-login__form" onSubmit={handleSubmit}>
            <div>
              <label className="asm-login__field-label" htmlFor="asm-register-name">Full name</label>
              <div className="asm-login__input-wrap">
                <UserRound className="asm-login__field-icon" size={17} />
                <input
                  id="asm-register-name"
                  className="asm-login__input asm-login__input--name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            <div>
              <label className="asm-login__field-label" htmlFor="asm-register-email">Email address</label>
              <div className="asm-login__input-wrap">
                <Mail className="asm-login__field-icon" size={17} />
                <input
                  id="asm-register-email"
                  className="asm-login__input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={loading || googleLoading}
                />
              </div>
            </div>

            <div>
              <label className="asm-login__field-label" htmlFor="asm-register-password">Password</label>
              <div className="asm-login__input-wrap">
                <LockKeyhole className="asm-login__field-icon" size={17} />
                <input
                  id="asm-register-password"
                  className="asm-login__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={loading || googleLoading}
                />
                <button
                  type="button"
                  className="asm-login__password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <p className="asm-login__error" role="alert">{error}</p>}
            {notice && <p className="asm-login__notice" role="status">{notice}</p>}

            <button className="asm-login__submit" type="submit" disabled={loading || googleLoading}>
              {loading ? 'Creating account…' : <>Create my account <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="asm-login__divider">OR CONTINUE WITH</div>

          <button className="asm-login__google" type="button" onClick={handleGoogleSignIn} disabled={loading || googleLoading}>
            <span className="asm-login__google-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" transform="translate(0 4)" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.74 6.01c4.52-4.18 7.06-10.33 7.06-17.66z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56z" transform="translate(0 4)" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.79l-7.74-6.01c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </span>
            {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
          </button>

          <p className="asm-login__register">
            Already have an account? <Link to="/login">Sign in <ArrowRight size={12} style={{ verticalAlign: '-2px' }} /></Link>
          </p>
          <div className="asm-login__footnote"><ShieldCheck size={13} /> Your learning space, ready when you are</div>
        </section>
      </div>
    </main>
  );
}
