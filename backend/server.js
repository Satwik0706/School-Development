// server.js - FULLY FIXED VERSION
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== AI HELPER ====================
// ==================== GOOGLE GEMINI AI HELPER ====================
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callGeminiAI(prompt, systemInstruction = "") {
  try {
    const model = genAI.getGenerativeModel({ 
      // CHANGE: Use "gemini-2.5-flash" (current stable) 
      // or "gemini-2.0-flash" if your key is strictly 2.0
      model: "gemini-2.5-flash", 
      systemInstruction: systemInstruction 
    });

    // Optional: Add generationConfig if the output needs to be strictly JSON
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // If 404 persists, the key might be restricted to a specific version.
    // Try "gemini-1.5-flash-latest" as a fallback.
    console.error("Gemini AI Error:", error);
    throw error;
  }
}
// ==================== DB CONNECTION ====================
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_management')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = (roles = []) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== SCHEMAS ====================
const schoolSchema = new mongoose.Schema({
  schoolName: String,
  schoolId: { type: String, unique: true },
  adminUsername: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const teacherSchema = new mongoose.Schema({
  schoolId: String,
  teacherId: { type: String, unique: true },
  name: String,
  password: String,
  subject: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

const studentSchema = new mongoose.Schema({
  schoolId: String,
  studentId: { type: String, unique: true },
  rollNo: String,
  name: String,
  class: String,
  parentPhone: String,
  password: String,
  attendance: { type: Number, default: 0 },
  marks: [{
    subject: String,
    examType: String,
    marks: Number,
    maxMarks: Number,
    uploadedAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

const classSchema = new mongoose.Schema({
  schoolId: String,
  className: String,
  classTeacher: String,
  subjects: [String],
  students: [String],
  createdAt: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  schoolId: String,
  studentId: String,
  class: String,
  date: Date,
  status: { type: String, enum: ['Present', 'Absent', 'Late', 'Excused'] },
  markedBy: String,
  createdAt: { type: Date, default: Date.now }
});

const timetableSchema = new mongoose.Schema({
  schoolId: String,
  class: String,
  schedule: [{
    day: String,
    periods: [{
      subject: String,
      teacher: String,
      teacherId: String,
      startTime: String,
      endTime: String
    }]
  }],
  createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  schoolId: String,
  target: String,
  priority: String,
  message: String,
  sentBy: String,
  sentAt: { type: Date, default: Date.now }
});

const homeworkSchema = new mongoose.Schema({
  schoolId: String,
  teacherId: String,
  teacherName: String,
  title: String,
  description: String,
  subject: String,
  class: String,
  dueDate: Date,
  attachmentType: { type: String, enum: ['link', 'pdf', 'none'], default: 'none' },
  attachmentUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  schoolId: String,
  from: String,
  to: String,
  subject: String,
  message: String,
  read: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now }
});// Ensure your busSchema looks like this
const busSchema = new mongoose.Schema({
  schoolId: String,
  busNumber: { type: String, required: true },
  driverName: String, // Add this if missing
  route: String,      // Add this if missing
  status: { 
    type: String, 
    enum: ['on-time', 'delayed', 'cancelled'], 
    default: 'on-time' 
  },
  location: { 
    lat: { type: Number, default: 20.5937 }, 
    lng: { type: Number, default: 78.9629 } 
  },
  updatedAt: { type: Date, default: Date.now }
});
// FIXED: Added marks schema
const marksSchema = new mongoose.Schema({
  schoolId: String,
  marksId: { type: String, unique: true },
  class: String,
  subject: String,
  examType: String,
  maxMarks: Number,
  teacherId: String,
  marksData: [{
    studentId: String,
    marks: Number
  }],
  uploadedAt: { type: Date, default: Date.now }
});

// ==================== MODELS ====================
const School = mongoose.model('School', schoolSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Student = mongoose.model('Student', studentSchema);
const Class = mongoose.model('Class', classSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Timetable = mongoose.model('Timetable', timetableSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Homework = mongoose.model('Homework', homeworkSchema);
const Message = mongoose.model('Message', messageSchema);
const Bus = mongoose.model('Bus', busSchema);
const Marks = mongoose.model('Marks', marksSchema);

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register/school', async (req, res) => {
  try {
    const { schoolName, schoolId, adminUsername, schoolPwd } = req.body;
    
    const existing = await School.findOne({ schoolId });
    if (existing) return res.status(400).json({ error: 'School ID already exists' });

    const hashedPassword = await bcrypt.hash(schoolPwd, 10);
    
    const school = await School.create({
      schoolName,
      schoolId,
      adminUsername,
      password: hashedPassword
    });

    res.json({ message: 'School registered successfully', schoolId: school.schoolId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/auth/login/admin', async (req, res) => {
  try {
    const school = await School.findOne({ schoolId: req.body.School_Id });
    if (!school) return res.status(404).json({ error: 'School not found' });

    const ok = await bcrypt.compare(req.body.School_password, school.password);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });

    const token = jwt.sign(
      { schoolId: school.schoolId, role: 'admin' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      schoolId: school.schoolId,
      schoolName: school.schoolName 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teacher Login
app.post('/api/auth/login/teacher', async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ teacherId: req.body.Teacher_ID });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const ok = await bcrypt.compare(req.body.Teacher_Password, teacher.password);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });

    const token = jwt.sign({ teacherId: teacher.teacherId, schoolId: teacher.schoolId, role: 'teacher' }, process.env.JWT_SECRET || 'your-secret-key');

    res.json({ 
      token, 
      userType: 'teacher', // Added this
      teacherId: teacher.teacherId, 
      name: teacher.name 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Student Login
app.post('/api/auth/login/student', async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.body.Student_id, parentPhone: req.body.Phone_number });
    if (!student) return res.status(404).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ studentId: student.studentId, schoolId: student.schoolId, role: 'student' }, process.env.JWT_SECRET || 'your-secret-key');

    res.json({ 
      token, 
      userType: 'student', // Added this
      studentId: student.studentId,
      name: student.name 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== ADMIN ROUTES ====================

// Create Teacher
app.post('/api/teachers', authMiddleware(['admin']), async (req, res) => {
  try {
    const teacherId = `T${Date.now()}`;
    const password = await bcrypt.hash(req.body.password, 10);

    const teacher = await Teacher.create({
      schoolId: req.user.schoolId,
      teacherId,
      name: req.body.name,
      subject: req.body.subject,
      phone: req.body.phone,
      password
    });

    res.json({ teacherId, message: 'Teacher created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Teachers
app.get('/api/teachers', authMiddleware(), async (req, res) => {
  try {
    const teachers = await Teacher.find({ schoolId: req.user.schoolId })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Student
app.post('/api/students', authMiddleware(['admin']), async (req, res) => {
  try {
    const studentId = `S${Date.now()}`;
    const password = await bcrypt.hash(req.body.parentPhone, 10);

    const student = await Student.create({
      schoolId: req.user.schoolId,
      studentId,
      rollNo: req.body.rollNo,
      name: req.body.name,
      class: req.body.class,
      parentPhone: req.body.parentPhone,
      password
    });

    // Add student to class
    await Class.findOneAndUpdate(
      { schoolId: req.user.schoolId, className: req.body.class },
      { $addToSet: { students: studentId } }
    );

    res.json({ studentId, message: 'Student created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk Upload Students (Excel)
app.post('/api/bulk-upload', authMiddleware(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let successCount = 0;
    let errors = [];

    for (const row of data) {
      try {
        const studentId = `S${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
        const password = await bcrypt.hash(row.parentPhone || '123456', 10);

        await Student.create({
          schoolId: req.user.schoolId,
          studentId,
          rollNo: row.rollNo,
          name: row.name,
          class: row.class,
          parentPhone: row.parentPhone,
          password
        });

        // Add to class
        await Class.findOneAndUpdate(
          { schoolId: req.user.schoolId, className: row.class },
          { $addToSet: { students: studentId } }
        );

        successCount++;
      } catch (error) {
        errors.push(`${row.name}: ${error.message}`);
      }
    }

    res.json({ 
      message: `Successfully uploaded ${successCount} students`,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Students
app.get('/api/students', authMiddleware(), async (req, res) => {
  try {
    const students = await Student.find({ schoolId: req.user.schoolId })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Class
app.post('/api/classes', authMiddleware(['admin']), async (req, res) => {
  try {
    const classObj = await Class.create({
      schoolId: req.user.schoolId,
      className: req.body.className,
      classTeacher: req.body.classTeacher || '',
      subjects: req.body.subjects || [],
      students: []
    });

    res.json({ message: 'Class created successfully', class: classObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Classes
app.get('/api/classes', authMiddleware(), async (req, res) => {
  try {
    const classes = await Class.find({ schoolId: req.user.schoolId })
      .sort({ className: 1 });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Notification
app.post('/api/notifications', authMiddleware(['admin']), async (req, res) => {
  try {
    const notification = await Notification.create({
      schoolId: req.user.schoolId,
      target: req.body.target,
      priority: req.body.priority,
      message: req.body.message,
      sentBy: 'Admin'
    });

    res.json({ message: 'Notification sent successfully', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ==================== UPDATED BUS SYSTEM ====================
// --- ADD THIS HERE ---
// Get all buses for the school (to fill the Admin dropdown)
app.get('/api/bus/all', authMiddleware(['admin']), async (req, res) => {
  try {
    const buses = await Bus.find({ schoolId: req.user.schoolId });
    res.json(buses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ---------------------

// Your existing app.post('/api/bus', ...) follows below...
// 1. ADMIN: Create or Update Bus Details (Status, Driver, Route)
app.post('/api/bus', authMiddleware(['admin']), async (req, res) => {
  try {
    const { busNumber, driverName, route, status } = req.body;
    
    // This "upsert" logic creates the bus if it's new, or updates it if it exists
    const bus = await Bus.findOneAndUpdate(
      { schoolId: req.user.schoolId, busNumber: busNumber },
      { 
        $set: { 
          driverName, 
          route, 
          status, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Bus information synced successfully', bus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// This route saves the manually edited coordinates from the Admin Dashboard
app.post('/api/bus/update-location', authMiddleware(['admin']), async (req, res) => {
  try {
    const { busNumber, lat, lng, status } = req.body;

    // Validation: Ensure we are receiving numbers
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Invalid coordinates received' });
    }

    const updatedBus = await Bus.findOneAndUpdate(
      { 
        schoolId: req.user.schoolId, 
        busNumber: busNumber 
      },
      { 
        $set: { 
          "location.lat": lat, 
          "location.lng": lng, 
          status: status || 'on-time',
          updatedAt: new Date() 
        } 
      },
      { upsert: true, new: true } // Creates the bus if it doesn't exist
    );

    res.json({ 
      success: true, 
      message: 'Location synchronized with database',
      data: updatedBus 
    });
  } catch (error) {
    console.error('Bus update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. STUDENT: Fetch "Everything" (Status + GPS)
app.get('/api/bus/location/:busNumber', authMiddleware(), async (req, res) => {
  try {
    const bus = await Bus.findOne({ 
      schoolId: req.user.schoolId, 
      busNumber: req.params.busNumber 
    });
    
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    
    // This sends all data (Status, Location, Driver Name) to the Student
    res.json(bus); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Analytics
app.get('/api/analytics/dashboard', authMiddleware(['admin']), async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const students = await Student.find({ schoolId });

    res.json({
      totalStudents: students.length,
      totalTeachers: await Teacher.countDocuments({ schoolId }),
      totalClasses: await Class.countDocuments({ schoolId }),
      avgAttendance: students.length === 0 ? 0 : 
        Math.round(students.reduce((s, a) => s + (a.attendance || 0), 0) / students.length)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEACHER ROUTES ====================

// Get Teacher Notifications
app.get('/api/teacher/notifications', authMiddleware(['teacher']), async (req, res) => {
  try {
    const notifications = await Notification.find({
      schoolId: req.user.schoolId,
      target: { $in: ['teachers', 'all'] }
    }).sort({ sentAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Student Notifications
app.get('/api/student/notifications', authMiddleware(['student']), async (req, res) => {
  try {
    const notifications = await Notification.find({
      schoolId: req.user.schoolId,
      target: { $in: ['students', 'all'] }
    }).sort({ sentAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Attendance
app.post('/api/attendance', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { date, class: className, attendanceRecords } = req.body;
    
    const marked = [];
    
    for (const record of attendanceRecords) {
      const att = await Attendance.create({
        schoolId: req.user.schoolId,
        studentId: record.studentId,
        class: className,
        date: new Date(date),
        status: record.status,
        markedBy: req.user.teacherId
      });
      marked.push(att);
      
      // Update student attendance percentage
      const totalRecords = await Attendance.countDocuments({ 
        studentId: record.studentId 
      });
      const presentCount = await Attendance.countDocuments({ 
        studentId: record.studentId,
        status: 'Present'
      });
      
      const percentage = Math.round((presentCount / totalRecords) * 100);
      await Student.findOneAndUpdate(
        { studentId: record.studentId },
        { attendance: percentage }
      );
    }

    res.json({ message: 'Attendance marked successfully', count: marked.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Attendance by Date and Class
app.get('/api/attendance/:class/:date', authMiddleware(['teacher']), async (req, res) => {
  try {
    const attendance = await Attendance.find({
      schoolId: req.user.schoolId,
      class: req.params.class,
      date: new Date(req.params.date)
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Students by Class
app.get('/api/students/class/:className', authMiddleware(['teacher']), async (req, res) => {
  try {
    const students = await Student.find({
      schoolId: req.user.schoolId,
      class: req.params.className
    }).select('-password').sort({ rollNo: 1 });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FIXED: Upload Marks - properly stores in database and updates student records
app.post('/api/marks', authMiddleware(['teacher']), async (req, res) => {
  try {
    const { class: className, subject, examType, maxMarks, marksData } = req.body;
    
    const marksId = `M${Date.now()}`;
    
    // Store the marks record
    const marksRecord = await Marks.create({
      schoolId: req.user.schoolId,
      marksId,
      class: className,
      subject,
      examType,
      maxMarks,
      marksData,
      teacherId: req.user.teacherId
    });
    
    // Update each student's marks array
    for (const mark of marksData) {
      await Student.findOneAndUpdate(
        { studentId: mark.studentId },
        {
          $push: {
            marks: {
              subject,
              examType,
              marks: mark.marks,
              maxMarks,
              uploadedAt: new Date()
            }
          }
        }
      );
    }
    
    res.json({ success: true, message: 'Marks uploaded successfully', marksRecord });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Marks by Class and Subject
app.get('/api/marks/:class/:subject', authMiddleware(['teacher']), async (req, res) => {
  try {
    const marks = await Marks.find({
      schoolId: req.user.schoolId,
      class: req.params.class,
      subject: req.params.subject
    }).sort({ uploadedAt: -1 });

    res.json(marks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parent-Teacher Communication
app.post('/api/messages', authMiddleware(['teacher']), async (req, res) => {
  try {
    const message = await Message.create({
      schoolId: req.user.schoolId,
      from: req.user.teacherId,
      to: req.body.to,
      subject: req.body.subject,
      message: req.body.message
    });

    res.json({ message: 'Message sent successfully', data: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages', authMiddleware(['teacher']), async (req, res) => {
  try {
    const messages = await Message.find({
      schoolId: req.user.schoolId,
      from: req.user.teacherId
    }).sort({ sentAt: -1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Timetable with Gemini AI
app.post('/api/timetable/generate', authMiddleware(['teacher', 'admin']), async (req, res) => {
  try {
    const { class: className, subjects, timing } = req.body;

    const systemPrompt = `You are a school timetable generator. Create balanced schedules avoiding teacher conflicts. Always return data in strict JSON format.`;
    
    const prompt = `Generate a weekly timetable for class ${className}.

Subjects: ${subjects.map(s => `${s.name} (Teacher: ${s.teacher})`).join(', ')}

Timing:
- School starts: ${timing.startTime}
- School ends: ${timing.endTime}
- Each period: ${timing.periodDuration} minutes
- Break time: ${timing.breakTime}

Return ONLY a JSON object with this structure:
{
  "schedule": [
    {
      "day": "Monday",
      "periods": [
        {"subject": "Math", "teacher": "Mr. X", "teacherId": "T123", "startTime": "08:00", "endTime": "08:45"}
      ]
    }
  ]
}`;

    // 1. CHANGE: callGeminiAI instead of callClaudeAPI
    const aiResponse = await callGeminiAI(prompt, systemPrompt);
    
    // 2. CLEANUP: Gemini often wraps JSON in backticks (```json), we must remove them
    const cleanJson = aiResponse.replace(/```json|```/g, "").trim();
    
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');
    
    const timetableData = JSON.parse(jsonMatch[0]);
    
    const timetable = await Timetable.findOneAndUpdate(
      { schoolId: req.user.schoolId, class: className },
      {
        schoolId: req.user.schoolId,
        class: className,
        schedule: timetableData.schedule
      },
      { upsert: true, new: true }
    );

    res.json({ 
      message: 'Timetable generated successfully via Gemini', 
      timetable 
    });
  } catch (error) {
    console.error('Timetable generation error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Get Timetable
app.get('/api/timetable/:class', authMiddleware(), async (req, res) => {
  try {
    const timetable = await Timetable.findOne({
      schoolId: req.user.schoolId,
      class: req.params.class
    });

    if (!timetable) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Homework
app.post('/api/homework', authMiddleware(['teacher']), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ teacherId: req.user.teacherId });
    
    const homework = await Homework.create({
      schoolId: req.user.schoolId,
      teacherId: req.user.teacherId,
      teacherName: teacher.name,
      title: req.body.title,
      description: req.body.description,
      subject: req.body.subject,
      class: req.body.class,
      dueDate: new Date(req.body.dueDate),
      attachmentType: req.body.attachmentType || 'none',
      attachmentUrl: req.body.attachmentUrl || ''
    });

    res.json({ message: 'Homework assigned', homework });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Homework by Teacher
app.get('/api/teacher/homework', authMiddleware(['teacher']), async (req, res) => {
  try {
    const homework = await Homework.find({
      schoolId: req.user.schoolId,
      teacherId: req.user.teacherId
    }).sort({ createdAt: -1 });

    res.json(homework);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// FIXED: Get Student Dashboard - now includes proper notifications and buses
app.get('/api/student/dashboard', authMiddleware(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.user.studentId })
      .select('-password');

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const attendanceRecords = await Attendance.find({ 
      studentId: req.user.studentId 
    })
      .sort({ date: -1 })
      .limit(30);

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'Present').length;

    const homework = await Homework.find({
      schoolId: req.user.schoolId,
      class: student.class
    }).sort({ dueDate: 1 });

    // FIXED: Get notifications targeted to students
    const notifications = await Notification.find({
      schoolId: req.user.schoolId,
      target: { $in: ['students', 'all'] }
    }).sort({ sentAt: -1 }).limit(10);

    // FIXED: Get all buses for the school
    const buses = await Bus.find({ schoolId: req.user.schoolId });

    res.json({
      student: {
        name: student.name,
        rollNo: student.rollNo,
        class: student.class,
        parentPhone: student.parentPhone
      },
      attendance: {
        percentage: student.attendance || 0,
        totalDays,
        presentDays,
        records: attendanceRecords
      },
      homework,
      notifications,
      buses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Student Timetable
app.get('/api/student/timetable', authMiddleware(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.user.studentId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const timetable = await Timetable.findOne({
      schoolId: req.user.schoolId,
      class: student.class
    });

    res.json(timetable || { message: 'Timetable not available yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 School Management System - Fixed & Enhanced`);
});