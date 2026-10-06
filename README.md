# AI StudyMate

**Multimodal AI Hackathon 2026 — Track D: Personalized Tutoring & Adaptive Learning**

A complete web application that turns lecture PDFs, PowerPoints and transcripts into a source-cited knowledge base. Students get grounded AI tutoring, adaptive quizzes, and personalized recommendations.

## Features Implemented

- Landing page
- Auth (Login / Register) - dev mode
- Dashboard + Course CRUD
- Material upload (PDF / PPTX / TXT)
- PDF & PPT extraction with page/slide metadata
- Chunking + embeddings + vector store
- RAG pipeline with citations
- AI Tutor chat UI
- Quiz generation + scoring
- Topic performance analysis
- Adaptive difficulty logic
- Progress page + recommendations
- Responsive modern UI

## Tech Stack

- Frontend: React 19 + Vite + TypeScript
- Backend: Python + FastAPI + Pydantic
- Auth / DB: Supabase-ready (dev mode works without it)
- AI: OpenAI-compatible API
- Vector: In-memory cosine search (easy to swap for pgvector)

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add AI_API_KEY=sk-... to .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo Flow

1. Landing → Get Started
2. Register / Login
3. Create course "Engineering Physics"
4. Upload PDF + PPTX
5. Wait for Ready status
6. AI Tutor → "Explain PN junction simply"
7. See answer + citations
8. Generate Quiz → Answer → Submit
9. See weak topics + recommendations
10. Progress page

## Adaptive Rules

- Accuracy >= 80% → Hard
- 50-79% → Medium
- < 50% → Easy + revision recommendation

Built for Multimodal AI Hackathon 2026 — Track D
