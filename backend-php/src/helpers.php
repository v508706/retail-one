<?php
// ── Response helpers ──────────────────────────────────────────

function ok(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function paginated(array $rows, int $total, int $page, int $perPage): never {
    http_response_code(200);
    echo json_encode([
        'data' => $rows,
        'meta' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int)ceil($total / $perPage),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function err(int $status, string $code, string $msg): never {
    http_response_code($status);
    echo json_encode(['error' => ['code' => $code, 'message' => $msg]]);
    exit;
}

function validate(array $body, array $required): void {
    foreach ($required as $k) {
        if (!isset($body[$k]) || $body[$k] === '' || $body[$k] === null) {
            err(422, 'VALIDATION_FAILED', "$k required");
        }
    }
}

// ── Auth ──────────────────────────────────────────────────────

function requireAuth(): array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $h, $m)) {
        err(401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header');
    }
    try {
        return JWT::decode($m[1], JWT_SECRET);
    } catch (\RuntimeException $e) {
        err(401, 'UNAUTHENTICATED', $e->getMessage());
    }
}

// ── Misc ──────────────────────────────────────────────────────

function uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function now_iso(): string {
    return (new \DateTime('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.000\Z');
}

function today(): string {
    return date('Y-m-d');
}

function n(mixed $v): ?string { return ($v === '' || $v === null) ? null : (string)$v; }
function nf(mixed $v): ?float  { return ($v === '' || $v === null) ? null : (float)$v; }
function ni(mixed $v): ?int    { return ($v === '' || $v === null) ? null : (int)$v; }
function nb(mixed $v): int     { return $v ? 1 : 0; }

function pagParams(): array {
    $page    = max(1, (int)($_GET['page']    ?? 1));
    $perPage = min(200, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    return [$page, $perPage, $offset];
}
