const API_BASE = '/api';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const authAPI = {
  login: (credentials) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => apiFetch('/auth/me')
};

export const adminAPI = {
  getStats: () => apiFetch('/admin/stats'),
  getUsers: () => apiFetch('/admin/users'),
  createUser: (userData) => apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (id, userData) => apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) }),
  deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  getLogs: () => apiFetch('/admin/logs'),

  // Student / Enrollment management
  getStudents: () => apiFetch('/admin/students'),
  getStudentProgress: (studentId) => apiFetch(`/admin/students/${studentId}/progress`),
  getCourseEnrollments: (courseId) => apiFetch(`/admin/courses/${courseId}/enrollments`),
  enrollStudent: (data) => apiFetch('/admin/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  removeEnrollment: (studentId, courseId) => apiFetch(`/admin/enrollments/${studentId}/${courseId}`, { method: 'DELETE' }),
  updateGrade: (studentId, courseId, grade) => apiFetch(`/admin/enrollments/${studentId}/${courseId}`, { method: 'PUT', body: JSON.stringify({ grade }) }),
};

export const contentAPI = {
  getCourses: () => apiFetch('/courses'),
  getCourseDetails: (id) => apiFetch(`/courses/${id}`),
  createCourse: (data) => apiFetch('/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id, data) => apiFetch(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: (id) => apiFetch(`/courses/${id}`, { method: 'DELETE' }),

  createModule: (data) => apiFetch('/modules', { method: 'POST', body: JSON.stringify(data) }),
  updateModule: (id, data) => apiFetch(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteModule: (id) => apiFetch(`/modules/${id}`, { method: 'DELETE' }),

  createLesson: (data) => apiFetch('/lessons', { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (id, data) => apiFetch(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLesson: (id) => apiFetch(`/lessons/${id}`, { method: 'DELETE' }),

  // Coding Questions
  getCodingQuestions: (courseId) => apiFetch(`/courses/${courseId}/coding-questions`),
  createCodingQuestion: (data) => apiFetch('/coding-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateCodingQuestion: (id, data) => apiFetch(`/coding-questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCodingQuestion: (id) => apiFetch(`/coding-questions/${id}`, { method: 'DELETE' }),

  // Quizzes
  getQuizzes: (courseId) => apiFetch(`/courses/${courseId}/quizzes`),
  createQuiz: (data) => apiFetch('/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuiz: (id, data) => apiFetch(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuiz: (id) => apiFetch(`/quizzes/${id}`, { method: 'DELETE' }),

  // Quiz Questions (MCQ)
  createQuizQuestion: (data) => apiFetch('/quiz-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateQuizQuestion: (id, data) => apiFetch(`/quiz-questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuizQuestion: (id) => apiFetch(`/quiz-questions/${id}`, { method: 'DELETE' }),

  // Assignments
  getAssignments: (courseId) => apiFetch(`/courses/${courseId}/assignments`),
  createAssignment: (data) => apiFetch('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id, data) => apiFetch(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: (id) => apiFetch(`/assignments/${id}`, { method: 'DELETE' }),
};

export const studentAPI = {
  getDashboard: () => apiFetch('/student/dashboard'),
  getCourses: () => apiFetch('/student/courses'),
  getCourseView: (id) => apiFetch(`/student/courses/${id}/view`),
  toggleLessonComplete: (lessonId) => apiFetch(`/student/lessons/${lessonId}/complete`, { method: 'POST' }),
  enroll: (courseId) => apiFetch('/student/enroll', { method: 'POST', body: JSON.stringify({ courseId }) }),
  dropCourse: (courseId) => apiFetch(`/student/enroll/${courseId}`, { method: 'DELETE' })
};

export const playgroundAPI = {
  run: (data) => apiFetch('/playground/run', { method: 'POST', body: JSON.stringify(data) }),
  judge: (data) => apiFetch('/playground/judge', { method: 'POST', body: JSON.stringify(data) }),
  getSubmissions: (language) => apiFetch(`/playground/submissions${language ? `?language=${language}` : ''}`),
  getSubmission: (id) => apiFetch(`/playground/submissions/${id}`),
  deleteSubmission: (id) => apiFetch(`/playground/submissions/${id}`, { method: 'DELETE' }),
  clearSubmissions: () => apiFetch('/playground/submissions', { method: 'DELETE' }),
};
