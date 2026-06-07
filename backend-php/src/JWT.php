<?php
/**
 * Minimal JWT implementation — HS256 only, no external dependencies.
 */
class JWT {
    private static function b64e(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    private static function b64d(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, string $secret, int $ttl = 0): string {
        if ($ttl > 0) $payload['exp'] = time() + $ttl;
        $payload['iat'] = time();
        $header  = self::b64e(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $body    = self::b64e(json_encode($payload));
        $sig     = self::b64e(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$sig";
    }

    /** @throws RuntimeException on invalid/expired token */
    public static function decode(string $token, string $secret): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) throw new \RuntimeException('Malformed token');
        [$header, $body, $sig] = $parts;
        $expected = self::b64e(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $sig)) throw new \RuntimeException('Invalid signature');
        $payload = json_decode(self::b64d($body), true);
        if (!is_array($payload)) throw new \RuntimeException('Malformed payload');
        if (isset($payload['exp']) && $payload['exp'] < time()) throw new \RuntimeException('Token expired');
        return $payload;
    }
}
