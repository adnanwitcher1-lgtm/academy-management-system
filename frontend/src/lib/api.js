const BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const STORAGE_KEY = "keen.session";

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function request(path, { method = "GET", body, auth = true, retry = true } = {}) {
  const session = loadSession();
  const headers = { "Content-Type": "application/json" };
  if (auth && session?.access) {
    headers.Authorization = `Bearer ${session.access}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && retry && session?.refresh) {
    const refreshed = await refreshAccess(session.refresh);
    if (refreshed) {
      return request(path, { method, body, auth, retry: false });
    }
    clearSession();
    throw new ApiError("Your session expired. Sign in again.", 401);
  }

  const text = await response.text();
  const data = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(readError(data) || `Request failed (${response.status}).`, response.status, data);
  }
  return data;
}

async function refreshAccess(refresh) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const session = loadSession();
    saveSession({ ...session, access: data.access });
    return true;
  } catch {
    return false;
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function readError(data) {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (!firstKey) return null;
  const value = data[firstKey];
  return Array.isArray(value) ? value[0] : String(value);
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login/", { method: "POST", body: { username, password }, auth: false }),

  studentSignup: (payload) =>
    request("/api/auth/students/signup/", { method: "POST", body: payload, auth: false }),

  createTeacher: (payload) =>
    request("/api/auth/teachers/create/", { method: "POST", body: payload }),

  pendingStudents: () => request("/api/auth/students/pending/"),

  approveStudent: (id) =>
    request(`/api/auth/students/pending/${id}/approve/`, { method: "POST" }),

  rejectStudent: (id) =>
    request(`/api/auth/students/pending/${id}/reject/`, { method: "POST" }),

  listTeachers: () => request("/api/auth/teachers/"),

  listStudentRoster: () => request("/api/auth/students/roster/"),

  listSchoolClasses: () => request("/api/academics/classes/"),
  createSchoolClass: (payload) =>
    request("/api/academics/classes/", { method: "POST", body: payload }),
  updateSchoolClass: (id, payload) =>
    request(`/api/academics/classes/${id}/`, { method: "PATCH", body: payload }),
  deleteSchoolClass: (id) =>
    request(`/api/academics/classes/${id}/`, { method: "DELETE" }),

  listSubjects: () => request("/api/academics/subjects/"),
  createSubject: (payload) =>
    request("/api/academics/subjects/", { method: "POST", body: payload }),
  updateSubject: (id, payload) =>
    request(`/api/academics/subjects/${id}/`, { method: "PATCH", body: payload }),
  deleteSubject: (id) =>
    request(`/api/academics/subjects/${id}/`, { method: "DELETE" }),

  listExams: () => request("/api/exams/exams/"),
  createExam: (payload) => request("/api/exams/exams/", { method: "POST", body: payload }),
  updateExam: (id, payload) =>
    request(`/api/exams/exams/${id}/`, { method: "PATCH", body: payload }),
  deleteExam: (id) => request(`/api/exams/exams/${id}/`, { method: "DELETE" }),

  listSubjectStudents: (id) => request(`/api/academics/subjects/${id}/students/`),
  listMarks: () => request("/api/exams/marks/"),
  createMark: (payload) => request("/api/exams/marks/", { method: "POST", body: payload }),
  getExamResults: (examId) => request("/api/exams/exams/" + examId + "/results/"),
  updateMark: (id, payload) =>
    request(`/api/exams/marks/${id}/`, { method: "PATCH", body: payload }),

  listFees: () => request("/api/fees/payments/"),
  listFeeStudents: () => request("/api/fees/payments/students/"),
  createFee: (payload) => request("/api/fees/payments/", { method: "POST", body: payload }),
  deleteFee: (id) => request(`/api/fees/payments/${id}/`, { method: "DELETE" }),
  updateFee: (id, payload) =>
    request(`/api/fees/payments/${id}/`, { method: "PATCH", body: payload }),
  generateChallans: (payload) =>
    request("/api/fees/payments/generate/", { method: "POST", body: payload }),

  listInquiries: () => request("/api/inquiries/leads/"),
  createInquiry: (payload) => request("/api/inquiries/leads/", { method: "POST", body: payload }),
  updateInquiry: (id, payload) =>
    request(`/api/inquiries/leads/${id}/`, { method: "PATCH", body: payload }),
  deleteInquiry: (id) => request(`/api/inquiries/leads/${id}/`, { method: "DELETE" }),

  listTeacherProfiles: () => request("/api/auth/teachers/profiles/"),

  listTeacherTasks: (profileId) =>
    request(profileId ? `/api/auth/teachers/tasks/?teacher=${profileId}` : "/api/auth/teachers/tasks/"),
  createTeacherTask: (payload) =>
    request("/api/auth/teachers/tasks/", { method: "POST", body: payload }),
  updateTeacherTask: (id, payload) =>
    request(`/api/auth/teachers/tasks/${id}/`, { method: "PATCH", body: payload }),
  deleteTeacherTask: (id) => request(`/api/auth/teachers/tasks/${id}/`, { method: "DELETE" }),
  getTeacherLectures: (profileId) => request(`/api/auth/teachers/profiles/${profileId}/lectures/`),
  setTeacherLectures: (profileId, subjectIds) =>
    request(`/api/auth/teachers/profiles/${profileId}/lectures/`, {
      method: "POST",
      body: { subject_ids: subjectIds },
    }),

  listLectureOptions: () => request("/api/auth/teachers/lecture-options/"),

  updateTeacherProfile: (id, payload) =>
    request(`/api/auth/teachers/profiles/${id}/`, { method: "PATCH", body: payload }),
  deleteTeacher: (id) => request(`/api/auth/teachers/profiles/${id}/`, { method: "DELETE" }),

  listStudentManage: () => request("/api/auth/students/manage/"),
  enrollStudent: (payload) =>
    request("/api/auth/students/roster/enroll/", { method: "POST", body: payload }),
  updateStudentRoster: (id, payload) =>
    request(`/api/auth/students/manage/${id}/`, { method: "PATCH", body: payload }),
  deleteStudentRoster: (id) =>
    request(`/api/auth/students/manage/${id}/`, { method: "DELETE" }),

  listFeeStructureOverview: () => request("/api/fees/structures/overview/"),
  createFeeStructure: (payload) =>
    request("/api/fees/structures/", { method: "POST", body: payload }),
  updateFeeStructure: (id, payload) =>
    request(`/api/fees/structures/${id}/`, { method: "PATCH", body: payload }),
  deleteFeeStructure: (id) => request(`/api/fees/structures/${id}/`, { method: "DELETE" }),
  listDues: () => request("/api/fees/payments/dues/"),

  listTimetable: (classId) =>
    request(classId ? `/api/timetable/slots/?school_class=${classId}` : "/api/timetable/slots/"),
  listTimetableOptions: () => request("/api/timetable/slots/options/"),
  createTimetableSlot: (payload) =>
    request("/api/timetable/slots/", { method: "POST", body: payload }),
  updateTimetableSlot: (id, payload) =>
    request(`/api/timetable/slots/${id}/`, { method: "PATCH", body: payload }),
  deleteTimetableSlot: (id) => request(`/api/timetable/slots/${id}/`, { method: "DELETE" }),
  dashboardSummary: () => request("/api/dashboard/summary/"),
  getMyProfile: () => request("/api/profiles/me/"),
  updateMyProfile: (body) => request("/api/profiles/me/", { method: "PATCH", body }),
  changeMyPassword: (body) => request("/api/profiles/password/", { method: "POST", body }),
  listAnnouncements: () => request("/api/notifications/announcements/"),
  createAnnouncement: (body) => request("/api/notifications/announcements/", { method: "POST", body }),
  deleteAnnouncement: (id) => request(`/api/notifications/announcements/${id}/`, { method: "DELETE" }),
  dailyFeed: (days = 1) => request(`/api/notifications/daily/?days=${days}`),

  attendanceClasses: () => request("/api/attendance/classes/"),
  attendanceSheet: (classId, day) =>
    request(`/api/attendance/sheet/?school_class=${classId}&date=${day}`),
  saveAttendance: (payload) =>
    request("/api/attendance/sheet/", { method: "POST", body: payload }),
  searchAttendanceStudents: (q) =>
    request(`/api/attendance/search/?q=${encodeURIComponent(q)}`),
  attendanceHistory: (userId, from, to) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const s = qs.toString();
    return request(`/api/attendance/student/${userId}/${s ? "?" + s : ""}`);
  },
  attendanceToday: () => request("/api/attendance/summary/"),

  attendanceTrend: (days) => request(`/api/attendance/trend/?days=${days}`),

  teacherAttendanceSheet: (day) => request(`/api/attendance/teachers/sheet/?date=${day}`),
  saveTeacherAttendance: (payload) =>
    request("/api/attendance/teachers/sheet/", { method: "POST", body: payload }),
  teacherAttendanceHistory: (params) =>
    request("/api/attendance/teachers/history/?" + new URLSearchParams(params).toString()),
  listExpenses: () => request("/api/expenses/"),
  createExpense: (body) => request("/api/expenses/", { method: "POST", body }),
  updateExpense: (id, body) => request(`/api/expenses/${id}/`, { method: "PATCH", body }),
  deleteExpense: (id) => request(`/api/expenses/${id}/`, { method: "DELETE" }),
};



