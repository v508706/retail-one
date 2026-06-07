<?php
// ── Firms ─────────────────────────────────────────────────────

route('GET','/firms', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM firms WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('GET','/firms/:id', function($p) {
    $auth = requireAuth();
    $row  = DB::one("SELECT * FROM firms WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$row) err(404,'NOT_FOUND','Firm not found');
    ok($row);
});

route('POST','/firms', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO firms(id,tenant_id,name,gstin,state,state_code,address,phone,email,currency,decimals,fy_start_month)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        [$id,$tid,trim($b['name']),n($b['gstin']??null),n($b['state']??null),n($b['state_code']??null),
         n($b['address']??null),n($b['phone']??null),n($b['email']??null),
         $b['currency']??'INR',(int)($b['decimals']??2),(int)($b['fy_start_month']??4)]);
    ok(DB::one("SELECT * FROM firms WHERE id=?",[$id]), 201);
});

route('PUT','/firms/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE firms SET name=?,gstin=?,state=?,state_code=?,address=?,phone=?,email=?,
                currency=?,decimals=?,fy_start_month=?,logo_url=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [trim($b['name']??''),n($b['gstin']??null),n($b['state']??null),n($b['state_code']??null),
         n($b['address']??null),n($b['phone']??null),n($b['email']??null),
         $b['currency']??'INR',(int)($b['decimals']??2),(int)($b['fy_start_month']??4),
         n($b['logo_url']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM firms WHERE id=?",[$p['id']]));
});

// ── Stores ────────────────────────────────────────────────────

route('GET','/stores', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM stores WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/stores', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO stores(id,tenant_id,firm_id,name,address) VALUES(?,?,?,?,?)",
        [$id,$auth['tenant_id'],$b['firm_id']??($auth['firm_id']??null),trim($b['name']),n($b['address']??null)]);
    ok(DB::one("SELECT * FROM stores WHERE id=?",[$id]), 201);
});

route('PUT','/stores/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE stores SET name=?,address=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [trim($b['name']??''),n($b['address']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM stores WHERE id=?",[$p['id']]));
});

route('DELETE','/stores/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE stores SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Terminals ─────────────────────────────────────────────────

route('GET','/terminals', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM terminals WHERE tenant_id=? ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/terminals', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO terminals(id,tenant_id,store_id,name,doc_prefix) VALUES(?,?,?,?,?)",
        [$id,$auth['tenant_id'],n($b['store_id']??null),trim($b['name']),$b['doc_prefix']??'T1']);
    ok(DB::one("SELECT * FROM terminals WHERE id=?",[$id]), 201);
});

// ── Settings ──────────────────────────────────────────────────

route('GET','/settings', function() {
    $auth  = requireAuth();
    $tid   = $auth['tenant_id'];
    $firmId= $auth['firm_id'] ?? null;
    $scope = $_GET['scope'] ?? null;
    $where = 'tenant_id=?';
    $params= [$tid];
    if ($firmId) { $where .= ' AND (firm_id=? OR firm_id IS NULL)'; $params[] = $firmId; }
    if ($scope)  { $where .= ' AND scope=?'; $params[] = $scope; }
    $rows = DB::all("SELECT * FROM settings WHERE $where ORDER BY scope", $params);
    // decode JSON data fields
    foreach ($rows as &$r) {
        if ($r['data']) $r['data'] = json_decode($r['data'], true);
    }
    ok($rows);
});

route('PUT','/settings/:scope', function($p) {
    $auth   = requireAuth();
    $tid    = $auth['tenant_id'];
    $firmId = $auth['firm_id'] ?? null;
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];
    $data   = json_encode($b['data'] ?? $b);

    $existing = DB::one("SELECT id FROM settings WHERE tenant_id=? AND firm_id<=>? AND scope=?",[$tid,$firmId,$p['scope']]);
    if ($existing) {
        DB::run("UPDATE settings SET data=?,updated_at=NOW() WHERE id=?",[$data,$existing['id']]);
    } else {
        DB::run("INSERT INTO settings(id,tenant_id,firm_id,scope,data) VALUES(?,?,?,?,?)",
            [uuid(),$tid,$firmId,$p['scope'],$data]);
    }
    ok(['scope'=>$p['scope'],'data'=>json_decode($data,true)]);
});

// ── Users ─────────────────────────────────────────────────────

route('GET','/users', function() {
    $auth = requireAuth();
    $rows = DB::all(
        "SELECT u.id,u.name,u.email,u.phone,u.status,
                GROUP_CONCAT(r.name) as roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id=u.id
         LEFT JOIN roles r ON r.id=ur.role_id
         WHERE u.tenant_id=? GROUP BY u.id ORDER BY u.name",
        [$auth['tenant_id']]
    );
    ok($rows);
});

route('POST','/users', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name','email','password']);
    $id = uuid();
    DB::run("INSERT INTO users(id,tenant_id,name,email,phone,password_hash,status) VALUES(?,?,?,?,?,?,?)",
        [$id,$tid,trim($b['name']),trim($b['email']),n($b['phone']??null),
         password_hash($b['password'],PASSWORD_BCRYPT),'active']);
    ok(DB::one("SELECT id,name,email,phone,status FROM users WHERE id=?",[$id]), 201);
});

route('PUT','/users/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    $sql  = "UPDATE users SET name=?,email=?,phone=?,status=?";
    $params = [trim($b['name']??''),trim($b['email']??''),n($b['phone']??null),$b['status']??'active'];
    if (!empty($b['password'])) { $sql .= ',password_hash=?'; $params[] = password_hash($b['password'],PASSWORD_BCRYPT); }
    $sql .= ',updated_at=NOW() WHERE id=? AND tenant_id=?';
    $params[] = $p['id']; $params[] = $auth['tenant_id'];
    DB::run($sql, $params);
    ok(DB::one("SELECT id,name,email,phone,status FROM users WHERE id=?",[$p['id']]));
});

route('DELETE','/users/:id', function($p) {
    $auth = requireAuth();
    if ($p['id'] === $auth['sub']) err(400,'CANNOT_DELETE_SELF','Cannot delete your own account');
    DB::run("UPDATE users SET status='inactive' WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Roles ─────────────────────────────────────────────────────

route('GET','/roles', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM roles WHERE tenant_id=? ORDER BY name",[$auth['tenant_id']]);
    foreach ($rows as &$r) {
        $r['permissions'] = DB::all("SELECT * FROM role_permissions WHERE role_id=?",[$r['id']]);
    }
    ok($rows);
});

route('POST','/roles', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO roles(id,tenant_id,name) VALUES(?,?,?)",[$id,$tid,trim($b['name'])]);
    ok(DB::one("SELECT * FROM roles WHERE id=?",[$id]), 201);
});

route('DELETE','/roles/:id', function($p) {
    $auth = requireAuth();
    DB::run("DELETE FROM roles WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Invoice Templates ─────────────────────────────────────────

route('GET','/invoice-templates', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM invoice_templates WHERE tenant_id=? ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/invoice-templates', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO invoice_templates(id,tenant_id,firm_id,name,doc_type,layout,theme_color,
                show_logo,show_signature,header_note,footer_note,terms,is_default)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??null,trim($b['name']),$b['doc_type']??'invoice',
         $b['layout']??'a4',$b['theme_color']??'#1a56db',nb($b['show_logo']??1),nb($b['show_signature']??0),
         n($b['header_note']??null),n($b['footer_note']??null),n($b['terms']??null),nb($b['is_default']??0)]);
    ok(DB::one("SELECT * FROM invoice_templates WHERE id=?",[$id]), 201);
});

route('PUT','/invoice-templates/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE invoice_templates SET name=?,layout=?,theme_color=?,show_logo=?,show_signature=?,
                header_note=?,footer_note=?,terms=?,is_default=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [trim($b['name']??''),$b['layout']??'a4',$b['theme_color']??'#1a56db',nb($b['show_logo']??1),
         nb($b['show_signature']??0),n($b['header_note']??null),n($b['footer_note']??null),
         n($b['terms']??null),nb($b['is_default']??0),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM invoice_templates WHERE id=?",[$p['id']]));
});

route('DELETE','/invoice-templates/:id', function($p) {
    $auth = requireAuth();
    DB::run("DELETE FROM invoice_templates WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Document Sequences ────────────────────────────────────────

route('GET','/document-sequences', function() {
    $auth   = requireAuth();
    $firmId = $auth['firm_id'] ?? null;
    $rows   = DB::all("SELECT * FROM document_sequences WHERE tenant_id=? AND firm_id<=>?",[$auth['tenant_id'],$firmId]);
    ok($rows);
});

route('PUT','/document-sequences/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE document_sequences SET prefix=?,next_no=? WHERE id=? AND tenant_id=?",
        [$b['prefix']??'',(int)($b['next_no']??1),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM document_sequences WHERE id=?",[$p['id']]));
});
