<?php
/**
 * RetailOne — PHP Backend Entry Point
 * Run: php -S localhost:3001 index.php
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');  // don't leak PHP errors as HTML; log them instead

// ── CORS ──────────────────────────────────────────────────────
require __DIR__ . '/config.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Bootstrap ─────────────────────────────────────────────────
require __DIR__ . '/src/DB.php';
require __DIR__ . '/src/JWT.php';
require __DIR__ . '/src/helpers.php';
require __DIR__ . '/src/pricing.php';

// ── Router ────────────────────────────────────────────────────
/**
 * Register and immediately try to match a route.
 * On match: call $fn with named URL params; exits.
 * No match: return false and continue.
 */
function route(string $method, string $pattern, callable $fn): void {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) return;

    // Strip query string from REQUEST_URI
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    // Strip /api/v1 or /api prefix (Vite proxy sends /api/v1/...)
    $uri = preg_replace('#^/api/v1#', '', $uri);
    $uri = preg_replace('#^/api#',    '', $uri);
    $uri = rtrim($uri, '/') ?: '/';

    // Convert :param → named capture group
    $regex = '#^' . preg_replace('#/:([^/]+)#', '/(?P<$1>[^/]+)', $pattern) . '$#';

    if (!preg_match($regex, $uri, $m)) return;

    // Pull only named captures
    $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

    try {
        $fn($params);
    } catch (\Throwable $e) {
        error_log($e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
        http_response_code(500);
        echo json_encode(['error' => ['code' => 'INTERNAL_ERROR', 'message' => 'An unexpected error occurred']]);
    }
    exit;
}

// ── Routes ────────────────────────────────────────────────────
require __DIR__ . '/src/api/auth.php';
require __DIR__ . '/src/api/catalog.php';
require __DIR__ . '/src/api/parties.php';
require __DIR__ . '/src/api/sales.php';
require __DIR__ . '/src/api/purchase.php';
require __DIR__ . '/src/api/accounting.php';
require __DIR__ . '/src/api/reports.php';
require __DIR__ . '/src/api/settings.php';
require __DIR__ . '/src/api/loyalty.php';
require __DIR__ . '/src/api/hr.php';
require __DIR__ . '/src/api/online_store.php';

// ── 404 Fallback ──────────────────────────────────────────────
http_response_code(404);
echo json_encode(['error' => ['code' => 'NOT_FOUND', 'message' => 'Endpoint not found']]);
