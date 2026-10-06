import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, syncStoredSession } from '../services/supabase';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncStoredSession(session);
      if (active) setAuthenticated(Boolean(session?.access_token));
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const session = error ? null : data.session;
      syncStoredSession(session);
      setAuthenticated(Boolean(session?.access_token));
    }).catch(() => {
      if (!active) return;
      syncStoredSession(null);
      setAuthenticated(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authenticated === null) return null;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}
