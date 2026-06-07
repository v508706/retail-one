<?php
// ── Staff ─────────────────────────────────────────────────────

route('GET','/staff', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where  = 's.tenant_id=? AND s.deleted_at IS NULL';
    $params = [$tid];
    if (!empty($_GET['search'])) {
        $where .= ' AND (s.name LIKE ? OR s.phone LIKE ?)';
        $params[] = '%'.$_GET['search'].'%';
        $params[] = '%'.$_GET['search'].'%';
    }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM staff s WHERE $where",
        "SELECT s.*,sp.salary,sp.bank_acc,sp.address,sp.emergency_contact
         FROM staff s
         LEFT JOIN staff_profiles sp ON sp.staff_id=s.id
         WHERE $where ORDER BY s.name",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/staff/:id', function($p) {
    $auth = requireAuth();
    $row  = DB::one(
        "SELECT s.*,sp.salary,sp.bank_acc,sp.address,sp.emergency_contact
         FROM staff s
         LEFT JOIN staff_profiles sp ON sp.staff_id=s.id
         WHERE s.id=? AND s.tenant_id=? AND s.deleted_at IS NULL",
        [$p['id'],$auth['tenant_id']]
    );
    if (!$row) err(404,'NOT_FOUND','Staff not found');
    ok($row);
});

route('POST','/staff', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);

    $id = uuid();
    DB::beginTransaction();
    try {
        DB::run("INSERT INTO staff(id,tenant_id,firm_id,name,designation,department,gender,blood_group,
                    national_id,dob,doj,nationality,phone,user_id)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [$id,$tid,$b['firm_id']??($auth['firm_id']??null),trim($b['name']),
             n($b['designation']??null),n($b['department']??null),n($b['gender']??null),
             n($b['blood_group']??null),n($b['national_id']??null),n($b['dob']??null),
             n($b['doj']??null),n($b['nationality']??null),n($b['phone']??null),n($b['user_id']??null)]);

        DB::run("INSERT INTO staff_profiles(id,tenant_id,staff_id,salary,bank_acc,address,emergency_contact)
                 VALUES(?,?,?,?,?,?,?)",
            [uuid(),$tid,$id,nf($b['salary']??null),n($b['bank_acc']??null),n($b['address']??null),n($b['emergency_contact']??null)]);

        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }

    ok(DB::one("SELECT * FROM staff WHERE id=?",[$id]), 201);
});

route('PUT','/staff/:id', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];

    DB::beginTransaction();
    try {
        DB::run("UPDATE staff SET name=?,designation=?,department=?,gender=?,blood_group=?,
                    national_id=?,dob=?,doj=?,nationality=?,phone=?,updated_at=NOW()
                 WHERE id=? AND tenant_id=?",
            [trim($b['name']??''),n($b['designation']??null),n($b['department']??null),n($b['gender']??null),
             n($b['blood_group']??null),n($b['national_id']??null),n($b['dob']??null),n($b['doj']??null),
             n($b['nationality']??null),n($b['phone']??null),$p['id'],$tid]);

        $existing = DB::one("SELECT id FROM staff_profiles WHERE staff_id=?",[$p['id']]);
        if ($existing) {
            DB::run("UPDATE staff_profiles SET salary=?,bank_acc=?,address=?,emergency_contact=? WHERE staff_id=?",
                [nf($b['salary']??null),n($b['bank_acc']??null),n($b['address']??null),n($b['emergency_contact']??null),$p['id']]);
        } else {
            DB::run("INSERT INTO staff_profiles(id,tenant_id,staff_id,salary,bank_acc,address,emergency_contact)
                     VALUES(?,?,?,?,?,?,?)",
                [uuid(),$tid,$p['id'],nf($b['salary']??null),n($b['bank_acc']??null),n($b['address']??null),n($b['emergency_contact']??null)]);
        }
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }

    ok(DB::one("SELECT s.*,sp.salary,sp.address FROM staff s LEFT JOIN staff_profiles sp ON sp.staff_id=s.id WHERE s.id=?",[$p['id']]));
});

route('DELETE','/staff/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE staff SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});
