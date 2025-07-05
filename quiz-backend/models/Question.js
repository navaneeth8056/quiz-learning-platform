const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  chapter: { type: Number, required: true },
  question: { type: String, required: true },
  A: { type: String, required: true },
  B: { type: String, required: true },
  C: { type: String, required: true },
  D: { type: String, required: true },
  answer: { type: String, required: true },
  type: { type: String, enum: ['normal', 'HOTS'], default: 'normal' }
});

module.exports = mongoose.model('Question', questionSchema); 