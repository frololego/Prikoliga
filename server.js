require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db.js');
const authRoutes = require('./routes/authRoutes.js');
const matchRoutes = require('./routes/matchRoutes.js');
const predictionRoutes = require('./routes/predictionRoutes.js');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require('./routes/userRoutes'); 

const app = express();
const PORT = process.env.PORT || 5000;

// === Безопасность и CORS ===
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true
}));

// === Middleware ===
app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === Логирование запросов ===
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// === Статические файлы ===
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user', userRoutes);

// Отключаем кеширование для JS-файлов
app.use('/js', express.static('public/js', {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('Pragma', 'no-cache');
  }
}));

// === Проверка API ===
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString() 
  });
});

// === SPA Fallback ===
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else if (req.accepts('json')) {
    res.status(404).json({ error: "Not found" });
  } else {
    res.status(404).send('Not found');
  }
});

// === Обработка ошибок ===
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  
  console.error("🚨 [ERROR]", {
    path: req.path,
    method: req.method,
    error: err.message
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal Server Error'
  });
});

// === Запуск сервера ===
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Allowed origins: ${process.env.ALLOWED_ORIGINS || 'local'}`);
});

// === Graceful Shutdown ===
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown...');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);