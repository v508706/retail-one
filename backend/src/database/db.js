import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL_FIXED } from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'retailone.db');

let _raw;

class DbWrapper {
  constructor(raw) { this._raw = raw; }

  prepare(sql) {
    const stmt = this._raw.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  }

  exec(sql) { return this._raw.exec(sql); }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._raw.exec('BEGIN');
      try {
        const result = fn(...args);
        self._raw.exec('COMMIT');
        return result;
      } catch (e) {
        try { self._raw.exec('ROLLBACK'); } catch {}
        throw e;
      }
    };
  }
}

let db;

export function getDb() {
  if (!db) {
    _raw = new DatabaseSync(DB_PATH);
    db = new DbWrapper(_raw);
    initSchema();
  }
  return db;
}

function initSchema() {
  try { _raw.exec('PRAGMA journal_mode=WAL'); } catch {}
  try { _raw.exec('PRAGMA foreign_keys=ON'); } catch {}

  // Split on semicolons; strip leading SQL comments from each chunk before executing
  const raw = SCHEMA_SQL_FIXED;
  const chunks = raw.split(';');

  let errors = 0;
  for (let chunk of chunks) {
    // Strip leading blank lines and SQL comment lines
    const lines = chunk.split('\n').filter(l => {
      const t = l.trim();
      return t.length > 0 && !t.startsWith('--');
    });
    const stmt = lines.join('\n').trim();
    if (!stmt || stmt.startsWith('PRAGMA') || stmt.startsWith('SET ')) continue;

    try {
      _raw.exec(stmt + ';');
    } catch (e) {
      const msg = e.message || '';
      if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
        errors++;
        if (errors <= 8) console.warn('Schema:', msg.slice(0, 100), '→', stmt.slice(0, 50));
      }
    }
  }
  if (errors > 0) console.log(`Schema init complete (${errors} non-duplicate errors)`);
}
