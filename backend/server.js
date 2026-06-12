const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads/feed-media', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Feed media is served through protected URLs.' });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test DB Connection
require('./config/db');

// Import Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const orgRoutes = require('./routes/org.routes');
const courseRoutes = require('./routes/courses.routes');
const paymentRoutes = require('./routes/payments.routes');
const registerRoutes = require('./routes/register.routes');
const feedRoutes = require('./routes/feed.routes');
const snacksRoutes = require('./routes/snacks.routes');
const wallOfWinsRoutes = require('./routes/wallOfWins.routes');
const faqsRoutes = require('./routes/faqs.routes');
const messagesRoutes = require('./routes/messages.routes');
const welcomeVideoRoutes = require('./routes/welcomeVideo.routes');
const startHereStepsRoutes = require('./routes/startHereSteps.routes');
const askRyanRoutes = require('./routes/askRyan.routes');
const monthlyChallengeMonthsRoutes = require('./routes/monthlyChallengeMonths.routes');
const documentCenterRoutes = require('./routes/documentCenter.routes');
const galleryRoutes = require('./routes/gallery.routes');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/snacks', snacksRoutes);
app.use('/api/wall-of-wins', wallOfWinsRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/welcome-video', welcomeVideoRoutes);
app.use('/api/start-here-steps', startHereStepsRoutes);
app.use('/api/ask-ryan', askRyanRoutes);
app.use('/api/monthly-challenge-months', monthlyChallengeMonthsRoutes);
app.use('/api/document-center', documentCenterRoutes);
app.use('/api/gallery', galleryRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
