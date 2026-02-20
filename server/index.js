const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const departmentRoutes = require('./routes/departments');
const userRoutes = require('./routes/users');
const budgetHeadRoutes = require('./routes/budgetHeads');
const settingsRoutes = require('./routes/settings');
const allocationRoutes = require('./routes/allocations');
const expenditureRoutes = require('./routes/expenditures');
const fileRoutes = require('./routes/files');
const auditLogRoutes = require('./routes/auditLogs');
const reportRoutes = require('./routes/reports');
const consolidatedReportRoutes = require('./routes/consolidatedReports');
const budgetProposalRoutes = require('./routes/budgetProposals');
const systemRoutes = require('./routes/system');
const pushRoutes = require('./routes/pushRoutes');
const incomeRoutes = require('./routes/income');
const financialYearRoutes = require('./routes/financialYears');
const aiRoutes = require('./routes/ai');

// Import services
const { initReminderService } = require('./services/reminderService');
const { initSocket } = require('./services/socketService');

const app = express();

// Comprehensive Request Logger for Debugging
app.use((req, res, next) => {
  if (req.url.includes('/api/auth/profile/picture')) {
    console.log(`[HTTP-TRACE] ${req.method} ${req.url}`);
    console.log(`  Content-Type: ${req.headers['content-type']}`);
    console.log(`  Content-Length: ${req.headers['content-length']}`);
  }
  next();
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection status middleware
app.use((req, res, next) => {
  const state = mongoose.connection.readyState;
  if (state !== 1 && req.url !== '/health' && !req.url.startsWith('/api-status')) {
    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    console.warn(`[SERVER] 503 Error: Database is ${statusMap[state] || state}. Request: ${req.method} ${req.url}`);
    return res.status(503).json({
      success: false,
      message: 'Database is still connecting, please try again in a moment',
      status: state,
      statusLabel: statusMap[state] || 'unknown'
    });
  }
  next();
});

// Security Middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());

// Rate limiting: 100 requests per 15 minutes
// Rate limiting: 1000 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);

// Serve static files (for uploaded attachments)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const statusHandler = (req, res) => {
  res.json({
    success: true,
    message: 'CBMS Backend API is running!',
    version: '1.0.3-DIAGNOSTIC',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      departments: '/api/departments',
      budgetHeads: '/api/budget-heads',
      allocations: '/api/allocations',
      expenditures: '/api/expenditures',
      notifications: '/api/notifications',
      reports: '/api/reports',
      ai: '/api/ai'
    }
  });
};

app.get('/', statusHandler);
app.get('/api', statusHandler);
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/budget-heads', budgetHeadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/allocations/bulk-upload', require('./routes/bulkUpload'));
app.use('/api/allocations', allocationRoutes);
app.use('/api/expenditures', expenditureRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/consolidated-reports', consolidatedReportRoutes);
app.use('/api/budget-proposals', budgetProposalRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/financial-years', financialYearRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

// Connection event listeners
mongoose.connection.on('connecting', () => console.log('[DB] Connecting...'));
mongoose.connection.on('connected', () => console.log('[DB] Connection established'));
mongoose.connection.on('error', (err) => console.error('[DB] Connection error:', err));
mongoose.connection.on('disconnected', () => console.log('[DB] Connection lost'));

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
console.log('[DB] Connecting to MongoDB...');
console.log('[DB] URI:', mongoUri ? mongoUri.replace(/:.*@/, ':****@').split('?')[0] : 'UNDEFINED');

const dbOptions = {
  serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000, // Check heartbeats every 10 seconds
  connectTimeoutMS: 30000,
  family: 4 // Force IPv4 to avoid connection issues
};

const connectWithRetry = () => {
  console.log('[DB] Attempting to connect to MongoDB...');
  mongoose.connect(mongoUri, dbOptions)
    .then(() => {
      console.log('✅ [DB] Connected to MongoDB');
      // Initialize reminder service after DB connection
      initReminderService();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      if (err.name === 'MongooseServerSelectionError') {
        console.error('👉 TIP: Check if your IP address is whitelisted in MongoDB Atlas.');
      }
      console.log('[DB] Retrying in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

const server = app.listen(PORT, '0.0.0.0', () => {
  const addr = server.address();
  const address = addr ? addr.address : '0.0.0.0';
  const port = addr ? addr.port : PORT;

  console.log(`🚀 CBMS Server is running on http://${address}:${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api`);

  // Initialize Socket.io
  initSocket(server);
  console.log('🔌 Socket.io initialized');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('\n🛑 MongoDB connection closed');
    console.log('🛑 Shutting down server...');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
