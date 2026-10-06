import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Brain,
  Plus,
  BookOpen,
  LogOut,
  Upload,
  MessageSquare,
  Target,
  Search,
  Sparkles,
  Trophy,
  Play,
  ArrowRight,
  Clock3,
  Flame,
  GraduationCap,
  X,
  Trash2,
} from 'lucide-react';

import { coursesApi } from '../services/api';
import { signOut } from '../services/supabase';
import type { Course } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');

  const userName =
    localStorage.getItem('user_name') ||
    localStorage.getItem('user_email') ||
    'Student';

  /* =========================================================
     LOAD COURSES
  ========================================================= */

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login');
      return;
    }

    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await coursesApi.list();

      setCourses(data);
    } catch (err) {
      console.error('LOAD COURSES ERROR:', err);

      /*
        Do not crash the dashboard if loading courses fails.
      */

      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     CREATE COURSE
  ========================================================= */

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      alert('Please enter a course title.');
      return;
    }

    setCreating(true);

    try {
      const course = await coursesApi.create({
        title: cleanTitle,
        description: description.trim(),
        subject: 'General',
      });

      console.log('COURSE CREATED:', course);

      /*
        Add the newly created course immediately.
        Do NOT call loadCourses() here because if the GET request
        fails, it can clear the course we just created.
      */

      setCourses((prev) => [
        course,
        ...prev.filter((c) => c.id !== course.id),
      ]);

      setShowCreate(false);
      setTitle('');
      setDescription('');

      setSuccessMessage(
        `"${course.title}" was created successfully.`
      );

      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);

    } catch (err: any) {
      console.error('CREATE COURSE ERROR:', err);

      alert(
        err?.message ||
          'Failed to create course. Please make sure the backend is running on http://127.0.0.1:8000'
      );
    } finally {
      setCreating(false);
    }
  };

  /* =========================================================
     ADD COURSE FROM SEARCH
  ========================================================= */

  const handleAddFromSearch = async () => {
    const courseName = search.trim();

    if (!courseName) {
      return;
    }

    /*
      Check if exact course already exists.
    */

    const existingCourse = courses.find(
      (course) =>
        course.title.trim().toLowerCase() ===
        courseName.toLowerCase()
    );

    /*
      If already registered,
      simply open that course.
    */

    if (existingCourse) {
      navigate(
        `/courses/${existingCourse.id}`
      );

      return;
    }

    setCreating(true);

    try {
      const course = await coursesApi.create({
        title: courseName,
        description:
          `Personalized learning course for ${courseName}`,
        subject: 'General',
      });

      console.log('SEARCH COURSE CREATED:', course);

      setCourses((prev) => [
        course,
        ...prev.filter((c) => c.id !== course.id),
      ]);

      setSearch('');

      /*
        Open the newly added course.
      */

      navigate(`/courses/${course.id}`);

    } catch (err: any) {
      console.error('ADD SEARCH COURSE ERROR:', err);

      alert(
        err?.message ||
          'Failed to add course. Please make sure the backend is running on http://127.0.0.1:8000'
      );
    } finally {
      setCreating(false);
    }
  };

  /* =========================================================
     DELETE COURSE
  ========================================================= */

  const handleDeleteCourse = async (
    e: React.MouseEvent,
    courseId: string,
    courseTitle: string
  ) => {
    e.preventDefault();

    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${courseTitle}"?\n\n` +
        `This will remove the course from your registered courses.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await coursesApi.delete(courseId);

      /*
        Remove immediately from UI.
      */

      setCourses((prev) =>
        prev.filter(
          (course) =>
            course.id !== courseId
        )
      );

    } catch (err: any) {
      console.error('DELETE COURSE ERROR:', err);

      alert(
        err?.message ||
          'Failed to delete course'
      );
    }
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  /* =========================================================
     SEARCHED COURSES
  ========================================================= */

  const filteredCourses =
    courses.filter((course) =>
      course.title
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  /*
    Exact registered course.
  */

  const exactCourse = courses.find(
    (course) =>
      course.title.trim().toLowerCase() ===
      search.trim().toLowerCase()
  );

  /*
    Partial registered courses.
  */

  const matchingCourses =
    courses.filter((course) =>
      course.title
        .toLowerCase()
        .includes(
          search.trim().toLowerCase()
        )
    );

  return (
    <div className="study-home">

      {/* =====================================================
          AMBIENT BACKGROUND
      ===================================================== */}

      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <nav className="glass-nav">

        <div className="nav-left">

          <Link
            to="/dashboard"
            className="brand"
          >

            <div className="brand-icon">
              <Brain size={22} />
            </div>

            <span>
              AI <strong>StudyMate</strong>
            </span>

          </Link>

          <div className="nav-links">

            <Link
              to="/dashboard"
              className="nav-link active"
            >
              Home
            </Link>

            <Link
              to="/my-courses"
              className="nav-link"
            >
              My Courses
            </Link>

            <Link
              to="/completed"
              className="nav-link"
            >
              Completed
            </Link>

          </div>

        </div>

        <div className="nav-right">

          <div className="user-mini">

            <div className="avatar">
              {userName
                .charAt(0)
                .toUpperCase()}
            </div>

            <span>
              {userName}
            </span>

          </div>

          <button
            className="logout-btn"
            onClick={logout}
          >

            <LogOut size={17} />

            <span>
              Logout
            </span>

          </button>

        </div>

      </nav>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="home-container">

        {successMessage && (
          <div className="success-banner" role="status">
            {successMessage}
          </div>
        )}

        {/* ===================================================
            HERO
        =================================================== */}

        <section className="hero-section">

          <div className="hero-content">

            <div className="welcome-pill">

              <Sparkles size={15} />

              AI-powered personalized learning

            </div>

            <h1>

              Learn smarter.

              <br />

              <span className="gradient-text">
                Grow faster.
              </span>

            </h1>

            <p className="hero-description">

              Your intelligent study companion for courses,
              notes, quizzes, exams and personalized learning.

            </p>

            {/* =================================================
                SEARCH
            ================================================= */}

            <div className="search-wrapper">

              <Search
                size={22}
                className="search-icon"
              />

              <input
                type="text"
                placeholder="Search courses, programming, subjects, topics..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

              {search && (

                <button
                  type="button"
                  className="clear-search"
                  onClick={() =>
                    setSearch('')
                  }
                >

                  <X size={17} />

                </button>

              )}

              <button
                type="button"
                className="search-button"
                onClick={() => {
                  if (exactCourse) {
                    navigate(
                      `/courses/${exactCourse.id}`
                    );
                  }
                }}
              >
                Search
              </button>

            </div>

            {/* =================================================
                SEARCH RESULTS
            ================================================= */}

            {search.trim() && (

              <div className="search-results">

                {/* EXACT REGISTERED COURSE */}

                {exactCourse ? (

                  <div className="search-result-card">

                    <div className="search-result-icon registered">

                      <BookOpen size={21} />

                    </div>

                    <div className="search-result-info">

                      <span className="search-result-label">
                        REGISTERED COURSE
                      </span>

                      <strong>
                        {exactCourse.title}
                      </strong>

                      <small>
                        You are already registered
                        for this course.
                      </small>

                    </div>

                    <div className="search-result-actions">

                      <button
                        type="button"
                        className="open-course-btn"
                        onClick={() =>
                          navigate(
                            `/courses/${exactCourse.id}`
                          )
                        }
                      >

                        Open Course

                        <ArrowRight size={15} />

                      </button>

                      <button
                        type="button"
                        className="search-delete-btn"
                        onClick={(e) =>
                          handleDeleteCourse(
                            e,
                            exactCourse.id,
                            exactCourse.title
                          )
                        }
                        title="Delete course"
                      >

                        <Trash2 size={16} />

                      </button>

                    </div>

                  </div>

                ) : matchingCourses.length > 0 ? (

                  /* =================================================
                     PARTIAL REGISTERED COURSES
                  ================================================= */

                  <div className="search-matches">

                    <span className="search-match-title">
                      REGISTERED COURSES
                    </span>

                    {matchingCourses
                      .slice(0, 5)
                      .map((course) => (

                        <div
                          key={course.id}
                          className="search-match-row"
                        >

                          <div className="search-match-left">

                            <div className="search-match-icon">

                              <BookOpen size={17} />

                            </div>

                            <div>

                              <strong>
                                {course.title}
                              </strong>

                              <small>
                                Registered course
                              </small>

                            </div>

                          </div>

                          <div className="search-match-actions">

                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/courses/${course.id}`
                                )
                              }
                            >
                              Open
                            </button>

                            <button
                              type="button"
                              className="mini-delete"
                              onClick={(e) =>
                                handleDeleteCourse(
                                  e,
                                  course.id,
                                  course.title
                                )
                              }
                            >

                              <Trash2 size={14} />

                            </button>

                          </div>

                        </div>

                      ))}

                  </div>

                ) : (

                  /* =================================================
                     NEW COURSE
                  ================================================= */

                  <div className="new-search-course">

                    <div className="search-result-icon new">

                      <Plus size={21} />

                    </div>

                    <div className="search-result-info">

                      <span className="search-result-label new-label">
                        NEW COURSE
                      </span>

                      <strong>
                        {search.trim()}
                      </strong>

                      <small>
                        This course is not registered yet.
                      </small>

                    </div>

                    <button
                      type="button"
                      className="add-search-course-btn"
                      onClick={
                        handleAddFromSearch
                      }
                      disabled={creating}
                    >

                      <Plus size={16} />

                      {creating
                        ? 'Adding...'
                        : 'Add New Course'}

                    </button>

                  </div>

                )}

              </div>

            )}

            {/* =================================================
                SEARCH HINTS
            ================================================= */}

            <div className="search-hints">

              <span>
                Try:
              </span>

              <button
                type="button"
                onClick={() =>
                  setSearch(
                    'C Programming'
                  )
                }
              >
                C Programming
              </button>

              <button
                type="button"
                onClick={() =>
                  setSearch('Python')
                }
              >
                Python
              </button>

              <button
                type="button"
                onClick={() =>
                  setSearch(
                    'Data Structures'
                  )
                }
              >
                Data Structures
              </button>

            </div>

          </div>

          {/* =================================================
              HERO VISUAL
          ================================================= */}

          <div className="hero-visual">

            <div className="orb orb-main">

              <Brain size={70} />

            </div>

            <div className="floating-card floating-card-one">

              <div className="floating-icon purple">

                <GraduationCap size={20} />

              </div>

              <div>

                <strong>
                  Smart Learning
                </strong>

                <span>
                  Personalized for you
                </span>

              </div>

            </div>

            <div className="floating-card floating-card-two">

              <div className="floating-icon cyan">

                <Target size={20} />

              </div>

              <div>

                <strong>
                  AI Progress
                </strong>

                <span>
                  Keep improving
                </span>

              </div>

            </div>

            <div className="floating-card floating-card-three">

              <Flame size={20} />

              <strong>
                7 day streak
              </strong>

            </div>

          </div>

        </section>

        {/* =====================================================
            STATS
        ===================================================== */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon purple">

              <BookOpen size={22} />

            </div>

            <div>

              <span>
                Active Courses
              </span>

              <strong>
                {courses.length}
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon cyan">

              <Target size={22} />

            </div>

            <div>

              <span>
                Learning Progress
              </span>

              <strong>
                0%
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon orange">

              <Flame size={22} />

            </div>

            <div>

              <span>
                Study Streak
              </span>

              <strong>
                7 Days
              </strong>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon green">

              <Trophy size={22} />

            </div>

            <div>

              <span>
                Completed
              </span>

              <strong>
                0
              </strong>

            </div>

          </div>

        </section>

        {/* =====================================================
            SECTION HEADER
        ===================================================== */}

        <section className="section-header">

          <div>

            <div className="section-eyebrow">

              <Sparkles size={15} />

              YOUR LEARNING

            </div>

            <h2>
              Continue your journey
            </h2>

            <p>
              Pick up where you left off and keep making progress.
            </p>

          </div>

          <button
            type="button"
            className="new-course-btn"
            onClick={() =>
              setShowCreate(true)
            }
          >

            <Plus size={18} />

            New Course

          </button>

        </section>

        {/* =====================================================
            COURSES
        ===================================================== */}

        {loading ? (

          <div className="loading-card">

            <div className="loading-spinner" />

            <p>
              Preparing your learning space...
            </p>

          </div>

        ) : filteredCourses.length === 0 ? (

          <div className="empty-card">

            <div className="empty-icon">

              {search ? (
                <Search size={35} />
              ) : (
                <BookOpen size={35} />
              )}

            </div>

            <h3>

              {search
                ? 'No matching courses'
                : 'Your learning journey starts here'}

            </h3>

            <p>

              {search
                ? 'Use the Add New Course option above to register this course.'
                : 'Create your first course and start learning with AI StudyMate.'}

            </p>

            {!search && (

              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  setShowCreate(true)
                }
              >

                <Plus size={18} />

                Create Your First Course

              </button>

            )}

          </div>

        ) : (

          <div className="course-grid">

            {filteredCourses.map(
              (course, index) => (

                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="course-link"
                >

                  <div
                    className="course-card"
                    style={{
                      animationDelay:
                        `${index * 80}ms`,
                    }}
                  >

                    <div className="course-top">

                      <div className="course-symbol">

                        <BookOpen size={23} />

                      </div>

                      <div className="course-card-actions">

                        <button
                          type="button"
                          className="course-delete-btn"
                          onClick={(e) =>
                            handleDeleteCourse(
                              e,
                              course.id,
                              course.title
                            )
                          }
                          title={`Delete ${course.title}`}
                        >

                          <Trash2 size={16} />

                        </button>

                        <div className="course-arrow">

                          <ArrowRight size={19} />

                        </div>

                      </div>

                    </div>

                    <div className="course-content">

                      <span className="course-label">
                        COURSE
                      </span>

                      <h3>
                        {course.title}
                      </h3>

                      {course.description && (

                        <p>
                          {course.description}
                        </p>

                      )}

                    </div>

                    <div className="course-progress">

                      <div className="progress-header">

                        <span>
                          Progress
                        </span>

                        <strong>
                          0%
                        </strong>

                      </div>

                      <div className="progress-track">

                        <div
                          className="progress-fill"
                          style={{
                            width: '0%',
                          }}
                        />

                      </div>

                    </div>

                    <div className="course-meta">

                      <span>

                        <Upload size={14} />

                        {course.material_count ||
                          0}{' '}
                        materials

                      </span>

                      <span>

                        <Clock3 size={14} />

                        Start learning

                      </span>

                    </div>

                    <div className="course-tags">

                      <span className="tag purple-tag">

                        <MessageSquare size={13} />

                        AI Tutor

                      </span>

                      <span className="tag cyan-tag">

                        <Target size={13} />

                        Quiz

                      </span>

                      <span className="tag green-tag">

                        <Play size={13} />

                        Learn

                      </span>

                    </div>

                  </div>

                </Link>

              )
            )}

          </div>

        )}

        {/* =====================================================
            QUICK ACTIONS
        ===================================================== */}

        <section className="quick-section">

          <div className="section-eyebrow">

            <Sparkles size={15} />

            QUICK ACTIONS

          </div>

          <div className="quick-grid">

            <div className="quick-card">

              <div className="quick-icon purple">

                <MessageSquare size={23} />

              </div>

              <div>

                <h3>
                  Ask AI Tutor
                </h3>

                <p>
                  Get instant explanations from your study material.
                </p>

              </div>

              <ArrowRight size={18} />

            </div>

            <div className="quick-card">

              <div className="quick-icon cyan">

                <Target size={23} />

              </div>

              <div>

                <h3>
                  Take a Quiz
                </h3>

                <p>
                  Test your knowledge and discover weak topics.
                </p>

              </div>

              <ArrowRight size={18} />

            </div>

            <div className="quick-card">

              <div className="quick-icon green">

                <Trophy size={23} />

              </div>

              <div>

                <h3>
                  Track Progress
                </h3>

                <p>
                  See your learning progress and achievements.
                </p>

              </div>

              <ArrowRight size={18} />

            </div>

          </div>

        </section>

      </main>

      {/* =====================================================
          CREATE COURSE MODAL
      ===================================================== */}

      {showCreate && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowCreate(false)
          }
        >

          <div
            className="create-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              type="button"
              className="modal-close"
              onClick={() =>
                setShowCreate(false)
              }
            >

              <X size={20} />

            </button>

            <div className="modal-icon">

              <Plus size={25} />

            </div>

            <h2>
              Create a new course
            </h2>

            <p>
              Start building your personalized learning space.
            </p>

            <form
              onSubmit={handleCreate}
              className="create-form"
            >

              <label>
                Course title
              </label>

              <input
                className="glass-input"
                placeholder="e.g. C Programming"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                required
              />

              <label>
                Description
              </label>

              <textarea
                className="glass-input"
                placeholder="What do you want to learn?"
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                rows={4}
              />

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() =>
                    setShowCreate(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={creating}
                >

                  {creating ? (
                    'Creating...'
                  ) : (
                    <>
                      <Sparkles size={17} />

                      Create Course
                    </>
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          STYLES
      ===================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .success-banner {
          margin: 24px auto 0;
          max-width: 1180px;
          padding: 12px 16px;
          border: 1px solid rgba(134, 239, 172, 0.45);
          border-radius: 12px;
          background: rgba(22, 163, 74, 0.14);
          color: #bbf7d0;
          font-weight: 600;
        }

        .study-home {
          min-height: 100vh;
          color: #f8fafc;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(99,102,241,0.14),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 20%,
              rgba(6,182,212,0.10),
              transparent 28%
            ),
            #070b18;
          position: relative;
          overflow: hidden;
        }

        .ambient {
          position: fixed;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(110px);
          pointer-events: none;
          opacity: 0.16;
          z-index: 0;
          animation: ambientFloat 12s ease-in-out infinite;
        }

        .ambient-one {
          background: #7c3aed;
          top: -180px;
          left: -150px;
        }

        .ambient-two {
          background: #06b6d4;
          right: -180px;
          top: 35%;
          animation-delay: 3s;
        }

        .ambient-three {
          background: #ec4899;
          bottom: -220px;
          left: 35%;
          animation-delay: 6s;
        }

        @keyframes ambientFloat {
          0%,100% {
            transform: translate(0,0) scale(1);
          }

          50% {
            transform: translate(35px,-25px) scale(1.08);
          }
        }

        /* =====================================================
           NAVBAR
        ===================================================== */

        .glass-nav {
          height: 72px;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(7,11,24,0.72);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .nav-left,
        .nav-right {
          display: flex;
          align-items: center;
        }

        .nav-left {
          gap: 42px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          text-decoration: none;
          font-size: 17px;
          font-weight: 600;
        }

        .brand strong {
          font-weight: 800;
        }

        .brand-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: #c4b5fd;
          background:
            linear-gradient(
              135deg,
              rgba(124,58,237,0.35),
              rgba(6,182,212,0.2)
            );
          border: 1px solid rgba(167,139,250,0.3);
          box-shadow:
            0 0 25px rgba(124,58,237,0.25),
            inset 0 1px rgba(255,255,255,0.1);
        }

        .nav-links {
          display: flex;
          gap: 8px;
        }

        .nav-link {
          color: #94a3b8;
          text-decoration: none;
          padding: 9px 13px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: 0.25s ease;
        }

        .nav-link:hover,
        .nav-link.active {
          color: white;
          background: rgba(255,255,255,0.07);
        }

        .nav-link.active {
          box-shadow:
            inset 0 0 0 1px rgba(139,92,246,0.18);
        }

        .nav-right {
          gap: 18px;
        }

        .user-mini {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #cbd5e1;
          font-size: 14px;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #2563eb
            );
          font-weight: 700;
          font-size: 13px;
          box-shadow:
            0 0 20px rgba(124,58,237,0.35);
        }

        .logout-btn {
          border: 0;
          color: #94a3b8;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .logout-btn:hover {
          color: #f8fafc;
        }

        /* =====================================================
           MAIN
        ===================================================== */

        .home-container {
          max-width: 1250px;
          margin: auto;
          padding: 40px 28px 80px;
          position: relative;
          z-index: 1;
        }

        /* =====================================================
           HERO
        ===================================================== */

        .hero-section {
          min-height: 480px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          align-items: center;
          gap: 40px;
        }

        .welcome-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #c4b5fd;
          background: rgba(124,58,237,0.10);
          border: 1px solid rgba(139,92,246,0.22);
          border-radius: 999px;
          padding: 8px 13px;
          font-size: 13px;
          margin-bottom: 22px;
        }

        .hero-content h1 {
          font-size: clamp(45px,6vw,76px);
          line-height: 0.98;
          letter-spacing: -3px;
          margin: 0;
          font-weight: 800;
        }

        .gradient-text {
          background:
            linear-gradient(
              90deg,
              #a78bfa,
              #60a5fa,
              #22d3ee
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-description {
          max-width: 600px;
          color: #94a3b8;
          font-size: 17px;
          line-height: 1.7;
          margin: 25px 0;
        }

        /* =====================================================
           SEARCH
        ===================================================== */

        .search-wrapper {
          max-width: 690px;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 7px 8px 7px 19px;
          border-radius: 18px;
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.25),
            inset 0 1px rgba(255,255,255,0.07);
          backdrop-filter: blur(20px);
          transition: 0.3s ease;
        }

        .search-wrapper:focus-within {
          border-color: rgba(139,92,246,0.55);
          box-shadow:
            0 0 35px rgba(124,58,237,0.16),
            inset 0 1px rgba(255,255,255,0.08);
        }

        .search-icon {
          color: #64748b;
          flex-shrink: 0;
        }

        .search-wrapper input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: white;
          font-size: 15px;
        }

        .search-wrapper input::placeholder {
          color: #64748b;
        }

        .search-button {
          height: 48px;
          padding: 0 23px;
          border: 0;
          border-radius: 13px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #4f46e5
            );
          box-shadow:
            0 8px 25px rgba(99,102,241,0.3);
          transition: 0.25s ease;
        }

        .search-button:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 32px rgba(99,102,241,0.42);
        }

        .clear-search {
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }

        .clear-search:hover {
          color: white;
        }

        /* =====================================================
           SEARCH RESULTS
        ===================================================== */

        .search-results {
          width: 100%;
          max-width: 690px;
          margin-top: 10px;
          border-radius: 18px;
          overflow: hidden;
          background:
            rgba(15,23,42,0.94);
          border:
            1px solid rgba(255,255,255,0.09);
          box-shadow:
            0 25px 60px rgba(0,0,0,0.35),
            inset 0 1px rgba(255,255,255,0.05);
          backdrop-filter: blur(25px);
          animation:
            searchResultIn 0.2s ease;
        }

        @keyframes searchResultIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .search-result-card,
        .new-search-course {
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .search-result-card {
          background:
            rgba(124,58,237,0.06);
        }

        .search-result-icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
        }

        .search-result-icon.registered {
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.15);
        }

        .search-result-icon.new {
          color: #67e8f9;
          background:
            rgba(6,182,212,0.12);
        }

        .search-result-info {
          flex: 1;
          min-width: 0;
        }

        .search-result-label {
          display: block;
          color: #8b5cf6;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.2px;
          margin-bottom: 3px;
        }

        .new-label {
          color: #22d3ee;
        }

        .search-result-info strong {
          display: block;
          color: white;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .search-result-info small {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
        }

        .search-result-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .open-course-btn,
        .add-search-course-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 0;
          border-radius: 10px;
          padding: 9px 12px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #4f46e5
            );
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: 0.2s ease;
        }

        .open-course-btn:hover,
        .add-search-course-btn:hover {
          transform: translateY(-1px);
          box-shadow:
            0 8px 20px rgba(99,102,241,0.3);
        }

        .add-search-course-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .search-delete-btn {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border:
            1px solid rgba(239,68,68,0.15);
          border-radius: 9px;
          color: #f87171;
          background:
            rgba(239,68,68,0.08);
          cursor: pointer;
        }

        .search-delete-btn:hover {
          background:
            rgba(239,68,68,0.16);
        }

        .search-matches {
          padding: 12px;
        }

        .search-match-title {
          display: block;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.2px;
          padding: 3px 5px 8px;
        }

        .search-match-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 7px;
          border-radius: 11px;
          transition: 0.2s ease;
        }

        .search-match-row:hover {
          background:
            rgba(255,255,255,0.04);
        }

        .search-match-left {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .search-match-icon {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          color: #a78bfa;
          background:
            rgba(124,58,237,0.10);
          border-radius: 9px;
        }

        .search-match-left strong {
          display: block;
          color: #e2e8f0;
          font-size: 12px;
        }

        .search-match-left small {
          display: block;
          color: #64748b;
          font-size: 10px;
          margin-top: 2px;
        }

        .search-match-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .search-match-actions > button {
          border: 0;
          border-radius: 8px;
          padding: 7px 10px;
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.10);
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
        }

        .search-match-actions > button:hover {
          background:
            rgba(124,58,237,0.18);
        }

        .search-match-actions .mini-delete {
          width: 30px;
          height: 30px;
          padding: 0;
          display: grid;
          place-items: center;
          color: #f87171;
          background:
            rgba(239,68,68,0.08);
        }

        .search-match-actions .mini-delete:hover {
          background:
            rgba(239,68,68,0.16);
        }

        .search-hints {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 13px;
          font-size: 12px;
          color: #64748b;
          flex-wrap: wrap;
        }

        .search-hints button {
          color: #94a3b8;
          background:
            rgba(255,255,255,0.035);
          border:
            1px solid rgba(255,255,255,0.07);
          border-radius: 999px;
          padding: 5px 10px;
          cursor: pointer;
        }

        .search-hints button:hover {
          color: white;
          border-color:
            rgba(139,92,246,0.3);
        }

        /* =====================================================
           HERO VISUAL
        ===================================================== */

        .hero-visual {
          height: 420px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .orb {
          display: grid;
          place-items: center;
          border-radius: 50%;
        }

        .orb-main {
          width: 220px;
          height: 220px;
          color: #c4b5fd;
          background:
            radial-gradient(
              circle at 30% 25%,
              rgba(255,255,255,0.20),
              transparent 25%
            ),
            linear-gradient(
              135deg,
              rgba(124,58,237,0.45),
              rgba(37,99,235,0.25)
            );
          border:
            1px solid rgba(167,139,250,0.3);
          box-shadow:
            0 0 80px rgba(124,58,237,0.25),
            inset 0 1px rgba(255,255,255,0.2);
          animation:
            orbFloat 5s ease-in-out infinite;
        }

        .orb-main::after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          border:
            1px solid rgba(139,92,246,0.10);
          animation:
            pulseRing 4s ease-in-out infinite;
        }

        @keyframes orbFloat {
          0%,100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-15px);
          }
        }

        @keyframes pulseRing {
          0%,100% {
            transform: scale(0.9);
            opacity: 0.4;
          }

          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }

        .floating-card {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 15px;
          border-radius: 15px;
          background:
            rgba(15,23,42,0.68);
          border:
            1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(20px);
          box-shadow:
            0 20px 45px rgba(0,0,0,0.25),
            inset 0 1px rgba(255,255,255,0.07);
          animation:
            cardFloat 5s ease-in-out infinite;
        }

        .floating-card strong {
          display: block;
          font-size: 12px;
        }

        .floating-card span {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .floating-card-one {
          top: 55px;
          left: 5px;
        }

        .floating-card-two {
          right: 5px;
          top: 160px;
          animation-delay: 1s;
        }

        .floating-card-three {
          bottom: 45px;
          left: 80px;
          color: #fbbf24;
          animation-delay: 2s;
        }

        @keyframes cardFloat {
          0%,100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-10px);
          }
        }

        .floating-icon,
        .stat-icon,
        .quick-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .floating-icon {
          width: 36px;
          height: 36px;
          border-radius: 11px;
        }

        .purple {
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.15);
        }

        .cyan {
          color: #67e8f9;
          background:
            rgba(6,182,212,0.13);
        }

        .orange {
          color: #fbbf24;
          background:
            rgba(245,158,11,0.13);
        }

        .green {
          color: #86efac;
          background:
            rgba(34,197,94,0.13);
        }

        /* =====================================================
           STATS
        ===================================================== */

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(4,1fr);
          gap: 14px;
          margin: 15px 0 65px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px;
          border-radius: 18px;
          background:
            rgba(255,255,255,0.035);
          border:
            1px solid rgba(255,255,255,0.07);
          box-shadow:
            inset 0 1px rgba(255,255,255,0.04);
          transition: 0.25s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          background:
            rgba(255,255,255,0.05);
          border-color:
            rgba(139,92,246,0.22);
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 13px;
        }

        .stat-card span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .stat-card strong {
          font-size: 20px;
        }

        /* =====================================================
           SECTION HEADER
        ===================================================== */

        .section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .section-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #8b5cf6;
          font-size: 11px;
          letter-spacing: 1.5px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .section-header p {
          color: #64748b;
          margin: 7px 0 0;
          font-size: 14px;
        }

        .new-course-btn,
        .primary-btn {
          border: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: white;
          cursor: pointer;
          font-weight: 600;
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              #7c3aed,
              #4f46e5
            );
          box-shadow:
            0 10px 28px rgba(99,102,241,0.25);
          transition: 0.25s ease;
        }

        .new-course-btn {
          padding: 12px 17px;
        }

        .primary-btn {
          padding: 12px 18px;
        }

        .new-course-btn:hover,
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 14px 34px rgba(99,102,241,0.38);
        }

        .new-course-btn:disabled,
        .primary-btn:disabled {
          opacity: 0.6;
          cursor: wait;
          transform: none;
        }

        /* =====================================================
           COURSE GRID
        ===================================================== */

        .course-grid {
          display: grid;
          grid-template-columns:
            repeat(3,1fr);
          gap: 18px;
        }

        .course-link {
          text-decoration: none;
          color: inherit;
        }

        .course-card {
          min-height: 300px;
          padding: 22px;
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.065),
              rgba(255,255,255,0.025)
            );
          border:
            1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 20px 50px rgba(0,0,0,0.15),
            inset 0 1px rgba(255,255,255,0.06);
          backdrop-filter: blur(18px);
          transition: 0.3s ease;
          animation:
            courseAppear 0.5s ease both;
          position: relative;
          overflow: hidden;
        }

        .course-card::before {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background:
            rgba(124,58,237,0.10);
          filter: blur(45px);
          top: -70px;
          right: -50px;
        }

        .course-card:hover {
          transform: translateY(-7px);
          border-color:
            rgba(139,92,246,0.32);
          box-shadow:
            0 28px 60px rgba(0,0,0,0.28),
            0 0 35px rgba(124,58,237,0.08),
            inset 0 1px rgba(255,255,255,0.08);
        }

        @keyframes courseAppear {
          from {
            opacity: 0;
            transform: translateY(15px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .course-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .course-card-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .course-symbol {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.14);
          border:
            1px solid rgba(139,92,246,0.16);
        }

        .course-arrow {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          color: #64748b;
          border-radius: 50%;
          background:
            rgba(255,255,255,0.04);
          transition: 0.25s ease;
        }

        .course-delete-btn {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border:
            1px solid rgba(239,68,68,0.12);
          border-radius: 9px;
          color: #64748b;
          background:
            rgba(255,255,255,0.035);
          cursor: pointer;
          transition: 0.2s ease;
        }

        .course-delete-btn:hover {
          color: #f87171;
          background:
            rgba(239,68,68,0.10);
          border-color:
            rgba(239,68,68,0.25);
        }

        .course-card:hover .course-arrow {
          color: white;
          background:
            rgba(124,58,237,0.2);
          transform:
            translateX(3px);
        }

        .course-content {
          margin-top: 25px;
        }

        .course-label {
          color: #6366f1;
          font-size: 10px;
          letter-spacing: 1.4px;
          font-weight: 800;
        }

        .course-content h3 {
          font-size: 21px;
          margin: 7px 0;
        }

        .course-content p {
          color: #64748b;
          font-size: 13px;
          line-height: 1.6;
          min-height: 42px;
          margin: 0;
        }

        .course-progress {
          margin-top: 21px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          color: #64748b;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .progress-header strong {
          color: #a5b4fc;
        }

        .progress-track {
          height: 5px;
          border-radius: 999px;
          overflow: hidden;
          background:
            rgba(255,255,255,0.06);
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
        }

        .course-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 17px;
          color: #64748b;
          font-size: 11px;
        }

        .course-meta span {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .course-tags {
          display: flex;
          gap: 7px;
          margin-top: 16px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 10px;
        }

        .purple-tag {
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.12);
        }

        .cyan-tag {
          color: #67e8f9;
          background:
            rgba(6,182,212,0.10);
        }

        .green-tag {
          color: #86efac;
          background:
            rgba(34,197,94,0.10);
        }

        /* =====================================================
           LOADING / EMPTY
        ===================================================== */

        .loading-card,
        .empty-card {
          padding: 60px 25px;
          text-align: center;
          border-radius: 22px;
          border:
            1px solid rgba(255,255,255,0.07);
          background:
            rgba(255,255,255,0.03);
        }

        .loading-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border:
            3px solid rgba(255,255,255,0.08);
          border-top-color: #8b5cf6;
          animation:
            spin 0.8s linear infinite;
          margin: 0 auto 14px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-card p,
        .empty-card p {
          color: #64748b;
        }

        .empty-icon {
          width: 68px;
          height: 68px;
          margin: 0 auto 17px;
          display: grid;
          place-items: center;
          border-radius: 20px;
          color: #a78bfa;
          background:
            rgba(124,58,237,0.10);
        }

        .empty-card h3 {
          margin-bottom: 7px;
        }

        /* =====================================================
           QUICK ACTIONS
        ===================================================== */

        .quick-section {
          margin-top: 70px;
        }

        .quick-grid {
          display: grid;
          grid-template-columns:
            repeat(3,1fr);
          gap: 15px;
        }

        .quick-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px;
          border-radius: 18px;
          border:
            1px solid rgba(255,255,255,0.07);
          background:
            rgba(255,255,255,0.025);
          transition: 0.25s ease;
        }

        .quick-card:hover {
          transform: translateY(-4px);
          border-color:
            rgba(139,92,246,0.25);
          background:
            rgba(255,255,255,0.045);
        }

        .quick-icon {
          width: 43px;
          height: 43px;
          border-radius: 12px;
        }

        .quick-card h3 {
          font-size: 14px;
          margin: 0 0 4px;
        }

        .quick-card p {
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
          margin: 0;
        }

        .quick-card > svg {
          margin-left: auto;
          color: #475569;
        }

        /* =====================================================
           MODAL
        ===================================================== */

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            rgba(0,0,0,0.72);
          backdrop-filter: blur(12px);
        }

        .create-modal {
          width: 100%;
          max-width: 460px;
          padding: 30px;
          border-radius: 24px;
          position: relative;
          background:
            linear-gradient(
              145deg,
              rgba(30,41,59,0.94),
              rgba(15,23,42,0.96)
            );
          border:
            1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 40px 100px rgba(0,0,0,0.5),
            inset 0 1px rgba(255,255,255,0.08);
          animation:
            modalIn 0.25s ease;
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform:
              scale(0.96)
              translateY(10px);
          }

          to {
            opacity: 1;
            transform:
              scale(1)
              translateY(0);
          }
        }

        .modal-close {
          position: absolute;
          right: 18px;
          top: 18px;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 10px;
          color: #64748b;
          background:
            rgba(255,255,255,0.05);
          cursor: pointer;
        }

        .modal-close:hover {
          color: white;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #c4b5fd;
          background:
            rgba(124,58,237,0.15);
          margin-bottom: 17px;
        }

        .create-modal h2 {
          margin: 0;
          font-size: 24px;
        }

        .create-modal > p {
          color: #64748b;
          font-size: 13px;
          margin: 7px 0 25px;
        }

        .create-form {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .create-form label {
          color: #cbd5e1;
          font-size: 12px;
          margin-top: 4px;
        }

        .glass-input {
          width: 100%;
          padding: 13px 14px;
          border-radius: 12px;
          outline: none;
          border:
            1px solid rgba(255,255,255,0.08);
          color: white;
          background:
            rgba(255,255,255,0.045);
          font-size: 13px;
          resize: vertical;
        }

        .glass-input:focus {
          border-color:
            rgba(139,92,246,0.5);
          box-shadow:
            0 0 20px rgba(124,58,237,0.08);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 15px;
        }

        .cancel-btn {
          padding: 11px 16px;
          border-radius: 12px;
          border:
            1px solid rgba(255,255,255,0.09);
          color: #cbd5e1;
          background: transparent;
          cursor: pointer;
        }

        .cancel-btn:hover {
          background:
            rgba(255,255,255,0.05);
        }

        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 1000px) {

          .nav-links {
            display: none;
          }

          .hero-section {
            grid-template-columns: 1fr;
          }

          .hero-visual {
            height: 330px;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2,1fr);
          }

          .course-grid {
            grid-template-columns:
              repeat(2,1fr);
          }

          .quick-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 650px) {

          .glass-nav {
            padding: 0 16px;
          }

          .user-mini span,
          .logout-btn span {
            display: none;
          }

          .home-container {
            padding:
              25px 16px 60px;
          }

          .hero-section {
            min-height: auto;
          }

          .hero-content h1 {
            font-size: 48px;
          }

          .hero-description {
            font-size: 14px;
          }

          .search-wrapper {
            height: auto;
            padding: 10px;
            flex-wrap: wrap;
          }

          .search-wrapper input {
            min-width: 150px;
          }

          .search-button {
            width: 100%;
          }

          .search-result-card,
          .new-search-course {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .search-result-actions {
            width: 100%;
            margin-left: 57px;
          }

          .add-search-course-btn {
            width: 100%;
          }

          .search-match-row {
            align-items: flex-start;
          }

          .search-match-actions {
            flex-shrink: 0;
          }

          .stats-grid,
          .course-grid {
            grid-template-columns: 1fr;
          }

          .section-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .new-course-btn {
            width: 100%;
          }

          .hero-visual {
            transform: scale(0.8);
            margin: -25px 0;
          }

          .course-card {
            min-height: 285px;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }

          .modal-actions button {
            width: 100%;
          }

        }

      `}</style>

    </div>
  );
}