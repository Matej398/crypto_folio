<?php
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$userId = (int) $_SESSION['user_id'];

try {
    $pdo = getDBConnection();
} catch (Throwable $e) {
    // getDBConnection already returns JSON error and exits on failure
    exit;
}

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT avatar_url FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'avatarUrl' => buildAvatarResponseUrl($row['avatar_url'] ?? null)
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['avatar'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['avatar'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    $errorMessage = 'Upload failed. Please try again.';
    switch ($file['error']) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            $errorMessage = 'File exceeds maximum size of 1MB';
            break;
        case UPLOAD_ERR_PARTIAL:
            $errorMessage = 'Incomplete upload. Please try again.';
            break;
        case UPLOAD_ERR_NO_FILE:
            $errorMessage = 'No file uploaded.';
            break;
    }
    echo json_encode(['success' => false, 'error' => $errorMessage]);
    exit;
}

if ($file['size'] > AVATAR_MAX_FILE_SIZE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File exceeds maximum size of 1MB']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);
if (!in_array($mimeType, AVATAR_ALLOWED_MIME_TYPES, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unsupported file type. Use PNG, JPG, or WebP.']);
    exit;
}

switch ($mimeType) {
    case 'image/jpeg':
        $sourceImage = imagecreatefromjpeg($file['tmp_name']);
        break;
    case 'image/png':
        $sourceImage = imagecreatefrompng($file['tmp_name']);
        break;
    case 'image/webp':
        if (!function_exists('imagecreatefromwebp')) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'WebP is not supported on this server.']);
            exit;
        }
        $sourceImage = imagecreatefromwebp($file['tmp_name']);
        break;
    default:
        $sourceImage = false;
}

if (!$sourceImage) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unable to read the uploaded image.']);
    exit;
}

$width = imagesx($sourceImage);
$height = imagesy($sourceImage);
$minSide = min($width, $height);
$srcX = max(0, (int) (($width - $minSide) / 2));
$srcY = max(0, (int) (($height - $minSide) / 2));

$avatarSize = 128;
$avatarImage = imagecreatetruecolor($avatarSize, $avatarSize);
imagealphablending($avatarImage, false);
imagesavealpha($avatarImage, true);
$transparent = imagecolorallocatealpha($avatarImage, 0, 0, 0, 127);
imagefill($avatarImage, 0, 0, $transparent);

imagecopyresampled(
    $avatarImage,
    $sourceImage,
    0,
    0,
    $srcX,
    $srcY,
    $avatarSize,
    $avatarSize,
    $minSide,
    $minSide
);

imagedestroy($sourceImage);

$filename = 'user_' . $userId . '.png';
$destinationPath = AVATAR_UPLOAD_DIR . $filename;
$relativePath = AVATAR_RELATIVE_PATH . $filename;

if (!is_dir(AVATAR_UPLOAD_DIR)) {
    @mkdir(AVATAR_UPLOAD_DIR, 0755, true);
}

if (!imagepng($avatarImage, $destinationPath)) {
    imagedestroy($avatarImage);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save avatar.']);
    exit;
}

imagedestroy($avatarImage);

$stmt = $pdo->prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
$stmt->execute([$relativePath, $userId]);

$_SESSION['avatar_url'] = $relativePath;

$avatarUrl = buildAvatarResponseUrl($relativePath);

echo json_encode([
    'success' => true,
    'avatarUrl' => $avatarUrl
]);
