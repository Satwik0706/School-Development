// ai-services.js - AI Integration Module
require('dotenv').config();
const fetch = require('node-fetch'); // Node <18

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not found in .env');

// ==================== AI HELPER ====================
async function callClaudeAPI(prompt, systemPrompt = '') {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    return data.completion || data.content?.[0]?.text || JSON.stringify(data);
  } catch (error) {
    console.error('Claude API Error:', error);
    throw error;
  }
}

// ==================== AI FEATURES ====================

// 1. AI Lesson Planner
async function generateLessonPlan(topic, duration, grade, subject) {
  const systemPrompt = 'You are an expert education curriculum designer. Create detailed, engaging lesson plans.';
  const prompt = `Create a detailed lesson plan for:
Topic: ${topic}
Duration: ${duration} minutes
Grade: ${grade}
Subject: ${subject}

Include:
1. Learning objectives
2. Materials needed
3. Step-by-step activities with time allocation
4. Assessment methods
5. Homework suggestions

Format as clear sections.`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 2. Auto-Grading Essay/Short Answers
async function gradeEssay(question, studentAnswer, rubric = '') {
  const systemPrompt = 'You are an expert teacher. Grade student answers fairly and provide constructive feedback.';
  const prompt = `Grade this student answer:

Question: ${question}

Student Answer: ${studentAnswer}

${rubric ? `Grading Rubric: ${rubric}` : ''}

Provide:
1. Score out of 100
2. Strengths (2-3 points)
3. Areas for improvement (2-3 points)
4. Specific feedback

Format: 
Score: [number]/100
Strengths: ...
Improvements: ...
Feedback: ...`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 3. Personalized Study Recommendations
async function generateStudyPlan(studentData) {
  const { name, weakSubjects, strengths, examDate, studyHoursPerDay } = studentData;
  const systemPrompt = 'You are an expert academic counselor. Create personalized study plans.';
  const prompt = `Create a personalized study plan:

Student: ${name}
Weak Subjects: ${weakSubjects.join(', ')}
Strong Subjects: ${strengths.join(', ')}
Exam Date: ${examDate}
Available Study Time: ${studyHoursPerDay} hours/day

Create a day-by-day study schedule with:
1. Time allocation for each subject
2. Specific topics to cover
3. Practice exercises
4. Break times
5. Revision schedule`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 4. Homework Question Generator
async function generateHomeworkQuestions(subject, topic, difficulty, count = 5) {
  const systemPrompt = 'You are an expert teacher. Create educational questions that test understanding.';
  const prompt = `Generate ${count} homework questions:

Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}

For each question provide:
1. The question
2. Expected answer/solution
3. Marks allocation

Format clearly with numbers.`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 5. Student Doubt Resolver (Chatbot)
async function answerStudentDoubt(question, subject, context = '') {
  const systemPrompt = `You are a friendly, patient teacher helping students understand concepts. Explain in simple terms with examples. Encourage learning.`;
  const prompt = `Student Question: ${question}
Subject: ${subject}
${context ? `Context: ${context}` : ''}

Provide a clear, simple explanation suitable for students. Include an example if helpful.`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 6. Attendance Anomaly Detection
async function analyzeAttendance(attendanceData) {
  const systemPrompt = 'You are a data analyst specializing in education. Identify patterns and concerns.';
  const prompt = `Analyze this attendance data:
${JSON.stringify(attendanceData, null, 2)}
Identify:
1. Students with concerning patterns
2. Potential reasons
3. Recommendations for intervention
4. Overall trends`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// 7. Parent Communication Generator
async function generateParentMessage(situation, studentData, tone = 'professional') {
  const systemPrompt = 'You are a school administrator. Write clear, respectful messages to parents.';
  const prompt = `Generate a message to parents:

Situation: ${situation}
Student: ${studentData.name}
Class: ${studentData.class}
Tone: ${tone}
Additional Details: ${JSON.stringify(studentData.details || {})}`;
  return await callClaudeAPI(prompt, systemPrompt);
}

// ==================== EXPORT ====================
module.exports = {
  callClaudeAPI,
  analyzeAttendance,
  generateLessonPlan,
  gradeEssay,
  generateStudyPlan,
  generateHomeworkQuestions,
  answerStudentDoubt,
  generateParentMessage
};
