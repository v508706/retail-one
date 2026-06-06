import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRouter from './modules/auth.js';
import catalogRouter from './modules/catalog.js';
import partiesRouter from './modules/parties.js';
import salesRouter from './modules/sales.js';
import purchaseRouter from './modules/purchase.js';
import accountingRouter from './modules/accounting.js';
import reportsRouter from './modules/reports.js';
import settingsRouter from './modules/settings.js';
import loyaltyRouter from './modules/loyalty.js';
import hrRouter from './modules/hr.js';
import onlineStoreRouter from './modules/online-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize DB
import { getDb } from './database/db.js';
getDb();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from:
//  - local dev (any origin)
//  - the Vercel frontend (set FRONTEND_URL on Render, e.g. https://retail-one.vercel.app)
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, /\.vercel\.app$/, 'http://localhost:5173']
  : true; // dev: allow all

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.path}`);
  next();
});

const v1 = '/api/v1';

// auth (no tenant required)
app.use(`${v1}/auth`, authRouter);

// public online store
app.use(`${v1}`, onlineStoreRouter);

// tenant-scoped API
app.use(`${v1}`, catalogRouter);
app.use(`${v1}`, partiesRouter);
app.use(`${v1}`, salesRouter);
app.use(`${v1}`, purchaseRouter);
app.use(`${v1}`, accountingRouter);
app.use(`${v1}`, reportsRouter);
app.use(`${v1}`, settingsRouter);
app.use(`${v1}`, loyaltyRouter);
app.use(`${v1}`, hrRouter);

// health
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', ts: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 RetailOne API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/v1`);
  console.log(`\n   Run 'npm run seed' to load demo data.`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Stop the existing server or use a different port:`);
    console.error(`   PORT=3002 npm run dev\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
