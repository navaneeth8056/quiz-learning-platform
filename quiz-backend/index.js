const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const Question = require('./models/Question');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: false,
    sameSite: 'lax'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/callback",
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  // Read referral code from state param
  const referralCodeFromState = req.query.state;
  console.log('Referral code from state param:', referralCodeFromState);
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let referredBy = null;
      let initialPoints = 100;
      if (referralCodeFromState) {
        referredBy = referralCodeFromState;
        initialPoints = 150; // 100 initial + 50 referral bonus
        // Award 100 points to referrer
        await User.findOneAndUpdate(
          { referralCode: referredBy },
          { $inc: { fikaPoints: 100 } }
        );
      }
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        picture: profile.photos[0].value,
        referralCode,
        referredBy,
        fikaPoints: initialPoints
      });
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Auth routes
app.get('/auth/google', (req, res, next) => {
  // Pass referral code as state param to Google
  const state = req.query.ref ? req.query.ref : undefined;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state
  })(req, res, next);
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/login' }),
  (req, res) => {
    res.redirect('http://localhost:3000/chapters');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Get all unique chapters
app.get('/api/chapters', async (req, res) => {
  try {
    const chapters = await Question.distinct('chapter');
    chapters.sort((a, b) => a - b);
    res.json({ chapters });
  } catch (err) {
    console.error('Error in /api/chapters:', err);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
});

// Get only the first 10 questions by chapter
app.get('/api/questions/:chapter', async (req, res) => {
  try {
    const chapterNum = Number(req.params.chapter);
    if (isNaN(chapterNum)) {
      return res.status(400).json({ error: 'Invalid chapter number' });
    }
    const questions = await Question.find({ chapter: chapterNum }).limit(10);
    res.json({ questions });
  } catch (err) {
    console.error('Error in /api/questions/:chapter:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

// Save quiz score and award points
app.post('/api/quiz/score', requireAuth, async (req, res) => {
  try {
    const { chapter, score, totalQuestions } = req.body;
    const userId = req.user._id;
    // Award 1 point per correct answer (not double)
    const pointsEarned = score;
    // Save score and update points
    await User.findByIdAndUpdate(userId, {
      $push: { quizScores: { chapter, score, date: new Date() } },
      $inc: { fikaPoints: pointsEarned }
    });
    res.json({
      message: 'Score saved successfully',
      pointsEarned,
      newTotalPoints: req.user.fikaPoints + pointsEarned
    });
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Get user's quiz progress
app.get('/api/user/progress', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      quizScores: user.quizScores,
      fikaPoints: user.fikaPoints,
      unlockedModules: user.unlockedModules || {}
    });
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get questions by chapter and module (10 questions per module)
app.get('/api/questions/:chapter/:module', requireAuth, async (req, res) => {
  try {
    const chapterNum = Number(req.params.chapter);
    const moduleNum = Number(req.params.module);
    
    if (isNaN(chapterNum) || isNaN(moduleNum)) {
      return res.status(400).json({ error: 'Invalid chapter or module number' });
    }
    
    const skip = (moduleNum - 1) * 10;
    const questions = await Question.find({ chapter: chapterNum }).skip(skip).limit(10);
    
    res.json({ questions });
  } catch (err) {
    console.error('Error in /api/questions/:chapter/:module:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Unlock question module
app.post('/api/unlock/:chapter/:module', requireAuth, async (req, res) => {
  try {
    const chapterNum = String(Number(req.params.chapter));
    const moduleNum = Number(req.params.module);
    const userId = req.user._id;
    if (isNaN(Number(chapterNum)) || isNaN(moduleNum)) {
      return res.status(400).json({ error: 'Invalid chapter or module number' });
    }
    // Check if user has enough points
    const user = await User.findById(userId);
    if (user.fikaPoints < 10) {
      return res.status(400).json({ error: 'Insufficient Fika points' });
    }
    // Update unlockedModules
    const unlocked = user.unlockedModules?.get(chapterNum) || [1];
    if (!unlocked.includes(moduleNum)) unlocked.push(moduleNum);
    await User.findByIdAndUpdate(userId, {
      $inc: { fikaPoints: -10 },
      $set: { [`unlockedModules.${chapterNum}`]: unlocked }
    });
    res.json({
      message: 'Module unlocked successfully',
      newTotalPoints: user.fikaPoints - 10,
      unlockedModules: { ...Object.fromEntries(user.unlockedModules), [chapterNum]: unlocked }
    });
  } catch (err) {
    console.error('Error unlocking module:', err);
    res.status(500).json({ error: 'Failed to unlock module' });
  }
});

// Referral stats endpoint
app.get('/api/user/referrals', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const referredUsers = await User.find({ referredBy: user.referralCode });
    const referralCount = referredUsers.length;
    const referralPoints = referralCount * 100;
    res.json({
      referralCode: user.referralCode,
      referralCount,
      referralPoints
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// Connect to MongoDB and start server only if successful
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Connected to MongoDB!');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }); 