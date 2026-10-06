import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ArrowLeft,
  Brain,
  Search,
  FileText,
  Youtube,
  GraduationCap,
  Github,
  Globe,
  ExternalLink,
  Sparkles,
  BookOpen,
  Loader2,
} from 'lucide-react';

import { coursesApi } from '../services/api';

type Course = {
  id: string;
  title: string;
  description?: string;
  subject?: string;
};

export default function Resources() {
  const { courseId } = useParams<{ courseId: string }>();

  const [course, setCourse] = useState<Course | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // =========================================================
  // GET ACTUAL COURSE FROM BACKEND
  // =========================================================

  useEffect(() => {
    if (!courseId) return;

    setLoading(true);

    coursesApi
      .get(courseId)
      .then((data) => {
        setCourse(data);
      })
      .catch((error) => {
        console.error('Failed to load course:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [courseId]);

  // =========================================================
  // ACTUAL COURSE TITLE
  // =========================================================

  const courseTitle = course?.title || 'Course';

  const baseQuery = courseTitle.trim();

  const encodedQuery = encodeURIComponent(baseQuery);

  // =========================================================
  // RESOURCE LINKS
  // EVERYTHING IS BASED ON THE CURRENT COURSE
  // =========================================================

  const resources = useMemo(
    () => [
      {
        title: `${baseQuery} Notes`,
        description:
          `Search the web for free notes, lecture notes and study material for ${baseQuery}.`,
        icon: <FileText size={25} />,
        className: 'purple',
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `${baseQuery} notes`
        )}`,
        button: 'Find Notes',
      },

      {
        title: `${baseQuery} PDF Notes`,
        description:
          `Find downloadable PDF notes, textbooks and lecture materials for ${baseQuery}.`,
        icon: <BookOpen size={25} />,
        className: 'red',
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `${baseQuery} notes filetype:pdf`
        )}`,
        button: 'Find PDFs',
      },

      {
        title: `${baseQuery} YouTube`,
        description:
          `Find lectures, tutorials and complete playlists for ${baseQuery}.`,
        icon: <Youtube size={25} />,
        className: 'youtube',
        url: `https://www.youtube.com/results?search_query=${encodedQuery}`,
        button: 'Watch Videos',
      },

      {
        title: `${baseQuery} on GeeksforGeeks`,
        description:
          `Search GeeksforGeeks for tutorials, examples and programming concepts related to ${baseQuery}.`,
        icon: <Globe size={25} />,
        className: 'green',
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `site:geeksforgeeks.org ${baseQuery}`
        )}`,
        button: 'Read Tutorials',
      },

      {
        title: `${baseQuery} on NPTEL`,
        description:
          `Find NPTEL lectures and academic courses related to ${baseQuery}.`,
        icon: <GraduationCap size={25} />,
        className: 'blue',
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `site:nptel.ac.in ${baseQuery}`
        )}`,
        button: 'Find NPTEL',
      },

      {
        title: `${baseQuery} GitHub`,
        description:
          `Find GitHub repositories containing notes, code and learning resources for ${baseQuery}.`,
        icon: <Github size={25} />,
        className: 'gray',
        url: `https://github.com/search?q=${encodeURIComponent(
          baseQuery
        )}&type=repositories`,
        button: 'Search GitHub',
      },
    ],
    [baseQuery, encodedQuery]
  );

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = () => {
    const query = search.trim() || baseQuery;

    if (!query) return;

    const url = `https://www.google.com/search?q=${encodeURIComponent(
      `${query} ${baseQuery} notes`
    )}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="resources-page">
        <style>{styles}</style>

        <div className="loading-container">
          <Loader2 className="loading-spinner" size={35} />

          <h2>Loading course resources...</h2>

          <p>
            Getting the resources for your selected course.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="resources-page">
      <style>{styles}</style>

      {/* =========================
          NAVBAR
      ========================= */}

      <nav className="resources-nav">
        <Link
          to={`/courses/${courseId}`}
          className="back-button"
        >
          <ArrowLeft size={18} />
          Back to Course
        </Link>

        <div className="resources-brand">
          <div className="brand-icon">
            <Brain size={20} />
          </div>

          <span>
            AI <strong>StudyMate</strong>
          </span>
        </div>
      </nav>

      {/* =========================
          MAIN
      ========================= */}

      <main className="resources-container">

        {/* =========================
            HERO
        ========================= */}

        <section className="resources-hero">

          <div className="hero-badge">
            <Sparkles size={14} />
            {baseQuery.toUpperCase()} • ONLINE LEARNING HUB
          </div>

          <h1>
            {baseQuery}
            <br />
            Study Resources
          </h1>

          <p>
            Find notes, PDFs, tutorials, lectures and learning
            resources specifically for <strong>{baseQuery}</strong>.
          </p>

          {/* SEARCH */}

          <div className="search-box">

            <Search size={21} />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search within ${baseQuery}...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />

            <button onClick={handleSearch}>
              Search
            </button>

          </div>

        </section>

        {/* =========================
            CURRENT COURSE
        ========================= */}

        <section className="current-course">

          <div className="current-course-icon">
            <BookOpen size={22} />
          </div>

          <div>
            <span>YOU ARE STUDYING</span>

            <h3>{baseQuery}</h3>

            {course?.subject && (
              <p>{course.subject}</p>
            )}
          </div>

        </section>

        {/* =========================
            QUICK SEARCH
        ========================= */}

        <section className="quick-section">

          <div className="section-heading">

            <span>
              QUICK SEARCH
            </span>

            <h2>
              What are you looking for?
            </h2>

          </div>

          <div className="quick-grid">

            <QuickSearch
              icon={<FileText size={20} />}
              title="Notes"
              query={`${baseQuery} notes`}
            />

            <QuickSearch
              icon={<FileText size={20} />}
              title="PDFs"
              query={`${baseQuery} notes filetype:pdf`}
            />

            <QuickSearch
              icon={<Youtube size={20} />}
              title="Videos"
              query={baseQuery}
              youtube
            />

            <QuickSearch
              icon={<GraduationCap size={20} />}
              title="Courses"
              query={`${baseQuery} free course`}
            />

          </div>

        </section>

        {/* =========================
            RESOURCE CARDS
        ========================= */}

        <section className="resource-section">

          <div className="section-heading">

            <span>
              ONLINE RESOURCES
            </span>

            <h2>
              Learn {baseQuery} from the web
            </h2>

            <p>
              Real search results from popular learning platforms,
              based on your selected course.
            </p>

          </div>

          <div className="resource-grid">

            {resources.map((resource) => (

              <article
                className="resource-card"
                key={resource.title}
              >

                <div
                  className={`resource-icon ${resource.className}`}
                >
                  {resource.icon}
                </div>

                <div className="resource-card-content">

                  <div className="resource-label">
                    ONLINE RESOURCE
                  </div>

                  <h3>
                    {resource.title}
                  </h3>

                  <p>
                    {resource.description}
                  </p>

                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="resource-link"
                  >
                    {resource.button}

                    <ExternalLink size={14} />
                  </a>

                </div>

              </article>

            ))}

          </div>

        </section>

        {/* =========================
            AI TUTOR
        ========================= */}

        <section className="ai-note">

          <div className="ai-note-icon">
            <Brain size={23} />
          </div>

          <div>

            <h3>
              Need an explanation?
            </h3>

            <p>
              Online resources are for discovering additional
              learning material. For explanations based on your
              uploaded {baseQuery} materials, use AI Tutor.
            </p>

          </div>

          <Link
            to={`/courses/${courseId}/tutor`}
            className="ai-note-button"
          >
            Open AI Tutor
          </Link>

        </section>

      </main>

    </div>
  );
}


/* =========================================================
   QUICK SEARCH COMPONENT
========================================================= */

function QuickSearch({
  icon,
  title,
  query,
  youtube = false,
}: {
  icon: React.ReactNode;
  title: string;
  query: string;
  youtube?: boolean;
}) {

  const url = youtube
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`
    : `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="quick-card"
    >

      <div className="quick-icon">
        {icon}
      </div>

      <span>
        {title}
      </span>

      <ExternalLink size={14} />

    </a>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles = `

* {
  box-sizing: border-box;
}

.resources-page {
  min-height: 100vh;

  color: #f8fafc;

  background:
    radial-gradient(
      circle at 10% 0%,
      rgba(124,58,237,0.18),
      transparent 30%
    ),
    radial-gradient(
      circle at 90% 20%,
      rgba(6,182,212,0.10),
      transparent 30%
    ),
    #070b18;
}


/* =========================
   LOADING
========================= */

.loading-container {
  min-height: 100vh;

  display: flex;
  flex-direction: column;

  justify-content: center;
  align-items: center;

  text-align: center;
}

.loading-container h2 {
  margin: 18px 0 5px;

  font-size: 20px;
}

.loading-container p {
  margin: 0;

  color: #64748b;

  font-size: 13px;
}

.loading-spinner {
  color: #a78bfa;

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


/* =========================
   NAVBAR
========================= */

.resources-nav {
  height: 70px;

  padding: 0 32px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  position: sticky;

  top: 0;

  z-index: 20;

  background:
    rgba(7,11,24,0.78);

  backdrop-filter:
    blur(20px);

  border-bottom:
    1px solid rgba(255,255,255,0.07);
}

.back-button {
  display: flex;

  align-items: center;

  gap: 7px;

  color: #94a3b8;

  text-decoration: none;

  font-size: 14px;

  transition: 0.2s;
}

.back-button:hover {
  color: white;

  transform:
    translateX(-2px);
}

.resources-brand {
  display: flex;

  align-items: center;

  gap: 10px;

  font-size: 16px;
}

.resources-brand strong {
  color: #c4b5fd;
}

.brand-icon {
  width: 38px;
  height: 38px;

  display: grid;

  place-items: center;

  border-radius: 12px;

  color: #c4b5fd;

  background:
    rgba(124,58,237,0.15);

  border:
    1px solid rgba(139,92,246,0.25);
}


/* =========================
   CONTAINER
========================= */

.resources-container {
  max-width: 1150px;

  margin: auto;

  padding:
    65px 28px 90px;
}


/* =========================
   HERO
========================= */

.resources-hero {
  text-align: center;

  max-width: 850px;

  margin: auto;
}

.hero-badge {
  width: fit-content;

  margin: auto;

  display: flex;

  align-items: center;

  gap: 7px;

  padding: 7px 11px;

  color: #c4b5fd;

  background:
    rgba(124,58,237,0.10);

  border:
    1px solid rgba(139,92,246,0.18);

  border-radius: 999px;

  font-size: 10px;

  font-weight: 800;

  letter-spacing: 1.3px;
}

.resources-hero h1 {
  margin: 20px 0 12px;

  font-size: 48px;

  line-height: 1.05;

  letter-spacing: -2px;

  background:
    linear-gradient(
      135deg,
      #ffffff,
      #c4b5fd
    );

  -webkit-background-clip: text;

  background-clip: text;

  color: transparent;
}

.resources-hero p {
  max-width: 650px;

  margin: auto;

  color: #7d899e;

  font-size: 15px;

  line-height: 1.7;
}

.resources-hero p strong {
  color: #c4b5fd;
}


/* =========================
   SEARCH
========================= */

.search-box {
  max-width: 720px;

  height: 58px;

  margin: 32px auto 0;

  display: flex;

  align-items: center;

  gap: 12px;

  padding: 7px 8px 7px 18px;

  background:
    rgba(255,255,255,0.045);

  border:
    1px solid rgba(255,255,255,0.10);

  border-radius: 16px;

  box-shadow:
    0 15px 45px rgba(0,0,0,0.22);

  transition: 0.2s;
}

.search-box:focus-within {
  border-color:
    rgba(139,92,246,0.45);

  box-shadow:
    0 0 0 4px rgba(124,58,237,0.08);
}

.search-box > svg {
  color: #64748b;

  flex-shrink: 0;
}

.search-box input {
  flex: 1;

  min-width: 0;

  border: 0;

  outline: none;

  background: transparent;

  color: white;

  font-size: 14px;
}

.search-box input::placeholder {
  color: #64748b;
}

.search-box button {
  height: 44px;

  padding: 0 20px;

  border: 0;

  border-radius: 11px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #7c3aed,
      #4f46e5
    );

  font-weight: 600;

  cursor: pointer;

  transition: 0.2s;
}

.search-box button:hover {
  transform:
    translateY(-1px);

  box-shadow:
    0 8px 25px rgba(124,58,237,0.3);
}


/* =========================
   CURRENT COURSE
========================= */

.current-course {
  margin-top: 45px;

  padding: 18px 20px;

  display: flex;

  align-items: center;

  gap: 15px;

  max-width: 720px;

  margin-left: auto;
  margin-right: auto;

  border-radius: 16px;

  background:
    rgba(124,58,237,0.07);

  border:
    1px solid rgba(139,92,246,0.16);
}

.current-course-icon {
  width: 46px;
  height: 46px;

  flex-shrink: 0;

  display: grid;

  place-items: center;

  color: #c4b5fd;

  background:
    rgba(124,58,237,0.14);

  border-radius: 12px;
}

.current-course span {
  color: #64748b;

  font-size: 9px;

  font-weight: 800;

  letter-spacing: 1.3px;
}

.current-course h3 {
  margin: 3px 0 0;

  font-size: 16px;
}

.current-course p {
  margin: 2px 0 0;

  color: #64748b;

  font-size: 11px;
}


/* =========================
   SECTIONS
========================= */

.quick-section,
.resource-section {
  margin-top: 70px;
}

.section-heading span {
  color: #8b7cff;

  font-size: 10px;

  font-weight: 800;

  letter-spacing: 1.5px;
}

.section-heading h2 {
  margin: 7px 0 5px;

  font-size: 27px;

  letter-spacing: -0.8px;
}

.section-heading p {
  margin: 0;

  color: #64748b;

  font-size: 13px;
}


/* =========================
   QUICK GRID
========================= */

.quick-grid {
  display: grid;

  grid-template-columns:
    repeat(4, 1fr);

  gap: 12px;

  margin-top: 20px;
}

.quick-card {
  display: flex;

  align-items: center;

  gap: 10px;

  padding: 15px;

  color: #cbd5e1;

  text-decoration: none;

  background:
    rgba(255,255,255,0.035);

  border:
    1px solid rgba(255,255,255,0.07);

  border-radius: 14px;

  transition: 0.2s;
}

.quick-card span {
  flex: 1;

  font-size: 13px;

  font-weight: 600;
}

.quick-card > svg {
  color: #64748b;
}

.quick-card:hover {
  transform:
    translateY(-3px);

  color: white;

  border-color:
    rgba(139,92,246,0.3);

  background:
    rgba(124,58,237,0.08);
}

.quick-icon {
  width: 38px;
  height: 38px;

  display: grid;

  place-items: center;

  color: #a78bfa;

  background:
    rgba(124,58,237,0.12);

  border-radius: 10px;
}


/* =========================
   RESOURCE GRID
========================= */

.resource-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 17px;

  margin-top: 22px;
}

.resource-card {
  min-height: 260px;

  padding: 22px;

  position: relative;

  overflow: hidden;

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

  transition: 0.25s;
}

.resource-card::after {
  content: '';

  position: absolute;

  width: 180px;
  height: 180px;

  right: -90px;
  top: -90px;

  border-radius: 50%;

  background:
    rgba(124,58,237,0.07);

  filter:
    blur(35px);

  pointer-events: none;
}

.resource-card:hover {
  transform:
    translateY(-5px);

  border-color:
    rgba(139,92,246,0.30);

  box-shadow:
    0 18px 45px rgba(0,0,0,0.25);
}

.resource-icon {
  width: 52px;
  height: 52px;

  display: grid;

  place-items: center;

  border-radius: 15px;

  margin-bottom: 20px;
}

.resource-icon.purple {
  color: #c4b5fd;

  background:
    rgba(124,58,237,0.14);
}

.resource-icon.red {
  color: #fca5a5;

  background:
    rgba(239,68,68,0.12);
}

.resource-icon.youtube {
  color: #fca5a5;

  background:
    rgba(239,68,68,0.12);
}

.resource-icon.green {
  color: #6ee7b7;

  background:
    rgba(16,185,129,0.12);
}

.resource-icon.blue {
  color: #93c5fd;

  background:
    rgba(59,130,246,0.12);
}

.resource-icon.gray {
  color: #cbd5e1;

  background:
    rgba(148,163,184,0.10);
}

.resource-card-content {
  flex: 1;

  display: flex;

  flex-direction: column;

  position: relative;

  z-index: 2;
}

.resource-label {
  color: #64748b;

  font-size: 9px;

  font-weight: 800;

  letter-spacing: 1.3px;
}

.resource-card h3 {
  margin: 6px 0 8px;

  font-size: 18px;
}

.resource-card p {
  margin: 0;

  color: #69758a;

  font-size: 13px;

  line-height: 1.6;
}

.resource-link {
  width: fit-content;

  margin-top: auto;

  padding: 9px 12px;

  display: inline-flex;

  align-items: center;

  gap: 7px;

  color: white;

  background:
    rgba(124,58,237,0.15);

  border:
    1px solid rgba(139,92,246,0.20);

  border-radius: 10px;

  text-decoration: none;

  font-size: 12px;

  font-weight: 600;

  transition: 0.2s;
}

.resource-link:hover {
  background:
    rgba(124,58,237,0.28);

  transform:
    translateY(-2px);
}


/* =========================
   AI NOTE
========================= */

.ai-note {
  margin-top: 50px;

  padding: 22px;

  display: flex;

  align-items: center;

  gap: 15px;

  border-radius: 18px;

  background:
    linear-gradient(
      135deg,
      rgba(124,58,237,0.10),
      rgba(6,182,212,0.05)
    );

  border:
    1px solid rgba(139,92,246,0.15);
}

.ai-note-icon {
  width: 45px;
  height: 45px;

  flex-shrink: 0;

  display: grid;

  place-items: center;

  color: #c4b5fd;

  background:
    rgba(124,58,237,0.15);

  border-radius: 12px;
}

.ai-note h3 {
  margin: 0 0 4px;

  font-size: 15px;
}

.ai-note p {
  margin: 0;

  color: #718096;

  font-size: 12px;

  line-height: 1.5;
}

.ai-note-button {
  margin-left: auto;

  flex-shrink: 0;

  padding: 10px 14px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #7c3aed,
      #4f46e5
    );

  border-radius: 10px;

  text-decoration: none;

  font-size: 12px;

  font-weight: 600;
}


/* =========================
   RESPONSIVE
========================= */

@media(max-width: 850px) {

  .resource-grid {
    grid-template-columns: 1fr 1fr;
  }

  .quick-grid {
    grid-template-columns: 1fr 1fr;
  }

}

@media(max-width: 600px) {

  .resources-nav {
    padding: 0 16px;
  }

  .resources-brand {
    display: none;
  }

  .resources-container {
    padding:
      45px 16px 60px;
  }

  .resources-hero h1 {
    font-size: 38px;
  }

  .search-box {
    height: auto;

    padding: 10px 10px 10px 15px;

    flex-wrap: wrap;
  }

  .search-box input {
    width: calc(100% - 40px);
  }

  .search-box button {
    width: 100%;
  }

  .quick-grid {
    grid-template-columns: 1fr;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .ai-note {
    align-items: flex-start;

    flex-direction: column;
  }

  .ai-note-button {
    margin-left: 0;

    width: 100%;

    text-align: center;
  }

  .current-course {
    align-items: flex-start;
  }

}
`;