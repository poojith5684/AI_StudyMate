import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  LogOut,
  BookOpen,
  ArrowRight,
  Upload,
  MessageSquare,
  Target,
  Play,
  Search,
  Loader2,
} from 'lucide-react';

import { coursesApi } from '../services/api';
import { signOut } from '../services/supabase';
import type { Course } from '../types';

export default function MyCourses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userName =
    localStorage.getItem('user_name') ||
    localStorage.getItem('user_email') ||
    'Student';

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login');
      return;
    }

    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await coursesApi.list();

      setCourses(data);
    } catch (err: any) {
      console.error('Failed to load courses:', err);
      setError(err?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="my-courses-page">

      <style>{`
        * {
          box-sizing: border-box;
        }

        .my-courses-page {
          min-height: 100vh;
          color: #f8fafc;

          background:
            radial-gradient(
              circle at 10% 5%,
              rgba(124, 58, 237, 0.18),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 30%,
              rgba(6, 182, 212, 0.12),
              transparent 30%
            ),
            radial-gradient(
              circle at 50% 100%,
              rgba(124, 58, 237, 0.08),
              transparent 35%
            ),
            #070b18;
        }

        .courses-nav {
          height: 70px;
          padding: 0 32px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          position: sticky;
          top: 0;
          z-index: 50;

          background: rgba(7, 11, 24, 0.72);
          backdrop-filter: blur(24px);

          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;

          color: white;
          text-decoration: none;

          font-size: 17px;
          font-weight: 700;
        }

        .brand-icon {
          width: 40px;
          height: 40px;

          display: grid;
          place-items: center;

          border-radius: 13px;

          color: #c4b5fd;

          background:
            linear-gradient(
              145deg,
              rgba(124,58,237,0.30),
              rgba(59,130,246,0.15)
            );

          border: 1px solid rgba(139,92,246,0.28);

          box-shadow:
            0 0 25px rgba(124,58,237,0.12),
            inset 0 1px rgba(255,255,255,0.08);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .user-name {
          color: #a1a9bb;
          font-size: 14px;
        }

        .logout {
          display: flex;
          align-items: center;
          gap: 6px;

          padding: 8px 11px;

          color: #94a3b8;
          background: transparent;

          border: 0;
          border-radius: 9px;

          cursor: pointer;

          transition: 0.2s;
        }

        .logout:hover {
          color: white;
          background: rgba(255,255,255,0.06);
        }

        .page-container {
          max-width: 1200px;
          margin: 0 auto;

          padding: 42px 28px 80px;
        }

        .back {
          display: inline-flex;
          align-items: center;
          gap: 7px;

          margin-bottom: 28px;

          color: #8d99ae;
          text-decoration: none;

          font-size: 14px;

          transition: 0.2s;
        }

        .back:hover {
          color: white;
        }

        .heading-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;

          margin-bottom: 34px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;

          color: #9b7cff;

          font-size: 11px;
          font-weight: 800;

          letter-spacing: 1.6px;
        }

        .page-title {
          margin: 7px 0 5px;

          font-size: 43px;
          line-height: 1.1;

          letter-spacing: -1.5px;
        }

        .subtitle {
          margin: 0;

          color: #69758a;
          font-size: 15px;
        }

        .course-count {
          color: #8b5cf6;
          font-size: 13px;

          padding: 9px 13px;

          border-radius: 12px;

          background: rgba(124,58,237,0.10);
          border: 1px solid rgba(139,92,246,0.16);
        }

        .courses-grid {
          display: grid;

          grid-template-columns:
            repeat(
              auto-fill,
              minmax(330px, 1fr)
            );

          gap: 20px;
        }

        .course-card {
          position: relative;

          min-height: 280px;

          padding: 23px;

          border-radius: 22px;

          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.055),
              rgba(255,255,255,0.018)
            );

          border: 1px solid rgba(255,255,255,0.08);

          backdrop-filter: blur(20px);

          overflow: hidden;

          transition:
            transform 0.25s ease,
            border-color 0.25s ease,
            box-shadow 0.25s ease;
        }

        .course-card::before {
          content: '';

          position: absolute;

          width: 180px;
          height: 180px;

          top: -100px;
          right: -70px;

          background: rgba(124,58,237,0.15);

          filter: blur(55px);

          pointer-events: none;
        }

        .course-card:hover {
          transform: translateY(-6px);

          border-color: rgba(139,92,246,0.35);

          box-shadow:
            0 20px 55px rgba(0,0,0,0.28),
            0 0 30px rgba(124,58,237,0.08);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-bottom: 24px;
        }

        .course-icon {
          width: 54px;
          height: 54px;

          display: grid;
          place-items: center;

          border-radius: 16px;

          color: #c4b5fd;

          background:
            linear-gradient(
              145deg,
              rgba(124,58,237,0.22),
              rgba(79,70,229,0.10)
            );

          border: 1px solid rgba(139,92,246,0.18);

          box-shadow:
            inset 0 1px rgba(255,255,255,0.08);
        }

        .open-button {
          width: 38px;
          height: 38px;

          display: grid;
          place-items: center;

          border-radius: 50%;

          color: #a5b4fc;

          background: rgba(255,255,255,0.045);

          transition: 0.25s;
        }

        .course-card:hover .open-button {
          color: white;

          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #4f46e5
            );

          transform: translateX(3px);
        }

        .course-label {
          margin-bottom: 8px;

          color: #8b7cff;

          font-size: 10px;
          font-weight: 800;

          letter-spacing: 1.5px;
        }

        .course-title {
          margin: 0 0 6px;

          color: white;

          font-size: 22px;
          font-weight: 700;
        }

        .course-description {
          min-height: 22px;

          margin: 0;

          color: #667389;

          font-size: 13px;
        }

        .progress-section {
          margin-top: 27px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;

          margin-bottom: 8px;

          color: #68758b;

          font-size: 11px;
        }

        .progress-percent {
          color: #a5b4fc;
          font-weight: 700;
        }

        .progress-track {
          height: 6px;

          overflow: hidden;

          border-radius: 999px;

          background: rgba(255,255,255,0.065);
        }

        .progress-fill {
          height: 100%;

          border-radius: inherit;

          background:
            linear-gradient(
              90deg,
              #7c3aed,
              #22d3ee
            );

          box-shadow:
            0 0 12px rgba(124,58,237,0.35);
        }

        .course-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-top: 22px;

          color: #64748b;

          font-size: 12px;
        }

        .materials {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .start {
          display: flex;
          align-items: center;
          gap: 5px;

          color: #94a3b8;
        }

        .tags {
          display: flex;
          gap: 7px;

          margin-top: 17px;
        }

        .tag {
          display: flex;
          align-items: center;
          gap: 5px;

          padding: 6px 9px;

          border-radius: 8px;

          font-size: 11px;
        }

        .tag-tutor {
          color: #c4b5fd;
          background: rgba(124,58,237,0.14);
        }

        .tag-quiz {
          color: #67e8f9;
          background: rgba(6,182,212,0.12);
        }

        .tag-learn {
          color: #6ee7b7;
          background: rgba(16,185,129,0.12);
        }

        .loading {
          min-height: 350px;

          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;

          gap: 15px;

          color: #7c879a;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        .error-box {
          padding: 22px;

          border-radius: 18px;

          color: #fca5a5;

          background: rgba(239,68,68,0.08);

          border: 1px solid rgba(239,68,68,0.18);
        }

        .retry {
          margin-top: 14px;

          padding: 9px 14px;

          color: white;

          background: #7c3aed;

          border: 0;
          border-radius: 9px;

          cursor: pointer;
        }

        .empty {
          padding: 70px 25px;

          text-align: center;

          border-radius: 24px;

          background: rgba(255,255,255,0.025);

          border: 1px solid rgba(255,255,255,0.07);
        }

        .empty-icon {
          width: 72px;
          height: 72px;

          display: grid;
          place-items: center;

          margin: 0 auto 18px;

          border-radius: 22px;

          color: #a78bfa;

          background: rgba(124,58,237,0.12);
        }

        .empty h3 {
          margin: 0 0 8px;

          font-size: 19px;
        }

        .empty p {
          margin: 0;

          color: #64748b;
        }

        .browse {
          display: inline-flex;
          align-items: center;
          gap: 7px;

          margin-top: 20px;

          padding: 11px 17px;

          color: white;
          text-decoration: none;

          border-radius: 12px;

          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #4f46e5
            );
        }

        @media(max-width: 700px) {

          .courses-nav {
            padding: 0 16px;
          }

          .user-name {
            display: none;
          }

          .page-container {
            padding: 30px 16px 60px;
          }

          .heading-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 15px;
          }

          .page-title {
            font-size: 35px;
          }

          .courses-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ================= NAVBAR ================= */}

      <nav className="courses-nav">

        <Link
          to="/dashboard"
          className="brand"
        >
          <div className="brand-icon">
            <Brain size={21} />
          </div>

          <span>
            AI <strong>StudyMate</strong>
          </span>
        </Link>

        <div className="nav-right">

          <span className="user-name">
            {userName}
          </span>

          <button
            className="logout"
            onClick={logout}
          >
            <LogOut size={17} />
            Logout
          </button>

        </div>

      </nav>

      {/* ================= CONTENT ================= */}

      <main className="page-container">

        <Link
          to="/dashboard"
          className="back"
        >
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        <div className="heading-row">

          <div>

            <div className="eyebrow">
              <BookOpen size={14} />
              YOUR LEARNING
            </div>

            <h1 className="page-title">
              My Courses
            </h1>

            <p className="subtitle">
              Pick up where you left off and keep making progress.
            </p>

          </div>

          {!loading && !error && (
            <div className="course-count">
              {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
            </div>
          )}

        </div>

        {/* ================= LOADING ================= */}

        {loading && (
          <div className="loading">

            <Loader2
              size={34}
              className="spinner"
            />

            <span>
              Loading your courses...
            </span>

          </div>
        )}

        {/* ================= ERROR ================= */}

        {!loading && error && (
          <div className="error-box">

            <strong>
              Could not load your courses
            </strong>

            <p>
              {error}
            </p>

            <button
              className="retry"
              onClick={loadCourses}
            >
              Try Again
            </button>

          </div>
        )}

        {/* ================= EMPTY ================= */}

        {!loading && !error && courses.length === 0 && (
          <div className="empty">

            <div className="empty-icon">
              <Search size={32} />
            </div>

            <h3>
              No courses yet
            </h3>

            <p>
              Create a course from your dashboard to start learning.
            </p>

            <Link
              to="/dashboard"
              className="browse"
            >
              <Search size={17} />
              Explore Courses
            </Link>

          </div>
        )}

        {/* ================= COURSES ================= */}

        {!loading && !error && courses.length > 0 && (

          <div className="courses-grid">

            {courses.map((course) => {

              const progress = 0;

              return (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >

                  <article className="course-card">

                    <div className="card-top">

                      <div className="course-icon">
                        <BookOpen size={27} />
                      </div>

                      <div className="open-button">
                        <ArrowRight size={18} />
                      </div>

                    </div>

                    <div className="course-label">
                      COURSE
                    </div>

                    <h2 className="course-title">
                      {course.title}
                    </h2>

                    <p className="course-description">
                      {course.description ||
                        course.subject ||
                        'Continue learning and improve your skills.'}
                    </p>

                    <div className="progress-section">

                      <div className="progress-header">

                        <span>
                          Progress
                        </span>

                        <span className="progress-percent">
                          {progress}%
                        </span>

                      </div>

                      <div className="progress-track">

                        <div
                          className="progress-fill"
                          style={{
                            width: `${progress}%`,
                          }}
                        />

                      </div>

                    </div>

                    <div className="course-meta">

                      <span className="materials">

                        <Upload size={14} />

                        {course.material_count || 0}

                        {' '}

                        {course.material_count === 1
                          ? 'material'
                          : 'materials'}

                      </span>

                      <span className="start">

                        <Play size={13} />

                        Start learning

                      </span>

                    </div>

                    <div className="tags">

                      <span className="tag tag-tutor">

                        <MessageSquare size={12} />

                        AI Tutor

                      </span>

                      <span className="tag tag-quiz">

                        <Target size={12} />

                        Quiz

                      </span>

                      <span className="tag tag-learn">

                        <Play size={11} />

                        Learn

                      </span>

                    </div>

                  </article>

                </Link>
              );
            })}

          </div>

        )}

      </main>

    </div>
  );
}
