const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: { type: String },
  referralCode: { type: String, unique: true },
  referredBy: { type: String },
  fikaPoints: { type: Number, default: 100 },
  quizScores: [{
    chapter: Number,
    score: Number,
    date: { type: Date, default: Date.now }
  }],
  unlockedModules: {
    type: Map,
    of: [Number], // e.g., { '1': [1,2], '2': [1] } means chapter 1 modules 1 and 2 unlocked, chapter 2 module 1 unlocked
    default: {}
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema); 