import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Brain, Check, Copy, Menu, MessageSquare, Pencil, Plus,
  Search, Send, Sparkles, Trash2, X, BookOpen, FileText, Paperclip,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { materialsApi, tutorApi } from '../services/api';
import type { ChatMessage, Citation } from '../types';

type TutorMessage = ChatMessage & { id: string; createdAt: number };
type TutorConversation = {
  id: string;
  title: string;
  courseId: string;
  sessionId?: string;
  mode: string;
  messages: TutorMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_PREFIX = 'ai-studymate:tutor-conversations:v1:';
const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const makeConversation = (courseId: string, mode = 'detailed'): TutorConversation => {
  const now = Date.now();
  return {
    id: makeId(),
    title: 'New chat',
    courseId,
    mode,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

const extractAnswerText = (answer: unknown): string => {
  if (typeof answer === 'string') return answer;
  if (answer == null) return 'The AI returned an empty response.';
  if (typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    for (const key of ['answer', 'content', 'text', 'response']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
    if (obj.response && typeof obj.response === 'object') {
      const nested = obj.response as Record<string, unknown>;
      for (const key of ['answer', 'content', 'text']) {
        if (typeof nested[key] === 'string') return nested[key] as string;
      }
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return 'The AI returned a response that could not be displayed.';
    }
  }
  return String(answer);
};

const extractCitations = (res: any): Citation[] => {
  let citations = res?.citations;
  if (!citations && res?.answer?.citations) citations = res.answer.citations;
  if (!Array.isArray(citations)) return [];
  return citations
    .map((citation: any) => {
      if (!citation) return null;
      if (typeof citation === 'string') return { source: citation } as Citation;
      return {
        source: citation.source || citation.filename || citation.file_name || 'Study material',
        page_or_slide:
          citation.page_or_slide || citation.page || citation.slide || citation.slide_number || undefined,
      } as Citation;
    })
    .filter(Boolean) as Citation[];
};

const getTitle = (text: string) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 42 ? `${clean.slice(0, 39)}...` : clean || 'New chat';
};

const styles = `
.tutor-shell{height:100dvh;min-height:560px;display:flex;flex-direction:column;background:#0b1024;color:#e7eaf5;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.tutor-topbar{height:62px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 20px;border-bottom:1px solid #202945;background:#0d132b}
.tutor-brand{display:flex;align-items:center;gap:12px;min-width:0}.tutor-brand-name{font-weight:700;letter-spacing:-.02em}.tutor-muted{color:#97a3c2;font-size:12px}
.tutor-button{border:1px solid #2b3657;border-radius:10px;background:#131c37;color:#e6eaff;padding:9px 12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font:inherit;font-size:13px;transition:background .15s,border-color .15s}
.tutor-button:hover{background:#202b4c;border-color:#465681}.tutor-button:disabled{opacity:.5;cursor:not-allowed}.tutor-button-primary{background:linear-gradient(135deg,#5b54e8,#8050e8);border-color:transparent;color:white}.tutor-button-primary:hover{background:linear-gradient(135deg,#6962f1,#905ef0)}
.tutor-layout{flex:1;min-height:0;display:flex}.tutor-sidebar{width:278px;flex-shrink:0;border-right:1px solid #202945;background:#0d132b;display:flex;flex-direction:column;min-height:0;padding:14px 12px;gap:12px}
.tutor-search{display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid #293452;border-radius:10px;background:#101831;color:#8995b5}.tutor-search input{width:100%;min-width:0;background:transparent;border:0;outline:0;color:#edf0ff;padding:11px 0;font:inherit;font-size:13px}
.tutor-history-label{padding:6px 8px 0;color:#7481a4;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.tutor-history-list{overflow-y:auto;min-height:0;display:flex;flex-direction:column;gap:4px}.tutor-history-row{display:flex;align-items:center;gap:4px;border:1px solid transparent;border-radius:10px;padding:3px;background:transparent}.tutor-history-row.active{background:#1a2342;border-color:#2d3a60}.tutor-history-open{display:flex;align-items:center;gap:9px;flex:1;min-width:0;text-align:left;background:transparent;border:0;color:#d9e0f7;padding:9px 6px;cursor:pointer;font:inherit;font-size:13px}.tutor-history-open span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tutor-icon-button{flex-shrink:0;border:0;background:transparent;color:#8995b5;padding:7px;border-radius:7px;display:inline-flex;cursor:pointer}.tutor-icon-button:hover{background:#2a3556;color:white}
.tutor-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}.tutor-chat-scroll{flex:1;min-height:0;overflow-y:auto;padding:28px 22px 32px}.tutor-chat-inner{max-width:850px;width:100%;margin:0 auto}.tutor-welcome{max-width:690px;margin:8vh auto 0;text-align:center}.tutor-welcome-icon{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border:1px solid #353b76;border-radius:18px;background:linear-gradient(135deg,#1b2450,#2c1d57);color:#aaa8ff}.tutor-welcome h1{font-size:clamp(24px,3vw,34px);letter-spacing:-.04em;margin:0 0 10px;color:#f4f5ff}.tutor-welcome p{margin:0 auto;color:#9ca8c8;font-size:14px;line-height:1.7;max-width:510px}
.tutor-suggestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:28px}.tutor-suggestion{min-height:88px;text-align:left;display:flex;flex-direction:column;gap:8px;justify-content:center;border:1px solid #283354;border-radius:13px;background:#101831;color:#dce3ff;padding:14px;cursor:pointer;font:inherit;font-size:13px}.tutor-suggestion:hover{border-color:#5b61a5;background:#151f40}.tutor-suggestion small{color:#8795ba;font-size:11px}
.tutor-message{display:flex;gap:11px;margin:0 auto 26px;align-items:flex-start}.tutor-message.user{justify-content:flex-end}.tutor-avatar{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border:1px solid #35416a;border-radius:10px;background:#172243;color:#a9adff}.tutor-message-body{max-width:min(88%,740px);min-width:0}.tutor-message.user .tutor-message-body{max-width:min(84%,650px)}.tutor-message-meta{display:flex;align-items:center;gap:8px;margin:0 0 7px 2px;color:#8794b8;font-size:11px}.tutor-bubble{border:1px solid #283452;border-radius:4px 15px 15px 15px;background:#131c34;padding:15px 17px;line-height:1.75;font-size:14px;overflow-wrap:anywhere}.tutor-message.user .tutor-bubble{border:1px solid #5c53df;border-radius:15px 4px 15px 15px;background:linear-gradient(135deg,#4f46d8,#6d43c9);color:white}.tutor-markdown>*:first-child{margin-top:0}.tutor-markdown>*:last-child{margin-bottom:0}.tutor-markdown h1,.tutor-markdown h2,.tutor-markdown h3,.tutor-markdown h4{color:#f1f3ff;line-height:1.35;margin:1.25em 0 .55em}.tutor-markdown h1{font-size:1.45em}.tutor-markdown h2{font-size:1.25em}.tutor-markdown h3{font-size:1.1em}.tutor-markdown p{margin:.65em 0}.tutor-markdown ul,.tutor-markdown ol{padding-left:1.5rem;margin:.65em 0}.tutor-markdown li{margin:.25em 0}.tutor-markdown strong{color:#fff}.tutor-markdown blockquote{margin:.8em 0;padding:.15em 0 .15em 1em;border-left:3px solid #7375e8;color:#b9c4e2}.tutor-markdown a{color:#a9b6ff;text-decoration:underline}.tutor-markdown hr{border:0;border-top:1px solid #34405e;margin:1.1em 0}.tutor-markdown table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:1em 0;font-size:13px}.tutor-markdown th,.tutor-markdown td{border:1px solid #35415e;padding:8px 10px;text-align:left}.tutor-markdown th{background:#202b4a;color:#f3f5ff}.tutor-markdown code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;background:#252f4b;border:1px solid #34405e;border-radius:5px;padding:.12em .35em}.tutor-markdown pre{overflow-x:auto;background:#090e1e;border:1px solid #2c3857;border-radius:10px;padding:13px;margin:1em 0}.tutor-markdown pre code{padding:0;border:0;background:transparent}.tutor-citations{margin-top:13px;padding-top:10px;border-top:1px solid #303c59}.tutor-citations-title{color:#9aa7c8;font-size:11px;font-weight:700;margin-bottom:7px}.tutor-citation{font-size:12px;color:#b4c0ff;margin:4px 0}
.tutor-message-actions{display:flex;gap:3px;margin:6px 0 0 2px}.tutor-thinking{display:flex;align-items:center;gap:10px;color:#a5b0ce;font-size:13px;padding:12px 0}.tutor-dots{display:flex;gap:4px}.tutor-dots span{width:5px;height:5px;border-radius:50%;background:#9a9cff;animation:tutorPulse 1.1s infinite ease-in-out}.tutor-dots span:nth-child(2){animation-delay:.15s}.tutor-dots span:nth-child(3){animation-delay:.3s}@keyframes tutorPulse{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.tutor-composer-wrap{border-top:1px solid #202945;background:#0d132b;padding:15px 22px 12px}.tutor-composer{max-width:850px;margin:0 auto;display:flex;align-items:flex-end;gap:10px;padding:8px;border:1px solid #354163;border-radius:16px;background:#111a33;box-shadow:0 8px 28px #00000016}.tutor-composer:focus-within{border-color:#6867d9;box-shadow:0 0 0 3px #6c63e51c}.tutor-composer textarea{resize:none;flex:1;min-width:0;max-height:180px;min-height:42px;padding:10px 8px;border:0;outline:0;background:transparent;color:#f0f2ff;font:inherit;font-size:14px;line-height:1.5}.tutor-composer textarea::placeholder{color:#7886aa}.tutor-composer-hint{max-width:850px;margin:7px auto 0;text-align:center;color:#657294;font-size:10px}
.tutor-mobile-menu{display:none}.tutor-empty-history{padding:12px 8px;color:#7784a6;font-size:12px;line-height:1.6}.tutor-edit-input{min-width:0;width:100%;background:#0e1630;border:1px solid #535dc2;border-radius:7px;color:white;padding:7px;font:inherit;font-size:12px}
.tutor-attachment{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid #354163;border-radius:9px;background:#111a33;font-size:12px;max-width:260px}.tutor-attachment span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tutor-status{max-width:850px;margin:0 auto 8px;color:#b9c4e2;font-size:12px}
@media(max-width:760px){.tutor-topbar{padding:0 12px;height:56px}.tutor-sidebar{position:absolute;z-index:20;top:56px;bottom:0;left:0;width:min(85vw,300px);box-shadow:16px 0 40px #0007}.tutor-sidebar.closed{display:none}.tutor-mobile-menu{display:inline-flex}.tutor-chat-scroll{padding:20px 12px}.tutor-suggestions{grid-template-columns:1fr}.tutor-suggestion{min-height:60px}.tutor-welcome{margin:5vh auto 0}.tutor-message-body{max-width:calc(100% - 35px)}.tutor-message.user .tutor-message-body{max-width:90%}.tutor-composer-wrap{padding:10px 10px 8px}.tutor-mode-label{display:none}.tutor-brand-name{font-size:14px}.tutor-brand .tutor-muted{display:none}}
`;

export default function Tutor() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const [conversations, setConversations] = useState<TutorConversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('detailed');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadedKeyRef = useRef('');

  const storageKey = `${STORAGE_PREFIX}${courseId || 'no-course'}`;
  const activeConversation = conversations.find((chat) => chat.id === activeId);
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (!courseId) return;
    const key = `${STORAGE_PREFIX}${courseId}`;
    loadedKeyRef.current = '';
    setStorageReady(false);
    let saved: TutorConversation[] = [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        saved = parsed.filter((item: any) =>
          item && typeof item.id === 'string' &&
          Array.isArray(item.messages) && item.courseId === courseId
        );
      }
    } catch (error) {
      console.warn('Could not load saved tutor conversations:', error);
    }
    const initial = saved.length ? saved : [makeConversation(courseId)];
    setConversations(initial);
    setActiveId(initial[0].id);
    setMode(initial[0].mode || 'detailed');
    loadedKeyRef.current = key;
    setStorageReady(true);
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !storageReady || loadedKeyRef.current !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch (error) {
      console.warn('Could not save tutor conversations in this browser:', error);
    }
  }, [conversations, courseId, storageKey, storageReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const updateConversation = useCallback(
    (id: string, updater: (conversation: TutorConversation) => TutorConversation) => {
      setConversations((current) =>
        current.map((conversation) => conversation.id === id ? updater(conversation) : conversation)
      );
    }, []
  );

  const newChat = () => {
    if (!courseId || loading) return;
    const conversation = makeConversation(courseId, mode);
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput('');
    setAttachments([]);
    inputRef.current?.focus();
    if (window.innerWidth <= 760) setSidebarOpen(false);
  };

  const openConversation = (conversation: TutorConversation) => {
    if (loading) return;
    setActiveId(conversation.id);
    setMode(conversation.mode || 'detailed');
    setInput('');
    setAttachments([]);
    if (window.innerWidth <= 760) setSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    if (loading && id === activeId) return;
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    if (!remaining.length) {
      const fresh = makeConversation(courseId, mode);
      setConversations([fresh]);
      setActiveId(fresh.id);
    } else {
      setConversations(remaining);
      if (activeId === id) {
        setActiveId(remaining[0].id);
        setMode(remaining[0].mode || 'detailed');
      }
    }
  };

  const renameConversation = (id: string) => {
    const title = editingTitle.trim();
    if (title) updateConversation(id, (conversation) => ({
      ...conversation, title, updatedAt: Date.now(),
    }));
    setEditingId('');
    setEditingTitle('');
  };

  const addAttachments = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const supported = new Set(['pdf', 'txt', 'docx', 'pptx']);
    const accepted = incoming.filter((file) =>
      supported.has(file.name.split('.').pop()?.toLowerCase() || '')
    );
    const rejected = incoming.filter((file) => !accepted.includes(file));
    if (rejected.length) {
      window.alert(`Unsupported file(s): ${rejected.map((file) => file.name).join(', ')}. Choose PDF, TXT, DOCX, or PPTX.`);
    }
    const tooLarge = accepted.filter((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge.length) {
      window.alert(`Each document must be 20 MB or smaller: ${tooLarge.map((file) => file.name).join(', ')}`);
    }
    const valid = accepted.filter((file) => file.size <= MAX_FILE_SIZE);
    setAttachments((current) => {
      const combined = [...current, ...valid];
      const unique = combined.filter((file, index, all) =>
        all.findIndex((candidate) =>
          candidate.name === file.name && candidate.size === file.size &&
          candidate.lastModified === file.lastModified
        ) === index
      );
      if (unique.length > MAX_FILES) window.alert(`You can attach up to ${MAX_FILES} documents.`);
      return unique.slice(0, MAX_FILES);
    });
  };

  const send = async () => {
    const target = activeConversation;
    const question = input.trim();
    const filesToUpload = [...attachments];
    if (!courseId || loading || !target || (!question && filesToUpload.length === 0)) return;

    setLoading(true);
    setInput('');
    setUploadStatus('');

    let finalQuestion = question;
    let visibleQuestion = question;

    try {
      if (filesToUpload.length) {
        setUploadStatus(`Uploading ${filesToUpload.length} document(s)…`);
        const uploaded: string[] = [];
        for (const file of filesToUpload) {
          await materialsApi.upload(courseId, file);
          uploaded.push(file.name);
        }
        setAttachments((current) => current.filter((file) =>
          !filesToUpload.some((sent) =>
            sent.name === file.name && sent.size === file.size &&
            sent.lastModified === file.lastModified
          )
        ));
        const fileLabel = `📎 Uploaded documents: ${uploaded.join(', ')}`;
        visibleQuestion = question ? `${question}\n\n${fileLabel}` : fileLabel;
        if (!finalQuestion) {
          finalQuestion =
            'Summarize the uploaded study materials. Explain the main concepts, important definitions, key points, and examples. Use headings and bullet points. Summarize each document separately if multiple documents were uploaded.';
        }
      }

      const userMessage: TutorMessage = {
        id: makeId(),
        role: 'user',
        content: visibleQuestion,
        createdAt: Date.now(),
      } as TutorMessage;

      updateConversation(target.id, (conversation) => ({
        ...conversation,
        title: conversation.messages.length === 0
          ? getTitle(question || `Study materials: ${filesToUpload.map((f) => f.name).join(', ')}`)
          : conversation.title,
        mode,
        messages: [...conversation.messages, userMessage],
        updatedAt: Date.now(),
      }));

      setUploadStatus('Thinking…');
      const res = await tutorApi.ask({
        course_id: courseId,
        question: finalQuestion,
        session_id: target.sessionId,
        mode,
      });
      const assistantMessage: TutorMessage = {
        id: makeId(),
        role: 'assistant',
        content: extractAnswerText(res?.answer ?? res),
        citations: extractCitations(res),
        createdAt: Date.now(),
      } as TutorMessage;

      updateConversation(target.id, (conversation) => ({
        ...conversation,
        sessionId: res?.session_id || conversation.sessionId,
        mode,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
    } catch (error: any) {
      console.error('AI Tutor error:', error);
      const detail = error?.response?.data?.detail || error?.message ||
        'Request failed. Check that the backend is running and try again.';
      const assistantMessage: TutorMessage = {
        id: makeId(),
        role: 'assistant',
        content: `**Something went wrong.**\n\n${String(detail)}`,
        createdAt: Date.now(),
      } as TutorMessage;
      updateConversation(target.id, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
    } finally {
      setLoading(false);
      setUploadStatus('');
      inputRef.current?.focus();
    }
  };

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...conversations]
      .filter((conversation) => !query ||
        conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some((message) => String(message.content).toLowerCase().includes(query))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, search]);

  const copyMessage = async (message: TutorMessage) => {
    try {
      await navigator.clipboard.writeText(String(message.content));
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } catch {
      setCopiedId('');
    }
  };

  const handleSuggestion = (question: string) => {
    if (loading) return;
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="tutor-shell">
      <style>{styles}</style>
      <header className="tutor-topbar">
        <div className="tutor-brand">
          <button type="button" className="tutor-button tutor-mobile-menu" aria-label="Toggle chat history" onClick={() => setSidebarOpen((open) => !open)}>
            <Menu size={17} />
          </button>
          <Link to={`/courses/${courseId}`} className="tutor-button" style={{ padding: '8px 10px', textDecoration: 'none' }} aria-label="Back to course">
            <ArrowLeft size={16} /><span className="tutor-mode-label">Back</span>
          </Link>
          <div style={{ width: 1, height: 26, background: '#283452' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className="tutor-avatar"><Brain size={17} /></span>
            <div><div className="tutor-brand-name">AI StudyMate Tutor</div><div className="tutor-muted">Your personal learning assistant</div></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="tutor-muted tutor-mode-label">Answer style</span>
          <select aria-label="Answer style" value={mode} onChange={(event) => {
            const nextMode = event.target.value;
            setMode(nextMode);
            if (activeId) updateConversation(activeId, (conversation) => ({ ...conversation, mode: nextMode, updatedAt: Date.now() }));
          }} disabled={loading} style={{ maxWidth: 130, background: '#121b35', color: '#e6eaff', border: '1px solid #2b3657', borderRadius: 9, padding: '8px 9px', outline: 'none', fontSize: 12 }}>
            <option value="simple">Simple</option><option value="detailed">Detailed</option><option value="summary">Summary</option><option value="examples">Examples</option>
          </select>
        </div>
      </header>

      <div className="tutor-layout">
        <aside className={`tutor-sidebar ${sidebarOpen ? '' : 'closed'}`}>
          <button type="button" className="tutor-button tutor-button-primary" onClick={newChat} disabled={loading}><Plus size={16} /> New chat</button>
          <label className="tutor-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
            {search && <button type="button" className="tutor-icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
          </label>
          <div className="tutor-history-label">Your conversations</div>
          <div className="tutor-history-list">
            {filteredConversations.length === 0 ? <div className="tutor-empty-history">No conversations match your search.</div> :
              filteredConversations.map((conversation) => (
                <div key={conversation.id} className={`tutor-history-row ${conversation.id === activeId ? 'active' : ''}`}>
                  {editingId === conversation.id ? (
                    <form style={{ display: 'flex', gap: 5, flex: 1, minWidth: 0, padding: 4 }} onSubmit={(event) => { event.preventDefault(); renameConversation(conversation.id); }}>
                      <input autoFocus className="tutor-edit-input" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} aria-label="Conversation title" maxLength={80} />
                      <button type="submit" className="tutor-icon-button" aria-label="Save title"><Check size={15} /></button>
                      <button type="button" className="tutor-icon-button" aria-label="Cancel rename" onClick={() => setEditingId('')}><X size={15} /></button>
                    </form>
                  ) : <>
                    <button type="button" className="tutor-history-open" onClick={() => openConversation(conversation)} title={conversation.title}><MessageSquare size={15} /><span>{conversation.title}</span></button>
                    <button type="button" className="tutor-icon-button" title="Rename conversation" aria-label={`Rename ${conversation.title}`} onClick={() => { setEditingId(conversation.id); setEditingTitle(conversation.title); }}><Pencil size={13} /></button>
                    <button type="button" className="tutor-icon-button" title="Delete conversation" aria-label={`Delete ${conversation.title}`} onClick={() => deleteConversation(conversation.id)} disabled={loading && conversation.id === activeId}><Trash2 size={13} /></button>
                  </>}
                </div>
              ))}
          </div>
          <div style={{ marginTop: 'auto', padding: '10px 7px 0', borderTop: '1px solid #202945' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8f9bbc', fontSize: 11 }}><Sparkles size={14} /><span>Study smarter, one question at a time.</span></div>
          </div>
        </aside>

        <main className="tutor-main">
          <div className="tutor-chat-scroll">
            <div className="tutor-chat-inner">
              {messages.length === 0 ? (
                <div className="tutor-welcome">
                  <div className="tutor-welcome-icon"><BookOpen size={27} /></div>
                  <h1>What would you like to learn?</h1>
                  <p>Ask a question about your course or upload your notes. I’ll help you understand concepts with clear explanations and examples.</p>
                  <div className="tutor-suggestions">
                    <button type="button" className="tutor-suggestion" onClick={() => handleSuggestion('Explain the main concept simply')}><strong>Explain a concept</strong><small>Break a topic into simple steps</small></button>
                    <button type="button" className="tutor-suggestion" onClick={() => handleSuggestion('Summarize the key points from my study materials')}><strong>Summarize my notes</strong><small>Get the essential ideas quickly</small></button>
                    <button type="button" className="tutor-suggestion" onClick={() => handleSuggestion('Give me a worked example')}><strong>Show an example</strong><small>Learn by following a solution</small></button>
                  </div>
                </div>
              ) : messages.map((message) => (
                <article key={message.id} className={`tutor-message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                  {message.role !== 'user' && <div className="tutor-avatar"><Brain size={16} /></div>}
                  <div className="tutor-message-body">
                    <div className="tutor-message-meta">{message.role === 'user' ? 'You' : 'AI StudyMate'} <span>·</span> {new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="tutor-bubble">
                      <div className="tutor-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof message.content === 'string' ? message.content : extractAnswerText(message.content)}</ReactMarkdown></div>
                      {message.citations && message.citations.length > 0 && <div className="tutor-citations"><div className="tutor-citations-title">Sources from your study materials</div>{message.citations.map((citation: Citation, index: number) => <div className="tutor-citation" key={`${message.id}-citation-${index}`}>📄 {citation.source || 'Study material'}{citation.page_or_slide ? ` — ${citation.page_or_slide}` : ''}</div>)}</div>}
                    </div>
                    {message.role === 'assistant' && <div className="tutor-message-actions"><button type="button" className="tutor-icon-button" onClick={() => void copyMessage(message)} title="Copy response" aria-label="Copy response">{copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}</button></div>}
                  </div>
                </article>
              ))}
              {loading && <div className="tutor-thinking" role="status" aria-live="polite"><span className="tutor-avatar"><Brain size={16} /></span><span>{uploadStatus || 'Preparing your explanation'}</span><span className="tutor-dots"><span /><span /><span /></span></div>}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="tutor-composer-wrap">
            {attachments.length > 0 && <div style={{ maxWidth: 850, margin: '0 auto 8px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {attachments.map((file, index) => <div className="tutor-attachment" key={`${file.name}-${file.size}-${index}`}><FileText size={15} /><span title={file.name}>{file.name}</span><button type="button" className="tutor-icon-button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}><X size={13} /></button></div>)}
            </div>}
            <form className="tutor-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx,.pptx" multiple hidden onChange={(event) => { addAttachments(event.currentTarget.files); event.currentTarget.value = ''; }} />
              <button type="button" className="tutor-button" title="Attach PDF, TXT, DOCX, or PPTX" aria-label="Attach documents" onClick={() => fileInputRef.current?.click()} disabled={loading} style={{ height: 42, width: 44, padding: 0 }}><Paperclip size={17} /></button>
              <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Message AI StudyMate..." aria-label="Message AI StudyMate" rows={1} disabled={loading} onInput={(event) => { const element = event.currentTarget; element.style.height = 'auto'; element.style.height = `${Math.min(element.scrollHeight, 180)}px`; }} />
              <button type="submit" className="tutor-button tutor-button-primary" aria-label="Send message" disabled={loading || (!input.trim() && attachments.length === 0)} style={{ height: 42, width: 44, padding: 0 }}><Send size={17} /></button>
            </form>
            <div className="tutor-composer-hint">Enter to send · Shift + Enter for a new line · PDF, TXT, DOCX, PPTX supported · Answers may need verification</div>
          </div>
        </main>
      </div>
    </div>
  );
}
