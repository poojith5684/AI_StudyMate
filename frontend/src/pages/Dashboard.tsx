import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileText,
  Flame,
  GraduationCap,
  Home,
  LogOut,
  MessageCircle,
  Plus,
  Play,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import CourseIcon from '../components/CourseIcon';
import { coursesApi, codingApi } from '../services/api';
import { signOut } from '../services/supabase';
import type { Course } from '../types';

const PLAN_STORAGE_KEY = 'ai_studymate_daily_plan_v1';
const PLAN_ITEMS = [
  { title: 'Review course notes', subtitle: 'Refresh one key concept', icon: BookOpen },
  { title: 'Solve coding questions', subtitle: 'Practice for 10 minutes', icon: Code2 },
  { title: 'Ask your AI Tutor', subtitle: 'Clear one doubt today', icon: BrainCircuit },
  { title: 'Check your progress', subtitle: 'Choose your next step', icon: BarChart3 },
];

function readPlan(): boolean[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) return PLAN_ITEMS.map((_, index) => Boolean(saved[index]));
  } catch {
    // Start with an unchecked plan when browser storage is unavailable.
  }
  return PLAN_ITEMS.map(() => false);
}


type CourseCodingStats = { solved: number; total: number; percent: number };
type CodingProblemForProgress = { id: string };
type CodingProgressForCard = { problem_id: string; solved?: boolean };

async function loadCourseCodingStats(courseList: Course[]): Promise<Record<string, CourseCodingStats>> {
  const pairs = await Promise.all(courseList.map(async (course) => {
    try {
      const [problemResult, progressResult] = await Promise.all([
        codingApi.problems(course.id),
        codingApi.progress(course.id),
      ]);
      const problems = Array.isArray(problemResult) ? problemResult as CodingProblemForProgress[] : [];
      const records = Array.isArray(progressResult) ? progressResult as CodingProgressForCard[] : [];

      // Combine cloud progress with this course's local progress as a fallback.
      // Prefer the course-scoped key so solved IDs from another course are not mixed in.
      let localSolved: string[] = [];
      try {
        const scopedKey = `ai_studymate_coding_solved_v1:${course.id}`;
        const scopedValue = localStorage.getItem(scopedKey);
        const saved = JSON.parse(scopedValue ?? localStorage.getItem('ai_studymate_coding_solved_v1') ?? '[]');
        if (Array.isArray(saved)) {
          localSolved = saved.filter((item: unknown): item is string => typeof item === 'string');
        }
      } catch {
        // Cloud progress still works when local browser storage is unavailable.
      }

      const solvedIds = new Set<string>([
        ...records.filter((item) => item.solved).map((item) => item.problem_id),
        ...localSolved,
      ]);
      const total = problems.length;
      const solved = problems.filter((problem) => solvedIds.has(problem.id)).length;
      return [course.id, { solved, total, percent: total ? Math.round((solved / total) * 100) : 0 }] as const;
    } catch (error) {
      console.warn(`Could not load coding progress for course ${course.id}`, error);
      return [course.id, { solved: 0, total: 0, percent: 0 }] as const;
    }
  }));

  return Object.fromEntries(pairs);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [codingStats, setCodingStats] = useState<Record<string, CourseCodingStats>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>(readPlan);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const userName = localStorage.getItem('user_name') || localStorage.getItem('user_email') || 'Student';
  const firstName = userName.includes('@') ? userName.split('@')[0] : userName.split(' ')[0];
  const firstCourseId = courses[0]?.id;
  const tutorPath = firstCourseId ? `/courses/${firstCourseId}/tutor` : '/my-courses';
  const notesPath = firstCourseId ? `/courses/${firstCourseId}/resources` : '/my-courses';
  const quizPath = firstCourseId ? `/courses/${firstCourseId}/quiz` : '/my-courses';
  const progressPath = firstCourseId ? `/courses/${firstCourseId}/progress` : '/my-courses';

  useEffect(() => {
    try {
      const pendingSearch = sessionStorage.getItem('asm_pending_course_search');
      if (pendingSearch) {
        setSearch(pendingSearch);
        sessionStorage.removeItem('asm_pending_course_search');
      }
    } catch {
      // Search still works normally if session storage is disabled.
    }

    if (!localStorage.getItem('access_token')) {
      navigate('/login');
      return;
    }
    void loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await coursesApi.list();
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('LOAD COURSES ERROR:', err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setCourses((previous) => [course, ...previous.filter((item) => item.id !== course.id)]);
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setSuccessMessage(`“${course.title}” is ready in your learning space.`);
      window.setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: unknown) {
      console.error('CREATE COURSE ERROR:', err);
      alert(err instanceof Error ? err.message : 'Failed to create course. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddFromSearch = async () => {
    const courseName = search.trim();
    if (!courseName) return;

    const existingCourse = courses.find((course) => course.title.trim().toLowerCase() === courseName.toLowerCase());
    if (existingCourse) {
      navigate(`/courses/${existingCourse.id}`);
      return;
    }

    setCreating(true);
    try {
      const course = await coursesApi.create({
        title: courseName,
        description: `Personalized learning course for ${courseName}`,
        subject: 'General',
      });
      setCourses((previous) => [course, ...previous.filter((item) => item.id !== course.id)]);
      setSearch('');
      navigate(`/courses/${course.id}`);
    } catch (err: unknown) {
      console.error('ADD SEARCH COURSE ERROR:', err);
      alert(err instanceof Error ? err.message : 'Could not add this course. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (event: MouseEvent<HTMLButtonElement>, courseId: string, courseTitle: string) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm(`Delete “${courseTitle}”? This removes it from your registered courses.`);
    if (!confirmed) return;
    try {
      await coursesApi.delete(courseId);
      setCourses((previous) => previous.filter((course) => course.id !== courseId));
    } catch (err: unknown) {
      console.error('DELETE COURSE ERROR:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete course.');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const exactCourse = courses.find((course) => course.title.trim().toLowerCase() === search.trim().toLowerCase());
  const matchingCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses.filter((course) => !term || course.title.toLowerCase().includes(term));
  }, [courses, search]);
  const totalMaterials = courses.reduce((sum, course) => sum + (course.material_count || 0), 0);
  const planComplete = checkedTasks.filter(Boolean).length;

  const togglePlanItem = (index: number) => {
    setCheckedTasks((previous) => {
      const next = previous.map((checked, itemIndex) => itemIndex === index ? !checked : checked);
      try {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The checklist still works for the current session if storage is disabled.
      }
      return next;
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (exactCourse) navigate(`/courses/${exactCourse.id}`);
    else if (search.trim()) void handleAddFromSearch();
  };

  const navItems = [
    { label: 'Home', to: '/dashboard', icon: Home, active: true },
    { label: 'My Courses', to: '/my-courses', icon: BookOpen },
    { label: 'AI Tutor', to: tutorPath, icon: BrainCircuit },
    { label: 'Notes & Resources', to: notesPath, icon: FileText },
    { label: 'Coding Practice', to: '/coding-practice', icon: Code2 },
    { label: 'Quizzes', to: quizPath, icon: Target },
    { label: 'Completed', to: '/completed', icon: Trophy },
    { label: 'Progress', to: progressPath, icon: BarChart3 },
  ];

  useEffect(() => {
    let cancelled = false;
    if (courses.length === 0) {
      setCodingStats({});
      return () => { cancelled = true; };
    }
    void loadCourseCodingStats(courses).then((next) => {
      if (!cancelled) setCodingStats(next);
    });
    return () => { cancelled = true; };
  }, [courses]);

  return (
    <div className="asm-dashboard">
      <style>{`
        .asm-dashboard, .asm-dashboard * { box-sizing: border-box; }
        .asm-dashboard { --d-text:#f4f5ff; --d-muted:#98a6c9; --d-line:rgba(157,163,255,.16); --d-purple:#9e87ff; min-height:100vh; min-height:100dvh; display:grid; grid-template-columns:244px minmax(0,1fr); color:var(--d-text); background:radial-gradient(ellipse at 75% -5%,rgba(76,76,230,.2),transparent 35%),radial-gradient(ellipse at 95% 40%,rgba(14,156,216,.1),transparent 26%),linear-gradient(135deg,#05091d,#080f28 60%,#100b2b); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; position:relative; isolation:isolate; overflow:hidden; }
        .asm-dashboard::before { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.12; background-image:radial-gradient(rgba(202,209,255,.7) .6px,transparent .6px); background-size:28px 28px; mask-image:linear-gradient(130deg,#000,transparent 75%); }
        .asm-d-sidebar { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; gap:24px; padding:24px 15px 18px; border-right:1px solid rgba(159,169,255,.12); background:rgba(5,10,31,.68); backdrop-filter:blur(26px); z-index:20; }
        .asm-d-brand { display:flex; align-items:center; gap:10px; padding:0 9px 21px; color:white; text-decoration:none; font-size:16px; font-weight:800; letter-spacing:-.35px; border-bottom:1px solid rgba(157,163,255,.12); }
        .asm-d-brand-mark { width:39px;height:39px;display:grid;place-items:center;border-radius:13px;color:#e7e0ff;background:linear-gradient(140deg,#8a6bff,#4b63e7 68%,#3dc5da);border:1px solid rgba(220,213,255,.25);box-shadow:0 9px 28px rgba(105,89,255,.25),inset 0 1px rgba(255,255,255,.3); }
        .asm-d-nav-label { padding:0 11px; color:#5e6d96;font-size:9px;font-weight:850;letter-spacing:1.6px;text-transform:uppercase; }
        .asm-d-nav { display:flex;flex-direction:column;gap:5px; }
        .asm-d-nav a { display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;color:#9eacca;text-decoration:none;font-size:12px;font-weight:600;transition:all .2s;border:1px solid transparent; }
        .asm-d-nav a:hover { color:#fff;background:rgba(124,100,255,.09);border-color:rgba(155,137,255,.14);transform:translateX(2px); }
        .asm-d-nav a.active { color:#fff;background:linear-gradient(110deg,rgba(100,87,255,.25),rgba(76,105,235,.11));border-color:rgba(164,149,255,.2);box-shadow:inset 0 1px rgba(255,255,255,.05); }
        .asm-d-nav a.active svg { color:#bcb0ff; }
        .asm-d-sidebar-bottom { margin-top:auto; }
        .asm-d-upgrade { padding:15px 13px;border-radius:17px;border:1px solid rgba(158,142,255,.19);background:radial-gradient(circle at 100% 0,rgba(95,101,255,.18),transparent 50%),linear-gradient(145deg,rgba(93,70,199,.15),rgba(11,20,48,.8));box-shadow:inset 0 1px rgba(255,255,255,.06); }
        .asm-d-upgrade-icon { width:33px;height:33px;display:grid;place-items:center;border-radius:11px;color:#ffe08a;background:rgba(255,196,86,.12);border:1px solid rgba(255,214,120,.16);margin-bottom:11px; }
        .asm-d-upgrade strong { display:block;font-size:12px;color:#f1edff; }
        .asm-d-upgrade p { margin:5px 0 11px;color:#8795ba;font-size:10px;line-height:1.55; }
        .asm-d-upgrade a { display:flex;align-items:center;justify-content:center;gap:6px;border-radius:9px;padding:8px;color:white;text-decoration:none;background:linear-gradient(110deg,#6863f3,#8b50ec);font-size:10px;font-weight:800; }
        .asm-d-sidebar-foot { display:flex;align-items:center;gap:10px;padding:15px 7px 0;color:#8491b2;font-size:11px; }
        .asm-d-avatar { display:grid;place-items:center;width:31px;height:31px;flex-shrink:0;border-radius:50%;color:#fff;font-size:12px;font-weight:800;background:linear-gradient(135deg,#8269ff,#31afda);box-shadow:0 0 18px rgba(128,102,255,.18); }
        .asm-d-foot-name { min-width:0; flex:1; }
        .asm-d-foot-name strong { display:block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e6eaff; }
        .asm-d-foot-name small { display:block;margin-top:3px;color:#637299;font-size:9px; }
        .asm-d-main { min-width:0;padding:0 clamp(20px,3vw,42px) 55px; }
        .asm-d-topbar { min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:22px;border-bottom:1px solid rgba(157,163,255,.1); }
        .asm-d-topbar-left { display:flex;align-items:center;gap:12px;flex:1;min-width:0; }
        .asm-d-mobile-menu { display:none; }
        .asm-d-search { width:min(480px,100%);display:flex;align-items:center;gap:10px;padding:0 13px;min-height:42px;border-radius:13px;border:1px solid rgba(157,163,255,.18);background:rgba(12,20,49,.73);box-shadow:inset 0 1px rgba(255,255,255,.04);transition:border-color .2s,box-shadow .2s; }
        .asm-d-search:focus-within { border-color:rgba(156,134,255,.58);box-shadow:0 0 0 3px rgba(127,103,255,.1); }
        .asm-d-search svg { color:#7f8eb5;flex-shrink:0; }
        .asm-d-search input { width:100%;min-width:0;border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;color:#f3f4ff!important;font-size:12px!important;padding:0!important;border-radius:0!important; }
        .asm-d-search input::placeholder { color:#68779d; }
        .asm-d-topbar-right { display:flex;align-items:center;gap:11px; }
        .asm-d-icon-button { width:38px;height:38px;display:grid;place-items:center;border-radius:12px;color:#9aa8ce;border:1px solid rgba(157,163,255,.14);background:rgba(255,255,255,.035);cursor:pointer;transition:all .2s; }
        .asm-d-icon-button:hover { color:white;border-color:rgba(160,145,255,.38);background:rgba(120,96,255,.12); }
        .asm-d-user-chip { display:flex;align-items:center;gap:9px;padding:5px 10px 5px 5px;border:1px solid rgba(157,163,255,.14);border-radius:13px;background:rgba(255,255,255,.035);color:#e2e8ff;font-size:11px;font-weight:650;max-width:190px; }
        .asm-d-user-chip span:last-child { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .asm-d-greeting { display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:27px 0 22px; }
        .asm-d-greeting h1 { margin:0;color:#f4f5ff;font-size:clamp(24px,3vw,33px);letter-spacing:-1.1px;line-height:1.16; }
        .asm-d-greeting h1 span { color:#c8b7ff; }
        .asm-d-greeting p { margin:8px 0 0;color:#8998bc;font-size:12px; }
        .asm-d-date-pill { display:inline-flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid rgba(157,163,255,.15);border-radius:11px;background:rgba(255,255,255,.035);color:#9caad0;font-size:10px;white-space:nowrap; }
        .asm-d-search-panel { position:relative;z-index:10;margin:-7px 0 18px;padding:10px;border:1px solid rgba(157,163,255,.18);border-radius:15px;background:rgba(8,15,41,.96);box-shadow:0 22px 45px rgba(0,0,0,.27);backdrop-filter:blur(20px); }
        .asm-d-search-panel-head { display:flex;align-items:center;justify-content:space-between;padding:5px 7px 9px;color:#7e8eb6;font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase; }
        .asm-d-result-row { display:flex;align-items:center;gap:11px;padding:10px;border-radius:10px;transition:background .2s; }
        .asm-d-result-row:hover { background:rgba(125,99,255,.09); }
        .asm-d-result-icon { display:grid;place-items:center;width:37px;height:37px;flex-shrink:0;border-radius:11px;color:#c7baff;background:rgba(126,101,255,.15); }
        .asm-d-result-copy { flex:1;min-width:0; }
        .asm-d-result-copy strong { display:block;color:#eef0ff;font-size:12px; }
        .asm-d-result-copy small { display:block;margin-top:4px;color:#7788ad;font-size:10px; }
        .asm-d-result-action { display:inline-flex;align-items:center;gap:7px;white-space:nowrap;padding:8px 10px;border-radius:9px;border:1px solid rgba(165,145,255,.23);background:rgba(113,87,255,.16);color:#e4ddff;font-size:10px;font-weight:750;cursor:pointer; }
        .asm-d-result-action:hover { background:rgba(126,96,255,.28); }
        .asm-d-stat-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:28px; }
        .asm-d-stat { display:flex;align-items:center;gap:12px;min-width:0;padding:16px;border-radius:17px;border:1px solid rgba(157,163,255,.15);background:linear-gradient(145deg,rgba(19,31,68,.8),rgba(9,17,43,.78));box-shadow:0 15px 30px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.05); }
        .asm-d-stat-icon { display:grid;place-items:center;width:42px;height:42px;flex-shrink:0;border-radius:13px;color:#c7baff;background:rgba(130,100,255,.17);border:1px solid rgba(160,141,255,.13); }
        .asm-d-stat-icon.cyan { color:#67e6f5;background:rgba(36,193,220,.12); }
        .asm-d-stat-icon.gold { color:#ffd27a;background:rgba(245,173,65,.13); }
        .asm-d-stat-icon.green { color:#6ce4bd;background:rgba(39,190,138,.12); }
        .asm-d-stat span { display:block;color:#8392b8;font-size:10px;line-height:1.4; }
        .asm-d-stat strong { display:block;margin-top:5px;color:#f3f4ff;font-size:19px;letter-spacing:-.3px; }
        .asm-d-content-grid { display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,.85fr);gap:20px;align-items:start; }
        .asm-d-section-head { display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:15px; }
        .asm-d-section-head h2 { margin:0;color:#f2f3ff;font-size:19px;letter-spacing:-.6px; }
        .asm-d-section-head p { margin:5px 0 0;color:#7d8cb1;font-size:11px; }
        .asm-d-view-all { display:inline-flex;align-items:center;gap:5px;color:#c3b6ff;text-decoration:none;font-size:10px;font-weight:750;white-space:nowrap; }
        .asm-d-view-all:hover { color:#fff; }
        .asm-d-course-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px; }
        .asm-d-course-card { position:relative;min-width:0;overflow:hidden;padding:17px;border-radius:19px;border:1px solid rgba(157,163,255,.17);background:linear-gradient(145deg,rgba(20,32,72,.91),rgba(9,17,43,.91));box-shadow:0 17px 37px rgba(0,0,0,.14),inset 0 1px rgba(255,255,255,.055);transition:transform .23s,border-color .23s,box-shadow .23s; }
        .asm-d-course-card::after { content:"";position:absolute;top:-65px;right:-55px;width:130px;height:130px;border-radius:50%;background:rgba(113,87,255,.11);filter:blur(35px);pointer-events:none; }
        .asm-d-course-card:hover { transform:translateY(-4px);border-color:rgba(156,137,255,.39);box-shadow:0 20px 42px rgba(0,0,0,.22),0 0 28px rgba(103,87,255,.08); }
        .asm-d-course-top { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px; }
        .asm-d-course-icon { display:grid;place-items:center;width:47px;height:47px;border-radius:14px;color:#d0c6ff;border:1px solid rgba(161,145,255,.22);background:linear-gradient(145deg,rgba(120,92,255,.2),rgba(33,158,226,.1));box-shadow:inset 0 1px rgba(255,255,255,.1); }
        .asm-d-delete { display:grid;place-items:center;width:31px;height:31px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);color:#7483a8;cursor:pointer;transition:all .2s; }
        .asm-d-delete:hover { color:#ff9999;border-color:rgba(255,117,117,.25);background:rgba(255,100,100,.08); }
        .asm-d-course-label { display:block;margin-bottom:7px;color:#a59aff;font-size:9px;font-weight:850;letter-spacing:1.4px;text-transform:uppercase; }
        .asm-d-course-title { display:block;color:#f1f2ff;text-decoration:none;font-size:16px;font-weight:750;line-height:1.3;overflow-wrap:anywhere; }
        .asm-d-course-title:hover { color:#c9c0ff; }
        .asm-d-course-desc { margin:6px 0 17px;color:#7f8db0;font-size:10px;line-height:1.55;min-height:31px; }
        .asm-d-course-progress { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px;color:#7080a6;font-size:9px; }
        .asm-d-course-progress strong { color:#a9baff;font-size:9px; }
        .asm-d-progress-track { height:5px;border-radius:99px;overflow:hidden;background:rgba(104,121,180,.18); }
        .asm-d-progress-fill { height:100%;border-radius:inherit;background:linear-gradient(90deg,#5c7cff,#a15bff,#4adbe9);box-shadow:0 0 13px rgba(128,92,255,.3); }
        .asm-d-course-footer { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:17px;color:#7181a6;font-size:9px; }
        .asm-d-course-footer span { display:flex;align-items:center;gap:5px; }
        .asm-d-course-actions { display:flex;flex-wrap:wrap;gap:6px;margin-top:13px; }
        .asm-d-mini-link { display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid rgba(154,140,255,.12);border-radius:8px;color:#bdb1ff;text-decoration:none;font-size:9px;background:rgba(121,95,255,.09);transition:all .2s; }
        .asm-d-mini-link:hover { background:rgba(121,95,255,.19);border-color:rgba(154,140,255,.28);color:#fff; }
        .asm-d-empty { display:grid;place-items:center;text-align:center;padding:34px 22px;border:1px dashed rgba(157,163,255,.22);border-radius:21px;background:rgba(12,20,48,.48); }
        .asm-d-empty-icon { display:grid;place-items:center;width:58px;height:58px;margin-bottom:13px;border-radius:17px;color:#c9bdff;background:rgba(124,96,255,.16); }
        .asm-d-empty h3 { margin:0 0 6px;color:#f0efff;font-size:16px; }
        .asm-d-empty p { max-width:350px;margin:0;color:#8291b5;font-size:11px;line-height:1.65; }
        .asm-d-primary { display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:17px;padding:10px 13px;border:1px solid rgba(201,187,255,.28);border-radius:11px;color:white;text-decoration:none;font-size:11px;font-weight:800;cursor:pointer;background:linear-gradient(110deg,#6269f6,#8b4ff0 65%,#b451e1);box-shadow:0 9px 23px rgba(105,81,255,.22),inset 0 1px rgba(255,255,255,.2);transition:all .2s; }
        .asm-d-primary:hover { transform:translateY(-2px);filter:brightness(1.08); }
        .asm-d-right-column { display:grid;gap:16px; }
        .asm-d-panel { border:1px solid rgba(157,163,255,.17);border-radius:20px;background:linear-gradient(145deg,rgba(18,29,65,.89),rgba(8,16,41,.91));box-shadow:0 20px 40px rgba(0,0,0,.15),inset 0 1px rgba(255,255,255,.06);overflow:hidden; }
        .asm-d-panel-head { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:17px 17px 13px;border-bottom:1px solid rgba(157,163,255,.1); }
        .asm-d-panel-head h3 { margin:0;color:#f1f2ff;font-size:14px; }
        .asm-d-panel-head span { color:#8593b5;font-size:9px;white-space:nowrap; }
        .asm-d-plan-body { padding:8px 13px 14px; }
        .asm-d-plan-progress { margin:0 4px 12px;padding:10px 11px;border:1px solid rgba(157,163,255,.1);border-radius:11px;background:rgba(255,255,255,.025); }
        .asm-d-plan-progress-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;color:#8999bd;font-size:9px; }
        .asm-d-plan-progress-row strong { color:#cac0ff; }
        .asm-d-plan-item { display:flex;align-items:center;gap:10px;width:100%;padding:12px 7px;border:0;border-bottom:1px solid rgba(157,163,255,.075);background:transparent;text-align:left;color:inherit;cursor:pointer;transition:background .18s;border-radius:9px; }
        .asm-d-plan-item:last-child { border-bottom:0; }
        .asm-d-plan-item:hover { background:rgba(255,255,255,.035); }
        .asm-d-check { display:grid;place-items:center;width:17px;height:17px;flex-shrink:0;border-radius:5px;border:1px solid rgba(154,166,218,.38);color:white;background:rgba(255,255,255,.025); }
        .asm-d-check.done { border-color:#6f6cf6;background:linear-gradient(135deg,#5d70fa,#9b55eb);box-shadow:0 0 14px rgba(111,102,255,.26); }
        .asm-d-plan-copy { min-width:0;flex:1; }
        .asm-d-plan-copy strong { display:block;color:#dfe4fb;font-size:10px;font-weight:650; }
        .asm-d-plan-copy small { display:block;margin-top:4px;color:#7483a7;font-size:9px; }
        .asm-d-plan-item.is-done .asm-d-plan-copy strong { color:#828eae;text-decoration:line-through; }
        .asm-d-plan-icon { color:#8698c2; }
        .asm-d-plan-link { display:flex;justify-content:flex-end;align-items:center;gap:6px;margin:8px 3px 0;color:#c0b3ff;text-decoration:none;font-size:10px;font-weight:750; }
        .asm-d-quote { position:relative;min-height:182px;padding:21px 19px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid rgba(170,144,255,.22);border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 83% 8%,rgba(255,149,182,.34),transparent 31%),radial-gradient(ellipse at 72% 75%,rgba(72,94,202,.6),transparent 40%),linear-gradient(155deg,#292e6b,#311d5a 54%,#102147);box-shadow:0 20px 40px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.12); }
        .asm-d-quote::before { content:"";position:absolute;right:-10px;bottom:-43px;width:190px;height:145px;background:linear-gradient(145deg,rgba(248,201,244,.55),rgba(59,78,162,.17));clip-path:polygon(0 100%,43% 12%,61% 48%,78% 0,100% 100%);filter:drop-shadow(0 0 20px rgba(147,117,255,.25));opacity:.6; }
        .asm-d-quote::after { content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 20%,rgba(5,9,30,.78) 100%);pointer-events:none; }
        .asm-d-quote > * { position:relative;z-index:1; }
        .asm-d-quote-mark { color:#c9bcff;font-size:29px;line-height:.8;margin-bottom:11px; }
        .asm-d-quote blockquote { max-width:300px;margin:0;color:#f8f4ff;font-size:19px;font-weight:700;line-height:1.3;letter-spacing:-.45px; }
        .asm-d-quote p { margin:9px 0 0;color:#c1c7ec;font-size:10px; }
        .asm-d-recommendations { margin-top:26px; }
        .asm-d-recommend-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px; }
        .asm-d-recommend { display:flex;align-items:center;gap:10px;min-width:0;padding:12px;border-radius:15px;border:1px solid rgba(157,163,255,.14);background:linear-gradient(145deg,rgba(20,31,71,.72),rgba(9,16,42,.81));color:inherit;text-align:left;cursor:pointer;transition:all .2s; }
        .asm-d-recommend:hover { transform:translateY(-3px);border-color:rgba(160,142,255,.35);background:rgba(100,81,205,.12); }
        .asm-d-recommend-icon { display:grid;place-items:center;width:38px;height:38px;flex-shrink:0;border-radius:11px;color:#d1c5ff;background:rgba(123,97,255,.17); }
        .asm-d-recommend:nth-child(2) .asm-d-recommend-icon { color:#6de4d2;background:rgba(36,202,177,.11); }
        .asm-d-recommend:nth-child(3) .asm-d-recommend-icon { color:#8bbcff;background:rgba(51,133,241,.13); }
        .asm-d-recommend:nth-child(4) .asm-d-recommend-icon { color:#ff9fcf;background:rgba(231,71,157,.12); }
        .asm-d-recommend strong { display:block;color:#edf0ff;font-size:10px;line-height:1.45; }
        .asm-d-recommend small { display:block;margin-top:4px;color:#7786aa;font-size:9px; }
        .asm-d-success { display:flex;align-items:center;gap:9px;margin:19px 0;padding:11px 14px;color:#9df1cc;border:1px solid rgba(74,220,169,.2);border-radius:12px;background:rgba(23,176,125,.09);font-size:12px; }
        .asm-d-modal-overlay { position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:rgba(2,5,19,.75);backdrop-filter:blur(14px); }
        .asm-d-modal { position:relative;width:min(480px,100%);padding:28px;border:1px solid rgba(169,151,255,.3);border-radius:25px;background:linear-gradient(145deg,#17234b,#0a1230);box-shadow:0 35px 100px rgba(0,0,0,.5),inset 0 1px rgba(255,255,255,.08); }
        .asm-d-modal-close { position:absolute;top:16px;right:16px;display:grid;place-items:center;width:33px;height:33px;border:1px solid rgba(157,163,255,.14);border-radius:10px;color:#95a2c8;background:rgba(255,255,255,.04);cursor:pointer; }
        .asm-d-modal-icon { width:50px;height:50px;display:grid;place-items:center;margin-bottom:18px;border:1px solid rgba(173,157,255,.24);border-radius:16px;color:#e1d9ff;background:rgba(124,100,255,.18); }
        .asm-d-modal h2 { margin:0;color:#f4f4ff;font-size:24px;letter-spacing:-.8px; }
        .asm-d-modal > p { margin:8px 0 22px;color:#8f9dc0;font-size:12px;line-height:1.6; }
        .asm-d-form { display:grid;gap:9px; }
        .asm-d-form label { margin-top:7px;color:#c4cce6;font-size:11px;font-weight:700; }
        .asm-d-form input,.asm-d-form textarea { width:100%;padding:12px 13px;border:1px solid rgba(157,163,255,.2);border-radius:11px;outline:0;color:#f3f4ff;background:rgba(5,10,31,.72);font:inherit;font-size:12px; }
        .asm-d-form input:focus,.asm-d-form textarea:focus { border-color:rgba(157,137,255,.65);box-shadow:0 0 0 3px rgba(122,99,255,.1); }
        .asm-d-form textarea { resize:vertical; }
        .asm-d-modal-actions { display:flex;justify-content:flex-end;gap:9px;margin-top:14px; }
        .asm-d-cancel { padding:10px 14px;border:1px solid rgba(157,163,255,.2);border-radius:10px;color:#b8c3e3;background:rgba(255,255,255,.04);cursor:pointer;font-size:11px;font-weight:700; }
        .asm-d-create { display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 15px;border:1px solid rgba(204,188,255,.3);border-radius:10px;color:white;background:linear-gradient(110deg,#6268f4,#9750ef);box-shadow:0 8px 20px rgba(104,83,255,.24);cursor:pointer;font-size:11px;font-weight:800; }
        .asm-d-create:disabled { opacity:.6;cursor:wait; }
        @media(max-width:1180px) { .asm-dashboard { grid-template-columns:215px minmax(0,1fr); } .asm-d-main { padding-left:20px;padding-right:20px; } .asm-d-content-grid { grid-template-columns:minmax(0,1fr); } .asm-d-right-column { grid-template-columns:repeat(2,minmax(0,1fr));align-items:start; } .asm-d-quote { min-height:100%; } .asm-d-recommend-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:820px) { .asm-dashboard { display:block; } .asm-d-sidebar { position:fixed;left:0;top:0;width:248px;max-width:86vw;transform:translateX(-105%);transition:transform .25s ease;box-shadow:25px 0 60px rgba(0,0,0,.34); } .asm-d-sidebar.open { transform:translateX(0); } .asm-d-mobile-menu { display:grid;place-items:center;width:39px;height:39px;border:1px solid rgba(157,163,255,.17);border-radius:12px;color:#aeb9dc;background:rgba(255,255,255,.04);cursor:pointer; } .asm-d-main { padding:0 20px 44px; } .asm-d-topbar { min-height:70px; } .asm-d-greeting { margin-top:23px; } }
        @media(max-width:560px) { .asm-d-main { padding:0 14px 35px; } .asm-d-topbar { gap:8px; } .asm-d-search { min-height:39px;padding:0 9px;gap:7px; } .asm-d-topbar-right { gap:6px; } .asm-d-icon-button { width:34px;height:34px; } .asm-d-user-chip { max-width:38px;padding:3px; } .asm-d-user-chip span:last-child { display:none; } .asm-d-greeting { align-items:flex-start;flex-direction:column;gap:12px;margin:22px 0 18px; } .asm-d-greeting h1 { font-size:25px; } .asm-d-stat-grid { grid-template-columns:repeat(2,minmax(0,1fr));gap:9px; } .asm-d-stat { padding:11px;gap:8px; } .asm-d-stat-icon { width:36px;height:36px; } .asm-d-stat strong { font-size:16px; } .asm-d-stat span { font-size:9px; } .asm-d-content-grid { gap:20px; } .asm-d-course-grid { grid-template-columns:minmax(0,1fr); } .asm-d-right-column { grid-template-columns:1fr; } .asm-d-quote { min-height:180px; } .asm-d-recommend-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .asm-d-recommend { padding:10px;gap:8px; } .asm-d-recommend-icon { width:31px;height:31px; } .asm-d-recommend strong { font-size:9px; } .asm-d-search-panel { margin-top:8px; } .asm-d-result-row { flex-wrap:wrap; } .asm-d-result-action { margin-left:auto; } .asm-d-date-pill { font-size:9px; } }
        @media(prefers-reduced-motion:reduce) { .asm-dashboard *, .asm-dashboard *::before, .asm-dashboard *::after { animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important; } }
      `}</style>

      <aside className={`asm-d-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <Link to="/dashboard" className="asm-d-brand" onClick={() => setMobileNavOpen(false)}>
          <span className="asm-d-brand-mark"><BrainCircuit size={23} /></span>
          <span>AI StudyMate</span>
        </Link>
        <div className="asm-d-nav-label">Workspace</div>
        <nav className="asm-d-nav" aria-label="StudyMate navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={item.active ? 'active' : ''}
                onClick={() => setMobileNavOpen(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.active && <span style={{ marginLeft: 'auto', color: '#a89aff' }}>•</span>}
              </Link>
            );
          })}
          <Link to="/my-courses" onClick={() => setMobileNavOpen(false)}><Settings size={17} /><span>Learning Settings</span></Link>
        </nav>

        <div className="asm-d-sidebar-bottom">
          <div className="asm-d-upgrade">
            <div className="asm-d-upgrade-icon"><GraduationCap size={19} /></div>
            <strong>Keep growing</strong>
            <p>Small focused sessions build stronger skills.</p>
            <Link to="/my-courses">Explore learning <ArrowRight size={13} /></Link>
          </div>
          <div className="asm-d-sidebar-foot">
            <span className="asm-d-avatar">{userName.charAt(0).toUpperCase()}</span>
            <span className="asm-d-foot-name"><strong>{userName}</strong><small>MY LEARNING SPACE</small></span>
            <button className="asm-d-icon-button" aria-label="Log out" title="Log out" onClick={handleLogout}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <div className="asm-d-main">
        <header className="asm-d-topbar">
          <div className="asm-d-topbar-left">
            <button className="asm-d-mobile-menu" type="button" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation"><span style={{ fontSize: 18 }}>☰</span></button>
            <form className="asm-d-search" onSubmit={handleSearchSubmit}>
              <Search size={17} />
              <input
                id="asm-global-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search courses, topics, videos, notes..."
                aria-label="Search learning content"
              />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'transparent', border: 0, color: '#8190b5', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}><X size={15} /></button>}
            </form>
          </div>
          <div className="asm-d-topbar-right">
            <button className="asm-d-icon-button" type="button" aria-label="Notifications" title="Notifications"><Bell size={16} /></button>
            <button className="asm-d-user-chip" type="button" onClick={handleLogout} title="Click to log out"><span className="asm-d-avatar">{userName.charAt(0).toUpperCase()}</span><span>{userName}</span></button>
          </div>
        </header>

        {search.trim() && (
          <section className="asm-d-search-panel" aria-label="Search results">
            <div className="asm-d-search-panel-head"><span>Search results</span><span>{matchingCourses.length} matching courses</span></div>
            {exactCourse ? (
              <div className="asm-d-result-row">
                <div className="asm-d-result-icon"><CourseIcon title={exactCourse.title} size={21} /></div>
                <div className="asm-d-result-copy"><strong>{exactCourse.title}</strong><small>Already in your learning space</small></div>
                <button className="asm-d-result-action" type="button" onClick={() => navigate(`/courses/${exactCourse.id}`)}>Open course <ArrowRight size={14} /></button>
              </div>
            ) : matchingCourses.length > 0 ? (
              matchingCourses.slice(0, 4).map((course) => (
                <div className="asm-d-result-row" key={course.id}>
                  <div className="asm-d-result-icon"><CourseIcon title={course.title} size={21} /></div>
                  <div className="asm-d-result-copy"><strong>{course.title}</strong><small>{course.description || 'Registered course'}</small></div>
                  <button className="asm-d-result-action" type="button" onClick={() => navigate(`/courses/${course.id}`)}>Open <ArrowRight size={14} /></button>
                </div>
              ))
            ) : (
              <div className="asm-d-result-row">
                <div className="asm-d-result-icon"><Plus size={20} /></div>
                <div className="asm-d-result-copy"><strong>Add “{search.trim()}”</strong><small>Register this subject in your learning space.</small></div>
                <button className="asm-d-result-action" type="button" disabled={creating} onClick={() => void handleAddFromSearch()}><Plus size={14} /> {creating ? 'Adding...' : 'Add course'}</button>
              </div>
            )}
          </section>
        )}

        <section className="asm-d-greeting">
          <div>
            <h1>Good to see you, <span>{firstName}!</span> 👋</h1>
            <p>Keep your momentum going. One small step today is progress.</p>
          </div>
          <div className="asm-d-date-pill"><CalendarCheck size={14} /> YOUR LEARNING SPACE</div>
        </section>

        <section className="asm-d-stat-grid" aria-label="Learning overview">
          <article className="asm-d-stat">
            <div className="asm-d-stat-icon"><BookOpen size={21} /></div>
            <div><span>Courses enrolled</span><strong>{loading ? '—' : courses.length}</strong></div>
          </article>
          <article className="asm-d-stat">
            <div className="asm-d-stat-icon cyan"><Upload size={21} /></div>
            <div><span>Study materials</span><strong>{loading ? '—' : totalMaterials}</strong></div>
          </article>
          <article className="asm-d-stat">
            <div className="asm-d-stat-icon gold"><Flame size={21} /></div>
            <div><span>Daily plan</span><strong>{planComplete}/{PLAN_ITEMS.length}</strong></div>
          </article>
          <article className="asm-d-stat">
            <div className="asm-d-stat-icon green"><Zap size={21} /></div>
            <div><span>Learning tools</span><strong>4+</strong></div>
          </article>
        </section>

        {successMessage && <div className="asm-d-success" role="status"><CheckCircle2 size={17} /> {successMessage}</div>}

        <div className="asm-d-content-grid">
          <div className="asm-d-left-column">
            <section>
              <div className="asm-d-section-head">
                <div><h2>Continue learning</h2><p>Pick up where you left off and keep building your skills.</p></div>
                <Link className="asm-d-view-all" to="/my-courses">View all <ArrowRight size={13} /></Link>
              </div>

              {loading ? (
                <div className="asm-d-empty"><div className="asm-d-empty-icon"><BookOpen size={27} /></div><h3>Preparing your learning space</h3><p>Your registered courses are loading.</p></div>
              ) : courses.length === 0 ? (
                <div className="asm-d-empty"><div className="asm-d-empty-icon"><BookOpen size={27} /></div><h3>Your next chapter starts here</h3><p>Create your first course and keep your notes, practice and AI learning tools together.</p><button className="asm-d-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} /> Create your first course</button></div>
              ) : (
                <div className="asm-d-course-grid">
                  {matchingCourses.slice(0, 4).map((course) => (
                    <article className="asm-d-course-card" key={course.id}>
                      <div className="asm-d-course-top">
                        <div className="asm-d-course-icon"><CourseIcon title={course.title} size={29} /></div>
                        <button className="asm-d-delete" type="button" title={`Delete ${course.title}`} aria-label={`Delete ${course.title}`} onClick={(event) => void handleDeleteCourse(event, course.id, course.title)}><Trash2 size={15} /></button>
                      </div>
                      <span className="asm-d-course-label">COURSE</span>
                      <Link className="asm-d-course-title" to={`/courses/${course.id}`}>{course.title}</Link>
                      <p className="asm-d-course-desc">{course.description || course.subject || 'Learn, practice and master this subject.'}</p>
                      <div className="asm-d-course-progress"><span>Progress</span><strong>0%</strong></div>
                      <div className="asm-d-progress-track"><div className="asm-d-progress-fill" style={{ width: '0%' }} /></div>

                    <div className="coding-card-progress" style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, color: '#8291b5', fontSize: 10 }}>
                        <span>Coding problems solved</span>
                        <strong style={{ color: '#bdb1ff' }}>{codingStats[course.id]?.solved ?? 0}/{codingStats[course.id]?.total ?? 0}</strong>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, overflow: 'hidden', background: 'rgba(104,121,180,.18)' }}>
                        <div style={{ height: '100%', width: `${codingStats[course.id]?.percent ?? 0}%`, borderRadius: 'inherit', background: 'linear-gradient(90deg,#7565ff,#48d6e8)', transition: 'width .25s ease' }} />
                      </div>
                    </div>

                    <div className="asm-d-course-footer"><span><Upload size={12} /> {course.material_count || 0} materials</span><span><ArrowRight size={12} /> Start learning</span></div>
                      <div className="asm-d-course-actions">
                        <Link className="asm-d-mini-link" to={`/courses/${course.id}/tutor`}><MessageCircle size={12} /> AI Tutor</Link>
                        <Link className="asm-d-mini-link" to={`/courses/${course.id}/quiz`}><Target size={12} /> Quiz</Link>
                        <Link className="asm-d-mini-link" to={`/courses/${course.id}`}><Play size={12} /> Learn</Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="asm-d-recommendations">
              <div className="asm-d-section-head">
                <div><h2>Explore by subject</h2><p>Choose a subject to add it to your learning space.</p></div>
                <button className="asm-d-view-all" type="button" onClick={() => setShowCreate(true)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>Add course <Plus size={13} /></button>
              </div>
              <div className="asm-d-recommend-grid">
                {[
                  { title: 'C Programming', detail: 'Learn the fundamentals', icon: Code2 },
                  { title: 'Mathematics', detail: 'Practice step by step', icon: BookMarked },
                  { title: 'Artificial Intelligence', detail: 'Explore AI concepts', icon: BrainCircuit },
                  { title: 'Computer Networks', detail: 'Understand the basics', icon: Target },
                ].map((subject) => {
                  const Icon = subject.icon;
                  return <button className="asm-d-recommend" type="button" key={subject.title} onClick={() => { setSearch(subject.title); document.getElementById('asm-global-search')?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <span className="asm-d-recommend-icon"><Icon size={19} /></span>
                    <span><strong>{subject.title}</strong><small>{subject.detail}</small></span>
                  </button>;
                })}
              </div>
            </section>
          </div>

          <aside className="asm-d-right-column">
            <section className="asm-d-panel">
              <div className="asm-d-panel-head"><h3>Today’s plan</h3><span>{planComplete} of {PLAN_ITEMS.length} done</span></div>
              <div className="asm-d-plan-body">
                <div className="asm-d-plan-progress"><div className="asm-d-plan-progress-row"><span>Your daily momentum</span><strong>{Math.round((planComplete / PLAN_ITEMS.length) * 100)}%</strong></div><div className="asm-d-progress-track"><div className="asm-d-progress-fill" style={{ width: `${(planComplete / PLAN_ITEMS.length) * 100}%` }} /></div></div>
                {PLAN_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const done = checkedTasks[index];
                  return <button className={`asm-d-plan-item ${done ? 'is-done' : ''}`} key={item.title} type="button" onClick={() => togglePlanItem(index)} aria-pressed={done}>
                    <span className={`asm-d-check ${done ? 'done' : ''}`}>{done && <Check size={12} />}</span>
                    <span className="asm-d-plan-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                    <Icon className="asm-d-plan-icon" size={15} />
                  </button>;
                })}
                <Link className="asm-d-plan-link" to={firstCourseId ? `/courses/${firstCourseId}/progress` : '/my-courses'}>Review my progress <ChevronRight size={13} /></Link>
              </div>
            </section>

            <section className="asm-d-quote">
              <div className="asm-d-quote-mark">“</div>
              <blockquote>Discipline today creates a brighter tomorrow.</blockquote>
              <p>A little progress, every day.</p>
            </section>

            <section className="asm-d-panel">
              <div className="asm-d-panel-head"><h3>Quick actions</h3><span>Keep moving</span></div>
              <div className="asm-d-plan-body">
                <Link className="asm-d-plan-item" to={tutorPath} style={{ textDecoration: 'none' }}><span className="asm-d-check"><BrainCircuit size={12} /></span><span className="asm-d-plan-copy"><strong>Ask AI Tutor</strong><small>Get an explanation</small></span><ChevronRight size={14} className="asm-d-plan-icon" /></Link>
                <Link className="asm-d-plan-item" to="/coding-practice" style={{ textDecoration: 'none' }}><span className="asm-d-check"><Code2 size={12} /></span><span className="asm-d-plan-copy"><strong>Practice coding</strong><small>Try a challenge</small></span><ChevronRight size={14} className="asm-d-plan-icon" /></Link>
                <Link className="asm-d-plan-item" to={notesPath} style={{ textDecoration: 'none' }}><span className="asm-d-check"><FileText size={12} /></span><span className="asm-d-plan-copy"><strong>Open notes & videos</strong><small>Study by topic</small></span><ChevronRight size={14} className="asm-d-plan-icon" /></Link>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showCreate && (
        <div className="asm-d-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className="asm-d-modal" role="dialog" aria-modal="true" aria-labelledby="asm-create-course-title">
            <button className="asm-d-modal-close" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={17} /></button>
            <div className="asm-d-modal-icon"><Plus size={24} /></div>
            <h2 id="asm-create-course-title">Create a new course</h2>
            <p>Make a dedicated space for your course notes, practice and AI-powered learning.</p>
            <form className="asm-d-form" onSubmit={handleCreate}>
              <label htmlFor="asm-course-title">Course title</label>
              <input id="asm-course-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Python Programming" required autoFocus />
              <label htmlFor="asm-course-description">Description (optional)</label>
              <textarea id="asm-course-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you want to learn?" rows={3} />
              <div className="asm-d-modal-actions">
                <button className="asm-d-cancel" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="asm-d-create" type="submit" disabled={creating}>{creating ? 'Creating…' : <><Sparkles size={14} /> Create course</>}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
