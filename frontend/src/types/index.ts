export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Course {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  subject?: string;
  material_count: number;
  created_at: string;
  updated_at?: string;
}

export type MaterialStatus = 'uploading' | 'processing' | 'indexing' | 'ready' | 'error';

export interface Material {
  id: string;
  course_id: string;
  filename: string;
  file_type: string;
  status: MaterialStatus;
  page_count?: number;
  chunk_count?: number;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface Citation {
  source: string;
  page_or_slide?: string;
  chunk_text?: string;
}

export interface TutorResponse {
  answer: string;
  citations: Citation[];
  session_id: string;
  message_id: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  topic?: string;
  difficulty: Difficulty;
  source?: string;
}

export interface QuizGenerateResponse {
  quiz_id: string;
  questions: QuizQuestion[];
  topic?: string;
  difficulty: Difficulty;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface QuizResult {
  quiz_id: string;
  score: number;
  total: number;
  accuracy: number;
  topic_breakdown: TopicScore[];
  results: any[];
  weak_topics: string[];
  strong_topics: string[];
}

export interface TopicProgress {
  topic: string;
  accuracy: number;
  questions_attempted: number;
  last_attempted?: string;
  difficulty_level: Difficulty;
}

export interface Progress {
  course_id: string;
  overall_accuracy: number;
  questions_attempted: number;
  quiz_count: number;
  topics: TopicProgress[];
  strong_topics: string[];
  weak_topics: string[];
  recommendations: string[];
}
