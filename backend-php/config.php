<?php
// ── Database ──────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'retail_one');
define('DB_USER', 'root');
define('DB_PASS', '');

// ── JWT ───────────────────────────────────────────────────────
define('JWT_SECRET', 'retail-one-secret-key-change-in-production');
define('JWT_ACCESS_TTL',  8 * 3600);   // 8 hours
define('JWT_REFRESH_TTL', 30 * 86400); // 30 days

// ── App ───────────────────────────────────────────────────────
define('APP_ENV', 'development');

// Allowed CORS origins (React frontend)
define('ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
]);
