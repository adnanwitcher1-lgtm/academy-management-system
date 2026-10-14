import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import StudentSignup from "./pages/StudentSignup";
import StudentDashboard from "./pages/StudentDashboard";
import Attendance from "./pages/Attendance";
import Timetable from "./pages/Timetable";
import MyTasks from "./pages/MyTasks";
import Inquiries from "./pages/Inquiries";
import FeeManagement from "./pages/FeeManagement";
import Expenses from "./pages/Expenses";
import TeacherSettings from "./pages/TeacherSettings";
import DailyQueries from "./pages/DailyQueries";
import MyFees from "./pages/MyFees";
import TranscriptPage from "./pages/TranscriptPage";
import HodDashboard from "./pages/HodDashboard";
import AddTeacher from "./pages/AddTeacher";
import Students from "./pages/Students";
import TeacherDashboard from "./pages/TeacherDashboard";
import MarksEntry from "./pages/MarksEntry";
import SchoolClasses from "./pages/SchoolClasses";
import ClassesSubjects from "./pages/ClassesSubjects";
import Subjects from "./pages/Subjects";
import Exams from "./pages/Exams";

function Protected({ allow, children }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }
  return children;
}

function homeFor(role) {
  if (role === "student") return "/student";
  if (role === "teacher") return "/teacher";
  return "/hod";
}

function Home() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/signup/student" element={<StudentSignup />} />
          <Route
            path="/hod/students"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Students />
              </Protected>
            }
          />
          <Route
            path="/hod/teachers/new"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <AddTeacher />
              </Protected>
            }
          />
          <Route
            path="/academics/classes"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <ClassesSubjects />
              </Protected>
            }
          />
          <Route
            path="/academics/subjects"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <ClassesSubjects />
              </Protected>
            }
          />
          <Route
            path="/exams"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Exams />
              </Protected>
            }
          />
          <Route
            path="/teacher/marks"
            element={
              <Protected allow={["teacher"]}>
                <MarksEntry />
              </Protected>
            }
          />
          <Route
            path="/fees"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <FeeManagement />
              </Protected>
            }
          />
          <Route
            path="/expenses"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Expenses />
              </Protected>
            }
          />
          <Route
            path="/settings"
            element={
              <Protected allow={["teacher"]}>
                <TeacherSettings />
              </Protected>
            }
          />
          <Route
            path="/daily"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <DailyQueries />
              </Protected>
            }
          />
          <Route
            path="/student/fees"
            element={
              <Protected allow={["student"]}>
                <MyFees />
              </Protected>
            }
          />
          <Route
            path="/inquiries"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Inquiries />
              </Protected>
            }
          />
          <Route
            path="/teacher/tasks"
            element={
              <Protected allow={["teacher"]}>
                <MyTasks />
              </Protected>
            }
          />
          <Route
            path="/fees/structure"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Navigate to="/fees?tab=structure" replace />
              </Protected>
            }
          />
          <Route
            path="/fees/dues"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <Navigate to="/fees?tab=dues" replace />
              </Protected>
            }
          />
          <Route
            path="/timetable"
            element={
              <Protected allow={["hod", "admin", "staff", "teacher", "student"]}>
                <Timetable />
              </Protected>
            }
          />
          <Route
            path="/attendance"
            element={
              <Protected allow={["hod", "admin", "staff", "teacher", "student"]}>
                <Attendance />
              </Protected>
            }
          />
          <Route
            path="/teacher"
            element={
              <Protected allow={["teacher"]}>
                <TeacherDashboard />
              </Protected>
            }
          />
          <Route
            path="/student/results"
            element={
              <Protected allow={["student"]}>
                <TranscriptPage />
              </Protected>
            }
          />
          <Route
            path="/student"
            element={
              <Protected allow={["student"]}>
                <StudentDashboard />
              </Protected>
            }
          />
          <Route
            path="/hod"
            element={
              <Protected allow={["hod", "admin", "staff"]}>
                <HodDashboard />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

