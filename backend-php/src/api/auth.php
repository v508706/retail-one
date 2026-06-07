<?php
// POST /auth/login
route('POST','/auth/login', function() {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b, ['email','password']);

    $user = DB::one(
        "SELECT u.*, GROUP_CONCAT(r.id) as role_ids
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id=u.id
         LEFT JOIN roles r ON r.id=ur.role_id
         WHERE u.email=? AND u.status='active'
         GROUP BY u.id",
        [trim($b['email'])]
    );
    if (!$user || !password_verify($b['password'], $user['password_hash'])) {
        err(401,'INVALID_CREDENTIALS','Email or password is incorrect');
    }

    // Load permissions
    $perms = DB::all(
        "SELECT module,can_view,can_create,can_edit,can_share,can_delete
         FROM role_permissions rp
         INNER JOIN user_roles ur ON ur.role_id=rp.role_id
         WHERE ur.user_id=?",
        [$user['id']]
    );
    $permMap = [];
    foreach ($perms as $p) {
        $permMap[$p['module']] = [
            'view'   => (bool)$p['can_view'],
            'create' => (bool)$p['can_create'],
            'edit'   => (bool)$p['can_edit'],
            'share'  => (bool)$p['can_share'],
            'delete' => (bool)$p['can_delete'],
        ];
    }

    // Pick default firm
    $firm = DB::one("SELECT id FROM firms WHERE tenant_id=? AND deleted_at IS NULL LIMIT 1",[$user['tenant_id']]);
    $firmId = $firm ? $firm['id'] : null;

    $payload = [
        'sub'         => $user['id'],
        'tenant_id'   => $user['tenant_id'],
        'firm_id'     => $firmId,
        'name'        => $user['name'],
        'email'       => $user['email'],
        'permissions' => $permMap,
    ];

    $access  = JWT::encode($payload, JWT_SECRET, JWT_ACCESS_TTL);
    $refresh = JWT::encode(['sub' => $user['id'], 'tenant_id' => $user['tenant_id']], JWT_SECRET, JWT_REFRESH_TTL);

    ok([
        'access_token'  => $access,
        'refresh_token' => $refresh,
        'user' => [
            'id'          => $user['id'],
            'name'        => $user['name'],
            'email'       => $user['email'],
            'tenant_id'   => $user['tenant_id'],
            'firm_id'     => $firmId,
            'permissions' => $permMap,
        ],
    ]);
});

// POST /auth/refresh
route('POST','/auth/refresh', function() {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($b['refresh_token'])) err(400,'MISSING_TOKEN','refresh_token required');

    try {
        $p = JWT::decode($b['refresh_token'], JWT_SECRET);
    } catch (\RuntimeException $e) {
        err(401,'INVALID_TOKEN',$e->getMessage());
    }

    $user = DB::one("SELECT * FROM users WHERE id=? AND status='active'", [$p['sub']]);
    if (!$user) err(401,'UNAUTHENTICATED','User not found');

    $firm = DB::one("SELECT id FROM firms WHERE tenant_id=? AND deleted_at IS NULL LIMIT 1",[$user['tenant_id']]);
    $firmId = $firm ? $firm['id'] : null;

    $perms = DB::all(
        "SELECT module,can_view,can_create,can_edit,can_share,can_delete
         FROM role_permissions rp
         INNER JOIN user_roles ur ON ur.role_id=rp.role_id
         WHERE ur.user_id=?",
        [$user['id']]
    );
    $permMap = [];
    foreach ($perms as $pm) {
        $permMap[$pm['module']] = [
            'view'   => (bool)$pm['can_view'],
            'create' => (bool)$pm['can_create'],
            'edit'   => (bool)$pm['can_edit'],
            'share'  => (bool)$pm['can_share'],
            'delete' => (bool)$pm['can_delete'],
        ];
    }

    $payload = [
        'sub'         => $user['id'],
        'tenant_id'   => $user['tenant_id'],
        'firm_id'     => $firmId,
        'name'        => $user['name'],
        'email'       => $user['email'],
        'permissions' => $permMap,
    ];

    $access  = JWT::encode($payload, JWT_SECRET, JWT_ACCESS_TTL);
    $refresh = JWT::encode(['sub' => $user['id'], 'tenant_id' => $user['tenant_id']], JWT_SECRET, JWT_REFRESH_TTL);

    ok(['access_token' => $access, 'refresh_token' => $refresh]);
});

// POST /auth/otp/request  — stub (sends console log, no real SMS)
route('POST','/auth/otp/request', function() {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($b['phone'])) err(400,'MISSING_PHONE','phone required');
    $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $exp = date('Y-m-d H:i:s', time() + 600);
    DB::run("UPDATE users SET otp_code=?,otp_expires_at=? WHERE phone=?", [$otp,$exp,$b['phone']]);
    error_log("OTP for {$b['phone']}: $otp"); // dev log — replace with SMS gateway
    ok(['message' => 'OTP sent']);
});

// POST /auth/otp/verify
route('POST','/auth/otp/verify', function() {
    $b = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['phone','otp']);
    $user = DB::one(
        "SELECT * FROM users WHERE phone=? AND otp_code=? AND otp_expires_at > NOW() AND status='active'",
        [$b['phone'], $b['otp']]
    );
    if (!$user) err(401,'INVALID_OTP','OTP is invalid or expired');
    DB::run("UPDATE users SET otp_code=NULL,otp_expires_at=NULL WHERE id=?",[$user['id']]);

    $firm = DB::one("SELECT id FROM firms WHERE tenant_id=? AND deleted_at IS NULL LIMIT 1",[$user['tenant_id']]);
    $payload = [
        'sub'       => $user['id'],
        'tenant_id' => $user['tenant_id'],
        'firm_id'   => $firm ? $firm['id'] : null,
        'name'      => $user['name'],
        'email'     => $user['email'],
    ];
    $access  = JWT::encode($payload, JWT_SECRET, JWT_ACCESS_TTL);
    $refresh = JWT::encode(['sub' => $user['id'], 'tenant_id' => $user['tenant_id']], JWT_SECRET, JWT_REFRESH_TTL);
    ok(['access_token' => $access, 'refresh_token' => $refresh]);
});

// GET /auth/me
route('GET','/auth/me', function() {
    $auth = requireAuth();
    $user = DB::one("SELECT id,name,email,phone,status FROM users WHERE id=?",[$auth['sub']]);
    if (!$user) err(404,'NOT_FOUND','User not found');
    ok(array_merge($user,[
        'tenant_id'   => $auth['tenant_id'],
        'firm_id'     => $auth['firm_id'] ?? null,
        'permissions' => $auth['permissions'] ?? [],
    ]));
});
