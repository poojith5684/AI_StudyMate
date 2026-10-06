import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export function syncStoredSession(session: Session | null) {
  if (!session?.access_token) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    return;
  }

  localStorage.setItem('access_token', session.access_token);
  if (session.user.email) {
    localStorage.setItem('user_email', session.user.email);
  }

  const fullName = session.user.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) {
    localStorage.setItem('user_name', fullName.trim());
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Always clear the local session, including when the network is unavailable.
  } finally {
    syncStoredSession(null);
  }
}
