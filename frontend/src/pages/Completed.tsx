import { Link } from 'react-router-dom';
import { signOut } from '../services/supabase';
import {
  ArrowLeft,
  Brain,
  LogOut,
  Trophy,
  Award,
  Star,
} from 'lucide-react';

export default function Completed() {
  const userName =
    localStorage.getItem('user_name') ||
    localStorage.getItem('user_email') ||
    'Student';

  const logout = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div className="completed-page">

      <style>{`

        .completed-page {
          min-height: 100vh;
          color: #f8fafc;
          background:
            radial-gradient(
              circle at 20% 10%,
              rgba(124,58,237,0.14),
              transparent 30%
            ),
            radial-gradient(
              circle at 85% 50%,
              rgba(34,197,94,0.08),
              transparent 30%
            ),
            #070b18;
        }

        .topbar {
          height: 72px;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(7,11,24,0.72);
          backdrop-filter: blur(22px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          text-decoration: none;
        }

        .brand-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          color: #c4b5fd;
          background: rgba(124,58,237,0.15);
        }

        .user-area {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #94a3b8;
          font-size: 14px;
        }

        .logout {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 0;
          color: #94a3b8;
          background: transparent;
          cursor: pointer;
        }

        .container {
          max-width: 1100px;
          margin: auto;
          padding: 45px 28px 80px;
        }

        .back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #94a3b8;
          text-decoration: none;
          margin-bottom: 30px;
        }

        .eyebrow {
          color: #fbbf24;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        h1 {
          font-size: 42px;
          margin: 8px 0;
        }

        .subtitle {
          color: #64748b;
          margin-bottom: 35px;
        }

        .empty {
          padding: 75px 20px;
          text-align: center;
          border-radius: 24px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .trophy {
          width: 80px;
          height: 80px;
          display: grid;
          place-items: center;
          margin: auto;
          border-radius: 24px;
          color: #fbbf24;
          background: rgba(245,158,11,0.12);
          box-shadow: 0 0 40px rgba(245,158,11,0.08);
        }

        .empty h2 {
          margin: 20px 0 8px;
        }

        .empty p {
          color: #64748b;
        }

        .stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 25px;
          color: #94a3b8;
          font-size: 13px;
        }

      `}</style>

      <nav className="topbar">

        <Link to="/dashboard" className="brand">
          <div className="brand-icon">
            <Brain size={21} />
          </div>

          AI <strong>StudyMate</strong>
        </Link>

        <div className="user-area">

          <span>
            {userName}
          </span>

          <button className="logout" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>

        </div>

      </nav>

      <main className="container">

        <Link to="/dashboard" className="back">
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        <div className="eyebrow">
          🏆 ACHIEVEMENTS
        </div>

        <h1>
          Completed Courses
        </h1>

        <p className="subtitle">
          Your achievements and completed learning journeys.
        </p>

        <div className="empty">

          <div className="trophy">
            <Trophy size={40} />
          </div>

          <h2>
            Your achievements are waiting
          </h2>

          <p>
            Complete a course to unlock your certificate and
            achievement here.
          </p>

          <div className="stats">

            <span>
              <Award size={15} />
              0 Certificates
            </span>

            <span>
              <Star size={15} />
              0 Achievements
            </span>

          </div>

        </div>

      </main>

    </div>
  );
}
