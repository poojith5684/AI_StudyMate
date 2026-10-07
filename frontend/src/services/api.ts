import { supabase, syncStoredSession } from './supabase';

// ============================================================
// API BASE URL
// ============================================================

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://ai-studymate-1-83ju.onrender.com'
).replace(/\/+$/, '');

// ============================================================
// GET AUTH TOKEN
// ============================================================

async function getToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    const session = error ? null : data.session;

    syncStoredSession(session);

    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// GENERIC API REQUEST
// ============================================================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // ----------------------------------------------------------
  // Authorization
  // ----------------------------------------------------------

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // ----------------------------------------------------------
  // Content-Type
  // ----------------------------------------------------------

  // Don't set JSON Content-Type for FormData uploads.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // ----------------------------------------------------------
  // Full URL
  // ----------------------------------------------------------

  const url = `${API_BASE}${path}`;

  console.log(
    'API Request:',
    options.method || 'GET',
    url
  );

  // ----------------------------------------------------------
  // FETCH
  // ----------------------------------------------------------

  let res: Response;

  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error('Network error:', error);

    throw new Error(
      `Cannot connect to AI StudyMate backend at ${API_BASE}.`
    );
  }

  // ----------------------------------------------------------
  // RESPONSE
  // ----------------------------------------------------------

  const contentType =
    res.headers.get('content-type') || '';

  let data: any;

  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => '');
  }

  // ----------------------------------------------------------
  // ERROR HANDLING
  // ----------------------------------------------------------

  if (!res.ok) {
    console.error('API Error:', {
      status: res.status,
      path,
      data,
    });

    const message =
      typeof data === 'object' && data?.detail
        ? data.detail
        : `Request failed (${res.status})`;

    throw new Error(message);
  }

  return data as T;
}

// ============================================================
// AUTH API
// ============================================================

export const authApi = {
  getMe: () =>
    request<any>('/api/auth/me'),

  status: () =>
    request<any>('/api/auth/status'),
};

// ============================================================
// COURSES API
// ============================================================

export const coursesApi = {
  list: () =>
    request<any[]>('/api/courses'),

  get: (id: string) =>
    request<any>(`/api/courses/${id}`),

  create: (data: {
    title: string;
    description?: string;
    subject?: string;
  }) =>
    request<any>(
      '/api/courses',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  delete: (id: string) =>
    request<any>(
      `/api/courses/${id}`,
      {
        method: 'DELETE',
      }
    ),
};

// ============================================================
// MATERIALS API
// ============================================================

export const materialsApi = {
  list: (courseId: string) =>
    request<any[]>(
      `/api/materials/course/${courseId}`
    ),

  upload: (
    courseId: string,
    file: File
  ) => {
    const form = new FormData();

    form.append(
      'course_id',
      courseId
    );

    form.append(
      'file',
      file
    );

    return request<any>(
      '/api/materials/upload',
      {
        method: 'POST',
        body: form,
      }
    );
  },

  status: (id: string) =>
    request<any>(
      `/api/materials/${id}/status`
    ),
};

// ============================================================
// AI TUTOR API
// ============================================================

export const tutorApi = {
  ask: (data: {
    course_id: string;
    question: string;
    session_id?: string;
    mode?: string;
  }) =>
    request<any>(
      '/api/tutor/ask',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  history: (sessionId: string) =>
    request<any>(
      `/api/tutor/history/${sessionId}`
    ),
};

// ============================================================
// QUIZ API
// ============================================================

export const quizApi = {
  generate: (data: {
    course_id: string;
    topic?: string;
    difficulty?: string;
    question_count?: number;
  }) =>
    request<any>(
      '/api/quiz/generate',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  submit: (data: {
    quiz_id: string;
    course_id: string;
    answers: Record<string, number>;
  }) =>
    request<any>(
      '/api/quiz/submit',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
};

// ============================================================
// PROGRESS API
// ============================================================

export const progressApi = {
  get: (courseId: string) =>
    request<any>(
      `/api/progress/${courseId}`
    ),

  recommendations: (courseId: string) =>
    request<any>(
      `/api/progress/${courseId}/recommendations`
    ),
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  authApi,
  coursesApi,
  materialsApi,
  tutorApi,
  quizApi,
  progressApi,
};