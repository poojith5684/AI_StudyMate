import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

import Dashboard from './pages/Dashboard';
import MyCourses from './pages/MyCourses';
import Completed from './pages/Completed';

import CourseDetail from './pages/CourseDetail';
import Tutor from './pages/Tutor';
import Quiz from './pages/Quiz';
import ProgressPage from './pages/Progress';

import Resources from './pages/Resources';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ================= LANDING ================= */}

        <Route
          path="/"
          element={<Landing />}
        />

        {/* ================= AUTHENTICATION ================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* ================= MAIN HOME ================= */}

        <Route
          path="/dashboard"
          element={<RequireAuth><Dashboard /></RequireAuth>}
        />

        {/* ================= USER COURSES ================= */}

        <Route
          path="/my-courses"
          element={<RequireAuth><MyCourses /></RequireAuth>}
        />

        {/* ================= COMPLETED COURSES ================= */}

        <Route
          path="/completed"
          element={<RequireAuth><Completed /></RequireAuth>}
        />

        {/* ================= COURSE DETAIL ================= */}

        <Route
          path="/courses/:courseId"
          element={<RequireAuth><CourseDetail /></RequireAuth>}
        />

        {/* ================= ONLINE NOTES & RESOURCES ================= */}

        <Route
          path="/courses/:courseId/resources"
          element={<RequireAuth><Resources /></RequireAuth>}
        />

        {/* ================= AI TUTOR ================= */}

        <Route
          path="/courses/:courseId/tutor"
          element={<RequireAuth><Tutor /></RequireAuth>}
        />

        {/* ================= ADAPTIVE QUIZ ================= */}

        <Route
          path="/courses/:courseId/quiz"
          element={<RequireAuth><Quiz /></RequireAuth>}
        />

        {/* ================= PROGRESS ================= */}

        <Route
          path="/courses/:courseId/progress"
          element={<RequireAuth><ProgressPage /></RequireAuth>}
        />

      </Routes>

    </BrowserRouter>
  );
}
