import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { supabase, syncStoredSession } from '../services/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(180deg, #0f172a, #1e1b4b)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Brain size={40} color="#818cf8" style={{ marginBottom: 12 }} />
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem' }}>Create account</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Start your AI-powered learning journey</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#cbd5e1' }}>Full Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#cbd5e1' }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#cbd5e1' }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 14, margin: 0 }}>{error}</p>}
          {notice && <p role="status" style={{ color: '#86efac', fontSize: 14, margin: 0 }}>{notice}</p>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#94a3b8' }}>
          Already have an account? <Link to="/login" style={{ color: '#818cf8' }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
