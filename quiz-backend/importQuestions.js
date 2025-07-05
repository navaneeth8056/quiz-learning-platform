const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config();
const Question = require('./models/Question');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  // Read Excel file
  const workbook = XLSX.readFile('Grade 10.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  // Debug: print first 3 rows
  console.log('First 3 rows:', data.slice(0, 3));

  // Prepare questions
  const questions = data.map((row) => {
    // Extract chapter number from 'Chapter' string
    let chapterNum = null;
    if (row.Chapter) {
      const match = row.Chapter.match(/\d+/);
      if (match) chapterNum = Number(match[0]);
    }
    const typeVal = (row.Type || '').toString().trim().toLowerCase() === 'hots' ? 'HOTS' : 'normal';
    return {
      chapter: chapterNum,
      question: (row.Question || '').toString().trim(),
      A: (row.A || '').toString().trim(),
      B: (row.B || '').toString().trim(),
      C: (row.C || '').toString().trim(),
      D: (row.D || '').toString().trim(),
      answer: (row.Answer || '').toString().trim(),
      type: typeVal,
    };
  }).filter(q => !isNaN(q.chapter) && q.question && q.A && q.B && q.C && q.D && q.answer);

  console.log('Questions to insert:', questions.length);

  try {
    await Question.deleteMany({}); // Optional: clear old questions
    const result = await Question.insertMany(questions);
    console.log('Questions actually inserted:', result.length);
    console.log('Questions imported successfully!');
  } catch (err) {
    console.error('Error importing questions:', err);
  } finally {
    mongoose.disconnect();
  }
}); 