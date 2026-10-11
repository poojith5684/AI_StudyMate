import {
  BookOpen,
  BrainCircuit,
  Braces,
  Code2,
  Coffee,
  Cpu,
  Database,
  FileText,
  Globe,
  Network,
  Sigma,
  Terminal,
} from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { title: string; size?: number };

function PythonLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="Python" fill="none">
      <path
        fill="#3776AB"
        d="M17.8 2.2c-7.5 0-7 3.3-7 3.3v4.2h7.2v1.5H8.2S2.8 10.7 2.8 18.2c0 7.4 4.9 7.2 4.9 7.2h3v-4.1c0-3.2 2.7-5.9 5.9-5.9h8.1c2.6 0 4.7-2.1 4.7-4.7V6.1s.7-3.9-7.1-3.9h-4.5ZM15.2 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
      />
      <path
        fill="#FFD43B"
        d="M18.2 33.8c7.5 0 7-3.3 7-3.3v-4.2H18v-1.5h9.8s5.4.5 5.4-7c0-7.4-4.9-7.2-4.9-7.2h-3v4.1c0 3.2-2.7 5.9-5.9 5.9h-8.1c-2.6 0-4.7 2.1-4.7 4.7v4.6s-.7 3.9 7.1 3.9h4.5Zm2.6-2.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
      />
    </svg>
  );
}

function getMeta(title: string): { key: string; label: string; icon: ReactNode } {
  const t = title.toLowerCase();
  const size = 27;
  if (/\bpython\b/.test(t)) return { key: 'python', label: 'Python', icon: <PythonLogo size={size} /> };
  if (/\bjava\b/.test(t) && !/javascript/.test(t)) return { key: 'java', label: 'Java', icon: <Coffee size={size} strokeWidth={1.9} /> };
  if (/\bsql\b|database|dbms|mysql|postgres|sqlite/.test(t)) return { key: 'sql', label: 'SQL database', icon: <Database size={size} strokeWidth={1.9} /> };
  if (/machine learning|artificial intelligence|\bai\b|deep learning|neural network/.test(t)) return { key: 'ai', label: 'AI and machine learning', icon: <BrainCircuit size={size} strokeWidth={1.9} /> };
  if (/dsa|data structure|algorithm/.test(t)) return { key: 'dsa', label: 'Data structures and algorithms', icon: <Network size={size} strokeWidth={1.9} /> };
  if (/mathematics|maths|calculus|algebra|statistics|probability/.test(t)) return { key: 'math', label: 'Mathematics', icon: <Sigma size={size} strokeWidth={1.9} /> };
  if (/javascript|typescript|react|web development|html|css/.test(t)) return { key: 'web', label: 'Web development', icon: <Braces size={size} strokeWidth={1.9} /> };
  if (/computer network|networking|network/.test(t)) return { key: 'network', label: 'Networking', icon: <Globe size={size} strokeWidth={1.9} /> };
  if (/operating system|linux|command line|shell/.test(t)) return { key: 'terminal', label: 'Systems and terminal', icon: <Terminal size={size} strokeWidth={1.9} /> };
  if (/computer architecture|digital logic|hardware|microprocessor/.test(t)) return { key: 'hardware', label: 'Computer hardware', icon: <Cpu size={size} strokeWidth={1.9} /> };
  if (/\bc\+\+\b|\bc programming\b|\bc language\b|\bc basics\b|coding|programming/.test(t)) return { key: 'code', label: 'Programming', icon: <Code2 size={size} strokeWidth={1.9} /> };
  if (/notes|reading|textbook|materials/.test(t)) return { key: 'notes', label: 'Study materials', icon: <FileText size={size} strokeWidth={1.9} /> };
  return { key: 'general', label: 'Course', icon: <BookOpen size={size} strokeWidth={1.9} /> };
}

export default function CourseIcon({ title, size = 27 }: Props) {
  const meta = getMeta(title);
  return (
    <span className={`course-mark course-mark--${meta.key}`} role="img" aria-label={meta.label}>
      {meta.key === 'python' ? <PythonLogo size={size} /> : meta.icon}
    </span>
  );
}
