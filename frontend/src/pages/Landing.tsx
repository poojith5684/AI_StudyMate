import { Link } from 'react-router-dom';
import { BookOpen, Brain, Target, BarChart3, MessageSquare, FileText, Sparkles, ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.35rem' }}>
          <Brain size={28} color="#818cf8" />
          <span>AI StudyMate</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/login" style={{ color: '#cbd5e1', textDecoration: 'none', padding: '0.5rem 1rem' }}>Login</Link>
          <Link to="/register" className="btn-primary" style={{ textDecoration: 'none' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '5rem 1.5rem 4rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 999, padding: '0.4rem 1rem', marginBottom: '1.5rem', fontSize: 14, color: '#a5b4fc' }}>
          <Sparkles size={16} /> Multimodal AI Hackathon 2026 — Track D
        </div>
        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 1.25rem', background: 'linear-gradient(135deg, #fff 30%, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your Personal AI Study Companion
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: 620, margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Upload lecture videos, textbooks & slides. Get source-cited answers, adaptive quizzes, and personalized tutoring powered by RAG.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Start Learning Free <ArrowRight size={18} />
          </Link>
          <Link to="/login" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', color: '#e2e8f0', textDecoration: 'none' }}>
            Login
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {[
            { icon: FileText, title: '1. Upload Materials', desc: 'PDF textbooks, PowerPoint lectures, or transcripts' },
            { icon: Brain, title: '2. Build Knowledge Base', desc: 'AI chunks, embeds & indexes your content with citations' },
            { icon: MessageSquare, title: '3. Ask AI Tutor', desc: 'Get grounded answers with page & slide references' },
            { icon: Target, title: '4. Adaptive Quizzes', desc: 'Practice weak topics with difficulty that adapts to you' },
          ].map((item, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <item.icon size={32} color="#818cf8" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{item.title}</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Powerful Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {[
            { icon: BookOpen, title: 'Source-Cited Knowledge', desc: 'Every answer links back to the exact page or slide from your materials. No hallucinations.' },
            { icon: BarChart3, title: 'Progress Tracking', desc: 'See strong & weak topics, accuracy trends, and get clear next-step recommendations.' },
            { icon: Target, title: 'Adaptive Learning', desc: 'Quizzes get easier or harder based on your real performance. Focus where it matters.' },
            { icon: MessageSquare, title: 'Personalized Tutor', desc: 'Ask for simple explanations, detailed breakdowns, summaries or examples anytime.' },
          ].map((f, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 16 }}>
              <div style={{ background: 'rgba(79,70,229,0.15)', borderRadius: 12, padding: 12, height: 'fit-content' }}>
                <f.icon size={24} color="#818cf8" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>{f.title}</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', padding: '3rem 1.5rem 5rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Ready to study smarter?</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Join the future of personalized learning.</p>
        <Link to="/register" className="btn-primary" style={{ textDecoration: 'none' }}>Create Free Account</Link>
      </section>

      <footer style={{ borderTop: '1px solid #1e293b', padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        AI StudyMate · Multimodal AI Hackathon 2026 · Track D
      </footer>
    </div>
  );
}
