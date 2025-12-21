// frontendjsapi.js - Frontend API Helper
// Place this file in your frontend folder and include it in HTML: <script src="frontendjsapi.js"></script>

const API_URL = 'http://localhost:5000/api';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (requiresAuth) {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (data && method !== 'GET') config.body = JSON.stringify(data);

 try {
  const response = await fetch(`${API_URL}${endpoint}`, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Something went wrong');
  }

  return result;
} catch (error) {
  console.error('API Error:', error);
  throw error;
}

}


// ================== ATTENDANCE ==================

// Mark attendance
async function markAttendance(attendanceData) {
  return await apiCall('/attendance', 'POST', attendanceData, true);
}

// Get attendance for a student
async function getAttendance(studentId) {
  return await apiCall(`/attendance/${studentId}`, 'GET', null, true);
}

// Analyze attendance using AI
// Analyze attendance using AI
async function analyzeAttendanceSmart() {
  return await apiCall('/attendance/analyze', 'POST', {}, true);
}

async function showSmartAnalysis() {
  try {
    const res = await analyzeAttendanceSmart();
    document.getElementById('analysis').innerHTML =
      `<pre>${res.analysis}</pre>`;
  } catch (error) {
    document.getElementById('analysis').innerText =
      'Failed to analyze attendance.';
  }
}
// ================== AI FEATURES ==================

// Generate lesson plan
async function generateLessonPlan(lessonData) {
  return await apiCall('/ai/lesson-plan', 'POST', lessonData, true);
}

// Grade assignment (essay/short answer)
async function gradeAssignment(gradingData) {
  return await apiCall('/ai/grade', 'POST', gradingData, true);
}

// Generate parent communication message
async function generateParentMessage(messageData) {
  return await apiCall('/ai/parent-message', 'POST', messageData, true);
}

// ================== AUTHENTICATION ==================

// School registration
async function registerSchool(schoolData) {
  return await apiCall('/auth/register/school', 'POST', schoolData);
}

// Admin login
async function loginAdmin(schoolId, password) {
  const result = await apiCall('/auth/login/admin', 'POST', {
    School_Id: schoolId,
    School_password: password
  });
  if (result.token) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('userType', 'admin');
    localStorage.setItem('schoolId', result.schoolId);
  }
  return result;
}

// Teacher login
async function loginTeacher(teacherId, password) {
  const result = await apiCall('/auth/login/teacher', 'POST', {
    Teacher_ID: teacherId,
    Teacher_Password: password
  });
  if (result.token) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('teacherId', result.teacherId);
    localStorage.setItem('teacherName', result.name);
  }
  return result;
}

// Logout
function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// Check if logged in
function isLoggedIn() {
  return !!localStorage.getItem('token');
}

// ================== TEACHERS ==================

async function createTeacher(teacherData) {
  return await apiCall('/teachers', 'POST', teacherData, true);
}

async function getTeachers() {
  return await apiCall('/teachers', 'GET', null, true);
}

// ================== STUDENTS ==================

async function createStudent(studentData) {
  return await apiCall('/students', 'POST', studentData, true);
}

async function getStudents() {
  return await apiCall('/students', 'GET', null, true);
}

// ================== CLASSES ==================

async function createClass(classData) {
  return await apiCall('/classes', 'POST', classData, true);
}

async function getClasses() {
  return await apiCall('/classes', 'GET', null, true);
}
