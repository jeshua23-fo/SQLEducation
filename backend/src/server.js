import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';

// Importing this module validates the required Supabase environment variables.
import './config/supabase.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without Origin (for example curl/health checks) are allowed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '20kb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'SQLEducation API', health: '/api/health' });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

app.use((error, _req, res, _next) => {
  // Keep server details out of API responses; never log request bodies/passwords.
  console.error('[api-error]', error?.message || 'Unknown error');
  if (error?.message === 'Origen no permitido por CORS.') {
    return res.status(403).json({ message: 'Origen no permitido.' });
  }
  return res.status(500).json({ message: 'Error interno del servidor.' });
});

app.listen(port, () => {
  console.log(`SQLEducation API listening on port ${port}`);
});
