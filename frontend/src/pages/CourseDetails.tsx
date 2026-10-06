import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  ArrowLeft,
  Brain,
  LogOut,
  BookOpen,
  MessageSquare,
  Target,
  BarChart3,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Play,
  Loader2,
  Sparkles,
  Youtube,
  NotebookTabs,
  ExternalLink,
} from 'lucide-react';

import { coursesApi, materialsApi } from '../services/api';
import { signOut } from '../services/supabase';
import type { Course } from '../types';

type Material = {
  id: string;
  filename?: string;
  file_name?: string;
  name?: string;
  status?: string;
  page_count?: number;
  pages?: number;
  chunk_count?: number;
};

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

    if (!courseId) {
      setError('Course ID is missing.');
      setLoading(false);
      return;
    }

    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      setError('');

      const [courseData, materialData] = await Promise.all([
        coursesApi.get(courseId),
        materialsApi.list(courseId),
      ]);

      setCourse(courseData);
      setMaterials(materialData || []);
    } catch (err: any) {
      console.error('Failed to load course:', err);
      setError(err?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file || !courseId) return;

    try {
      setUploading(true);

      await materialsApi.upload(courseId, file);

      await loadCourse();
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(err?.message || 'Failed to upload material');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  const getMaterialName = (material: Material) => {
    return (
      material.filename ||
      material.file_name ||
      material.name ||
      'Study Material'
    );
  };

  const getMaterialStatus = (material: Material) => {
    const status = material.status?.toLowerCase();

    if (
      status === 'ready' ||
      status === 'completed' ||
      status === 'processed'
    ) {
      return 'Ready';
    }

    if (status === 'processing' || status === 'pending') {
      return 'Processing';
    }

    if (status === 'failed' || status === 'error') {
      return 'Failed';
    }

    return material.status || 'Ready';
  };

  if (loading) {
    return (
      <div className="course-page">
        <style>{styles}</style>

        <nav className="top-nav">
          <Link to="/dashboard" className="brand">
            <div className="brand-icon">
              <Brain size={21} />
            </div>

            AI <strong>StudyMate</strong>
          </Link>

          <div className="nav-right">
            <span>{userName}</span>

            <button onClick={logout}>
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </nav>

        <div className="loading-page">
          <Loader2 className="spinner" size={40} />
          <p>Loading course...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-page">
        <style>{styles}</style>

        <nav className="top-nav">
          <Link to="/dashboard" className="brand">
            <div className="brand-icon">
              <Brain size={21} />
            </div>

            AI <strong>StudyMate</strong>
          </Link>

          <div className="nav-right">
            <span>{userName}</span>

            <button onClick={logout}>
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </nav>

        <main className="container">
          <Link to="/my-courses" className="back-link">
            <ArrowLeft size={17} />
            Back to My Courses
          </Link>

          <div className="error-card">
            <div className="error-icon">!</div>

            <h2>Unable to open course</h2>

            <p>{error || 'Course not found.'}</p>

            <button
              className="primary-button"
              onClick={() => navigate('/my-courses')}
            >
              Back to My Courses
            </button>
          </div>
        </main>
      </div>
    );
  }

  const youtubeUrl =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(
      course.title
    )}`;

  return (
    <div className="course-page">
      <style>{styles}</style>

      {/* NAVBAR */}

      <nav className="top-nav">
        <Link to="/dashboard" className="brand">
          <div className="brand-icon">
            <Brain size={21} />
          </div>

          AI <strong>StudyMate</strong>
        </Link>

        <div className="nav-right">
          <span>{userName}</span>

          <button onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </nav>

      {/* MAIN */}

      <main className="container">

        {/* BACK */}

        <Link to="/my-courses" className="back-link">
          <ArrowLeft size={17} />
          Back to My Courses
        </Link>

        {/* COURSE HERO */}

        <section className="course-hero">

          <div className="hero-left">

            <div className="eyebrow">
              <Sparkles size={14} />
              YOUR LEARNING SPACE
            </div>

            <h1>{course.title}</h1>

            <p className="hero-description">
              {course.description ||
                course.subject ||
                'Learn, practice and master this course with AI-powered personalized learning.'}
            </p>

            <div className="course-stats">

              <div className="stat">
                <BookOpen size={17} />
                <span>{materials.length} Materials</span>
              </div>

              <div className="stat">
                <Target size={17} />
                <span>Personalized Learning</span>
              </div>

              <div className="stat">
                <Brain size={17} />
                <span>AI Powered</span>
              </div>

            </div>
          </div>

          <div className="progress-card">

            <div className="progress-circle">
              <span>0%</span>
            </div>

            <div>
              <p>Course Progress</p>
              <strong>Keep learning</strong>
            </div>

          </div>

        </section>

        {/* QUICK ACTIONS */}

        <section className="section">

          <div className="section-title">
            <div>
              <span className="section-label">
                LEARNING TOOLS
              </span>

              <h2>
                Continue your journey
              </h2>
            </div>
          </div>

          <div className="tools-grid">

            {/* AI TUTOR */}

            <Link
              to={`/courses/${course.id}/tutor`}
              className="tool-card purple"
            >
              <div className="tool-icon">
                <MessageSquare size={25} />
              </div>

              <div className="tool-content">
                <h3>AI Tutor</h3>

                <p>
                  Ask questions and get personalized
                  explanations from your study material.
                </p>
              </div>

              <div className="tool-arrow">
                →
              </div>
            </Link>

            {/* QUIZ */}

            <Link
              to={`/courses/${course.id}/quiz`}
              className="tool-card cyan"
            >
              <div className="tool-icon">
                <Target size={25} />
              </div>

              <div className="tool-content">
                <h3>Adaptive Quiz</h3>

                <p>
                  Test your knowledge with AI-generated
                  questions based on your level.
                </p>
              </div>

              <div className="tool-arrow">
                →
              </div>
            </Link>

            {/* PROGRESS */}

            <Link
              to={`/courses/${course.id}/progress`}
              className="tool-card green"
            >
              <div className="tool-icon">
                <BarChart3 size={25} />
              </div>

              <div className="tool-content">
                <h3>Progress</h3>

                <p>
                  Track your performance, weak topics
                  and personalized recommendations.
                </p>
              </div>

              <div className="tool-arrow">
                →
              </div>
            </Link>

          </div>
        </section>

        {/* STUDY MATERIALS */}

        <section className="section">

          <div className="materials-header">

            <div>
              <span className="section-label">
                STUDY LIBRARY
              </span>

              <h2>
                Study Materials
              </h2>

              <p>
                Upload PDFs, PPTs and other learning
                resources for your AI tutor.
              </p>
            </div>

            <label className="upload-button">

              {uploading ? (
                <>
                  <Loader2
                    size={17}
                    className="spinner"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload Material
                </>
              )}

              <input
                type="file"
                accept=".pdf,.ppt,.pptx,.txt,.srt,.vtt"
                onChange={handleUpload}
                disabled={uploading}
                hidden
              />

            </label>

          </div>

          {materials.length === 0 ? (

            <div className="empty-materials">

              <div className="empty-material-icon">
                <FileText size={30} />
              </div>

              <h3>
                No study materials yet
              </h3>

              <p>
                Upload your notes, textbook or lecture
                slides to start learning.
              </p>

              <label className="primary-button upload-small">

                <Upload size={16} />
                Upload First Material

                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx,.txt,.srt,.vtt"
                  onChange={handleUpload}
                  disabled={uploading}
                  hidden
                />

              </label>

            </div>

          ) : (

            <div className="materials-list">

              {materials.map((material) => {

                const status =
                  getMaterialStatus(material);

                const isReady =
                  status === 'Ready';

                return (
                  <div
                    key={material.id}
                    className="material-card"
                  >

                    <div className="material-icon">
                      <FileText size={22} />
                    </div>

                    <div className="material-info">

                      <h3>
                        {getMaterialName(material)}
                      </h3>

                      <div className="material-details">

                        {material.page_count ||
                        material.pages ? (
                          <span>
                            <BookOpen size={13} />

                            {material.page_count ||
                              material.pages}{' '}
                            pages
                          </span>
                        ) : null}

                        {material.chunk_count ? (
                          <span>
                            {material.chunk_count} chunks
                          </span>
                        ) : null}

                      </div>
                    </div>

                    <div
                      className={
                        isReady
                          ? 'status ready'
                          : 'status processing'
                      }
                    >

                      {isReady ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Clock size={15} />
                      )}

                      {status}

                    </div>

                  </div>
                );
              })}

            </div>

          )}

        </section>

        {/* LEARNING RESOURCES */}

        <section className="section">

          <div className="section-title">

            <div>

              <span className="section-label">
                LEARNING RESOURCES
              </span>

              <h2>
                Learn this course
              </h2>

              <p>
                Find notes, PDFs and videos from the internet.
              </p>

            </div>

          </div>

          <div className="resource-grid">

            {/* COURSE NOTES */}

            <div className="resource-card">

              <div className="resource-icon notes-icon">
                <NotebookTabs size={25} />
              </div>

              <div className="resource-content">

                <div className="resource-top">

                  <span className="resource-type">
                    ONLINE NOTES
                  </span>

                  <FileText size={16} />

                </div>

                <h3>
                  Course Notes
                </h3>

                <p>
                  Find online notes, PDFs, tutorials and
                  free study materials for this course.
                </p>

                {/* IMPORTANT:
                    THIS GOES TO RESOURCES,
                    NOT AI TUTOR.
                */}

                <Link
                  to={`/courses/${course.id}/resources`}
                  className="resource-button"
                >
                  <BookOpen size={15} />
                  Find Notes
                  <ExternalLink size={13} />
                </Link>

              </div>

            </div>

            {/* YOUTUBE */}

            <div className="resource-card">

              <div className="resource-icon youtube-icon">
                <Youtube size={25} />
              </div>

              <div className="resource-content">

                <div className="resource-top">

                  <span className="resource-type">
                    VIDEO LEARNING
                  </span>

                  <Play size={16} />

                </div>

                <h3>
                  YouTube Lessons
                </h3>

                <p>
                  Find useful video explanations and
                  lectures related to this course.
                </p>

                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-button youtube-button"
                >

                  <Play size={15} />

                  Watch Videos

                  <ExternalLink size={13} />

                </a>

              </div>

            </div>

            {/* AI EXPLANATIONS */}

            <div className="resource-card">

              <div className="resource-icon ai-icon">
                <Brain size={25} />
              </div>

              <div className="resource-content">

                <div className="resource-top">

                  <span className="resource-type">
                    AI LEARNING
                  </span>

                  <Sparkles size={16} />

                </div>

                <h3>
                  AI Explanations
                </h3>

                <p>
                  Ask the AI Tutor to explain difficult
                  concepts using your uploaded materials.
                </p>

                {/* THIS ONE SHOULD GO TO AI TUTOR */}

                <Link
                  to={`/courses/${course.id}/tutor`}
                  className="resource-button ai-button"
                >
                  <MessageSquare size={15} />
                  Ask AI Tutor
                </Link>

              </div>

            </div>

          </div>

        </section>

        {/* LEARNING ROADMAP */}

        <section className="section">

          <div className="roadmap">

            <div className="roadmap-title">

              <Sparkles size={18} />

              <div>

                <h3>
                  Your Learning Roadmap
                </h3>

                <p>
                  Complete each stage to master this course.
                </p>

              </div>

            </div>

            <div className="roadmap-steps">

              <div className="roadmap-step active">

                <div className="step-number">
                  1
                </div>

                <div>
                  <strong>Study</strong>

                  <span>
                    Read your materials
                  </span>
                </div>

              </div>

              <div className="roadmap-line" />

              <div className="roadmap-step">

                <div className="step-number">
                  2
                </div>

                <div>
                  <strong>Practice</strong>

                  <span>
                    Ask AI Tutor
                  </span>
                </div>

              </div>

              <div className="roadmap-line" />

              <div className="roadmap-step">

                <div className="step-number">
                  3
                </div>

                <div>
                  <strong>Quiz</strong>

                  <span>
                    Test your knowledge
                  </span>
                </div>

              </div>

              <div className="roadmap-line" />

              <div className="roadmap-step">

                <div className="step-number">
                  4
                </div>

                <div>
                  <strong>Master</strong>

                  <span>
                    Improve weak topics
                  </span>
                </div>

              </div>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles = `

* {
  box-sizing: border-box;
}

.course-page {
  min-height: 100vh;
  color: #f8fafc;

  background:
    radial-gradient(
      circle at 10% 5%,
      rgba(124,58,237,0.18),
      transparent 30%
    ),
    radial-gradient(
      circle at 90% 30%,
      rgba(6,182,212,0.11),
      transparent 30%
    ),
    #070b18;
}

/* NAVBAR */

.top-nav {
  height: 70px;
  padding: 0 32px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  position: sticky;
  top: 0;
  z-index: 50;

  background: rgba(7,11,24,0.72);
  backdrop-filter: blur(24px);

  border-bottom:
    1px solid rgba(255,255,255,0.07);
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

  border:
    1px solid rgba(139,92,246,0.28);

  box-shadow:
    0 0 25px rgba(124,58,237,0.12),
    inset 0 1px rgba(255,255,255,0.08);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.nav-right span {
  color: #94a3b8;
  font-size: 14px;
}

.nav-right button {
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

.nav-right button:hover {
  color: white;
  background: rgba(255,255,255,0.06);
}

/* CONTAINER */

.container {
  max-width: 1200px;

  margin: 0 auto;

  padding: 40px 28px 90px;
}

.back-link {
  display: inline-flex;
  align-items: center;

  gap: 7px;

  margin-bottom: 30px;

  color: #8d99ae;

  text-decoration: none;

  font-size: 14px;

  transition: 0.2s;
}

.back-link:hover {
  color: white;
}

/* HERO */

.course-hero {
  display: flex;
  justify-content: space-between;

  gap: 40px;

  padding: 35px;

  border-radius: 28px;

  background:
    linear-gradient(
      135deg,
      rgba(124,58,237,0.13),
      rgba(255,255,255,0.035)
    );

  border:
    1px solid rgba(255,255,255,0.08);

  backdrop-filter: blur(22px);

  overflow: hidden;

  position: relative;
}

.course-hero::after {
  content: '';

  position: absolute;

  width: 350px;
  height: 350px;

  right: -130px;
  top: -180px;

  background: rgba(6,182,212,0.09);

  filter: blur(70px);

  pointer-events: none;
}

.hero-left {
  max-width: 750px;
}

.eyebrow {
  display: flex;
  align-items: center;

  gap: 7px;

  color: #a78bfa;

  font-size: 11px;
  font-weight: 800;

  letter-spacing: 1.6px;
}

.hero-left h1 {
  margin: 12px 0 10px;

  font-size: 48px;
  line-height: 1.05;

  letter-spacing: -2px;
}

.hero-description {
  margin: 0;

  max-width: 700px;

  color: #8793a8;

  font-size: 16px;

  line-height: 1.7;
}

.course-stats {
  display: flex;
  flex-wrap: wrap;

  gap: 10px;

  margin-top: 25px;
}

.stat {
  display: flex;
  align-items: center;

  gap: 7px;

  padding: 9px 12px;

  color: #9aa6b8;

  background:
    rgba(255,255,255,0.04);

  border:
    1px solid rgba(255,255,255,0.06);

  border-radius: 10px;

  font-size: 12px;
}

.stat svg {
  color: #a78bfa;
}

/* PROGRESS */

.progress-card {
  min-width: 190px;

  display: flex;

  align-items: center;
  justify-content: center;

  flex-direction: column;

  gap: 14px;

  position: relative;
  z-index: 2;
}

.progress-circle {
  width: 125px;
  height: 125px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      #0d1325 58%,
      transparent 60%
    );

  border:
    8px solid rgba(124,58,237,0.18);

  box-shadow:
    0 0 40px rgba(124,58,237,0.15);
}

.progress-circle span {
  font-size: 25px;
  font-weight: 800;

  color: #c4b5fd;
}

.progress-card p {
  margin: 0 0 4px;

  text-align: center;

  color: #64748b;

  font-size: 12px;
}

.progress-card strong {
  display: block;

  text-align: center;

  color: #cbd5e1;

  font-size: 13px;
}

/* SECTION */

.section {
  margin-top: 42px;
}

.section-label {
  color: #8b7cff;

  font-size: 10px;
  font-weight: 800;

  letter-spacing: 1.5px;
}

.section-title h2,
.materials-header h2 {
  margin: 7px 0 0;

  font-size: 28px;

  letter-spacing: -0.8px;
}

.section-title p,
.materials-header p {
  color: #68758b;
}

/* TOOLS */

.tools-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 17px;

  margin-top: 20px;
}

.tool-card {
  min-height: 190px;

  padding: 23px;

  display: flex;
  flex-direction: column;

  position: relative;

  text-decoration: none;

  color: inherit;

  border-radius: 20px;

  background:
    rgba(255,255,255,0.035);

  border:
    1px solid rgba(255,255,255,0.075);

  transition: 0.25s;
}

.tool-card:hover {
  transform: translateY(-5px);

  border-color:
    rgba(139,92,246,0.35);

  box-shadow:
    0 18px 40px rgba(0,0,0,0.25);
}

.tool-icon {
  width: 50px;
  height: 50px;

  display: grid;
  place-items: center;

  border-radius: 15px;

  margin-bottom: 18px;
}

.tool-content h3 {
  margin: 0 0 7px;

  font-size: 18px;
}

.tool-content p {
  margin: 0;

  color: #69758a;

  font-size: 13px;

  line-height: 1.55;
}

.tool-arrow {
  position: absolute;

  right: 20px;
  bottom: 18px;

  color: #7f8ba0;

  font-size: 20px;

  transition: 0.2s;
}

.tool-card:hover .tool-arrow {
  color: white;

  transform: translateX(4px);
}

.purple .tool-icon {
  color: #c4b5fd;
  background: rgba(124,58,237,0.15);
}

.cyan .tool-icon {
  color: #67e8f9;
  background: rgba(6,182,212,0.13);
}

.green .tool-icon {
  color: #6ee7b7;
  background: rgba(16,185,129,0.13);
}

/* MATERIALS */

.materials-header {
  display: flex;

  align-items: flex-end;
  justify-content: space-between;

  gap: 20px;

  margin-bottom: 20px;
}

.materials-header p {
  margin: 7px 0 0;

  font-size: 13px;
}

.upload-button {
  display: inline-flex;

  align-items: center;

  gap: 7px;

  padding: 11px 16px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #7c3aed,
      #4f46e5
    );

  border-radius: 11px;

  cursor: pointer;

  font-size: 13px;
  font-weight: 600;

  box-shadow:
    0 8px 25px rgba(124,58,237,0.22);

  transition: 0.2s;
}

.upload-button:hover {
  transform: translateY(-2px);

  box-shadow:
    0 12px 30px rgba(124,58,237,0.32);
}

.materials-list {
  display: flex;

  flex-direction: column;

  gap: 10px;
}

.material-card {
  min-height: 76px;

  display: flex;
  align-items: center;

  gap: 15px;

  padding: 14px 17px;

  border-radius: 15px;

  background:
    rgba(255,255,255,0.035);

  border:
    1px solid rgba(255,255,255,0.07);

  transition: 0.2s;
}

.material-card:hover {
  background:
    rgba(255,255,255,0.055);

  border-color:
    rgba(139,92,246,0.2);
}

.material-icon {
  width: 43px;
  height: 43px;

  display: grid;
  place-items: center;

  flex-shrink: 0;

  color: #a78bfa;

  border-radius: 12px;

  background:
    rgba(124,58,237,0.12);
}

.material-info {
  flex: 1;
}

.material-info h3 {
  margin: 0 0 5px;

  font-size: 14px;
  font-weight: 600;
}

.material-details {
  display: flex;

  align-items: center;

  gap: 12px;

  color: #64748b;

  font-size: 11px;
}

.material-details span {
  display: flex;

  align-items: center;

  gap: 4px;
}

.status {
  display: flex;

  align-items: center;

  gap: 5px;

  padding: 6px 9px;

  border-radius: 8px;

  font-size: 11px;
}

.status.ready {
  color: #6ee7b7;

  background:
    rgba(16,185,129,0.1);
}

.status.processing {
  color: #fcd34d;

  background:
    rgba(245,158,11,0.1);
}

/* EMPTY */

.empty-materials {
  padding: 60px 20px;

  text-align: center;

  border-radius: 20px;

  background:
    rgba(255,255,255,0.025);

  border:
    1px dashed rgba(255,255,255,0.1);
}

.empty-material-icon {
  width: 65px;
  height: 65px;

  margin: 0 auto 15px;

  display: grid;
  place-items: center;

  color: #a78bfa;

  border-radius: 18px;

  background:
    rgba(124,58,237,0.12);
}

.empty-materials h3 {
  margin: 0 0 7px;
}

.empty-materials p {
  margin: 0 0 18px;

  color: #64748b;

  font-size: 13px;
}

.upload-small {
  border: 0;

  cursor: pointer;
}

/* LEARNING RESOURCES */

.resource-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 17px;

  margin-top: 20px;
}

.resource-card {
  position: relative;

  min-height: 260px;

  padding: 22px;

  display: flex;
  flex-direction: column;

  border-radius: 20px;

  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,0.055),
      rgba(255,255,255,0.025)
    );

  border:
    1px solid rgba(255,255,255,0.075);

  overflow: hidden;

  transition: 0.25s;
}

.resource-card::before {
  content: '';

  position: absolute;

  width: 150px;
  height: 150px;

  right: -70px;
  top: -70px;

  border-radius: 50%;

  background:
    rgba(124,58,237,0.08);

  filter: blur(30px);
}

.resource-card:hover {
  transform: translateY(-5px);

  border-color:
    rgba(139,92,246,0.3);

  box-shadow:
    0 18px 45px rgba(0,0,0,0.25);
}

.resource-icon {
  width: 50px;
  height: 50px;

  display: grid;
  place-items: center;

  border-radius: 15px;

  margin-bottom: 18px;
}

.notes-icon {
  color: #c4b5fd;

  background:
    rgba(124,58,237,0.14);
}

.youtube-icon {
  color: #fca5a5;

  background:
    rgba(239,68,68,0.12);
}

.ai-icon {
  color: #67e8f9;

  background:
    rgba(6,182,212,0.12);
}

.resource-content {
  position: relative;

  z-index: 2;

  display: flex;
  flex-direction: column;

  height: 100%;
}

.resource-top {
  display: flex;

  align-items: center;
  justify-content: space-between;

  color: #64748b;

  margin-bottom: 6px;
}

.resource-type {
  font-size: 9px;

  font-weight: 800;

  letter-spacing: 1.4px;

  color: #8b7cff;
}

.resource-content h3 {
  margin: 4px 0 8px;

  font-size: 18px;

  color: #f8fafc;
}

.resource-content p {
  margin: 0;

  color: #69758a;

  font-size: 13px;

  line-height: 1.6;
}

.resource-button {
  display: inline-flex;

  align-items: center;

  gap: 7px;

  width: fit-content;

  margin-top: auto;

  padding: 9px 12px;

  color: white;

  background:
    rgba(124,58,237,0.15);

  border:
    1px solid rgba(139,92,246,0.2);

  border-radius: 10px;

  text-decoration: none;

  font-size: 12px;

  font-weight: 600;

  transition: 0.2s;
}

.resource-button:hover {
  background:
    rgba(124,58,237,0.28);

  transform: translateY(-2px);
}

.youtube-button {
  color: #fecaca;

  background:
    rgba(239,68,68,0.10);

  border-color:
    rgba(239,68,68,0.18);
}

.youtube-button:hover {
  background:
    rgba(239,68,68,0.18);
}

.ai-button {
  color: #a5f3fc;

  background:
    rgba(6,182,212,0.10);

  border-color:
    rgba(6,182,212,0.18);
}

.ai-button:hover {
  background:
    rgba(6,182,212,0.18);
}

/* ROADMAP */

.roadmap {
  padding: 25px;

  border-radius: 20px;

  background:
    linear-gradient(
      135deg,
      rgba(124,58,237,0.09),
      rgba(255,255,255,0.025)
    );

  border:
    1px solid rgba(255,255,255,0.07);
}

.roadmap-title {
  display: flex;

  align-items: center;

  gap: 12px;

  color: #a78bfa;
}

.roadmap-title h3 {
  margin: 0 0 3px;

  color: white;

  font-size: 16px;
}

.roadmap-title p {
  margin: 0;

  color: #64748b;

  font-size: 12px;
}

.roadmap-steps {
  display: flex;

  align-items: center;

  margin-top: 25px;
}

.roadmap-step {
  display: flex;

  align-items: center;

  gap: 9px;

  flex: 1;
}

.step-number {
  width: 31px;
  height: 31px;

  display: grid;
  place-items: center;

  flex-shrink: 0;

  border-radius: 50%;

  color: #7d899e;

  background:
    rgba(255,255,255,0.05);

  border:
    1px solid rgba(255,255,255,0.08);

  font-size: 12px;
}

.roadmap-step.active .step-number {
  color: white;

  background:
    linear-gradient(
      135deg,
      #7c3aed,
      #4f46e5
    );

  border-color: transparent;
}

.roadmap-step strong {
  display: block;

  font-size: 12px;
}

.roadmap-step span {
  display: block;

  margin-top: 2px;

  color: #64748b;

  font-size: 10px;
}

.roadmap-line {
  width: 35px;
  height: 1px;

  margin: 0 8px;

  background:
    rgba(255,255,255,0.1);
}

/* LOADING */

.loading-page {
  min-height: 70vh;

  display: flex;

  align-items: center;
  justify-content: center;

  flex-direction: column;

  gap: 15px;

  color: #7c879a;
}

.spinner {
  animation:
    spin 1s linear infinite;
}

@keyframes spin {

  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }

}

/* ERROR */

.error-card {
  max-width: 550px;

  margin: 100px auto;

  padding: 40px;

  text-align: center;

  border-radius: 22px;

  background:
    rgba(255,255,255,0.035);

  border:
    1px solid rgba(239,68,68,0.18);
}

.error-icon {
  width: 55px;
  height: 55px;

  margin: 0 auto 15px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  color: #fca5a5;

  background:
    rgba(239,68,68,0.12);

  font-size: 25px;

  font-weight: 800;
}

.error-card h2 {
  margin: 0 0 8px;
}

.error-card p {
  margin: 0 0 20px;

  color: #7d899e;

  font-size: 13px;
}

.primary-button {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  gap: 7px;

  padding: 11px 17px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #7c3aed,
      #4f46e5
    );

  border: 0;

  border-radius: 11px;

  text-decoration: none;

  font-size: 13px;

  cursor: pointer;
}

/* RESPONSIVE */

@media(max-width: 850px) {

  .course-hero {
    flex-direction: column;
  }

  .progress-card {
    align-items: flex-start;
  }

  .progress-card p,
  .progress-card strong {
    text-align: left;
  }

  .tools-grid {
    grid-template-columns: 1fr;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .roadmap-steps {
    flex-direction: column;

    align-items: flex-start;

    gap: 15px;
  }

  .roadmap-step {
    width: 100%;
  }

  .roadmap-line {
    display: none;
  }

}

@media(max-width: 600px) {

  .top-nav {
    padding: 0 16px;
  }

  .nav-right span {
    display: none;
  }

  .container {
    padding: 30px 16px 60px;
  }

  .course-hero {
    padding: 24px;
  }

  .hero-left h1 {
    font-size: 37px;
  }

  .materials-header {
    align-items: flex-start;

    flex-direction: column;
  }

  .material-card {
    align-items: flex-start;
  }

  .status {
    margin-left: auto;
  }

  .resource-card {
    min-height: 240px;
  }

}

`;
