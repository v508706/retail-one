<?php
class DB {
    private static ?PDO $pdo = null;

    public static function conn(): PDO {
        if (self::$pdo) return self::$pdo;
        $dsn = 'mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4';
        self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return self::$pdo;
    }

    /** Run a query and return all rows. */
    public static function all(string $sql, array $p = []): array {
        $st = self::conn()->prepare($sql);
        $st->execute($p);
        return $st->fetchAll();
    }

    /** Run a query and return one row (or null). */
    public static function one(string $sql, array $p = []): ?array {
        $st = self::conn()->prepare($sql);
        $st->execute($p);
        $r = $st->fetch();
        return $r ?: null;
    }

    /** Execute a DML statement, return affected rows. */
    public static function run(string $sql, array $p = []): int {
        $st = self::conn()->prepare($sql);
        $st->execute($p);
        return $st->rowCount();
    }

    /** Execute and return lastInsertId (for auto-increment tables). */
    public static function insert(string $sql, array $p = []): string {
        self::run($sql, $p);
        return self::conn()->lastInsertId();
    }

    /** Count helper. */
    public static function count(string $sql, array $p = []): int {
        $r = self::one($sql, $p);
        return (int)($r ? array_values($r)[0] : 0);
    }

    public static function beginTransaction(): void { self::conn()->beginTransaction(); }
    public static function commit(): void           { self::conn()->commit(); }
    public static function rollback(): void         { self::conn()->rollBack(); }

    /** Paginate helper — returns [rows, total]. */
    public static function paginate(string $countSql, string $rowSql, array $p, int $limit, int $offset): array {
        $total = self::count($countSql, $p);
        $rows  = self::all($rowSql.' LIMIT ? OFFSET ?', array_merge($p, [$limit, $offset]));
        return [$rows, $total];
    }
}
