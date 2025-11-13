<?php
// Database configuration
// Copy this file to config.php and update with your actual credentials

// For LOCAL development, use:
// define('DB_USER', 'root');
// define('DB_PASS', '');

// For SERVER production (Hostinger), use:
// define('DB_USER', 'crypto_portfolio');
// define('DB_PASS', 'PxBeoY5Ei#xB');

define('DB_HOST', 'localhost');
define('DB_NAME', 'crypto_portfolio');
define('DB_USER', 'crypto_portfolio');  // Change to 'root' for local if needed
define('DB_PASS', 'PxBeoY5Ei#xB');      // Change to '' for local if needed
define('DB_CHARSET', 'utf8mb4');

// Avatar upload configuration (configure as needed)
if (!defined('AVATAR_UPLOAD_DIR')) {
    define('AVATAR_UPLOAD_DIR', __DIR__ . '/uploads/avatars/');
}
if (!defined('AVATAR_RELATIVE_PATH')) {
    define('AVATAR_RELATIVE_PATH', 'uploads/avatars/');
}
if (!defined('AVATAR_MAX_FILE_SIZE')) {
    define('AVATAR_MAX_FILE_SIZE', 1024 * 1024); // 1MB
}
if (!defined('AVATAR_ALLOWED_MIME_TYPES')) {
    define('AVATAR_ALLOWED_MIME_TYPES', ['image/jpeg', 'image/png', 'image/webp']);
}

if (!is_dir(AVATAR_UPLOAD_DIR)) {
    @mkdir(AVATAR_UPLOAD_DIR, 0755, true);
}

function buildAvatarResponseUrl($relativePath) {
    if (empty($relativePath)) {
        return null;
    }
    $cleanPath = ltrim($relativePath, '/');
    $fullPath = __DIR__ . '/' . $cleanPath;
    $version = file_exists($fullPath) ? filemtime($fullPath) : time();
    return 'api/' . $cleanPath . '?v=' . $version;
}

// Create database connection
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
        exit;
    }
}

// Configure session settings for persistence
ini_set('session.cookie_lifetime', 86400 * 7); // 7 days
ini_set('session.gc_maxlifetime', 86400 * 7); // 7 days
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');

// Set JSON header with CORS support
header('Content-Type: application/json');
// Allow credentials - use specific origin or get from request
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin', $origin);
header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
header('Access-Control-Allow-Credentials', 'true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>

