<?php
/**
 * GitHub Webhook Handler for Auto-Deployment
 * 
 * This script handles GitHub webhook events and automatically pulls
 * the latest changes from the repository.
 * 
 * Setup:
 * 1. Set WEBHOOK_SECRET in config.php to a random string
 * 2. Configure GitHub webhook:
 *    - URL: https://yourdomain.com/api/webhook.php
 *    - Content type: application/json
 *    - Secret: (same as WEBHOOK_SECRET)
 *    - Events: Just the push event
 */

require_once __DIR__ . '/config_loader.php';

// Get webhook secret from config (add to config.php if not exists)
$webhookSecret = defined('WEBHOOK_SECRET') ? WEBHOOK_SECRET : '';

// Get the raw POST body
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

// Verify webhook signature if secret is set
if (!empty($webhookSecret)) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $webhookSecret);
    if (!hash_equals($expectedSignature, $signature)) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
}

// Parse the JSON payload
$data = json_decode($payload, true);

// Only process push events
if (!isset($data['ref']) || $data['ref'] !== 'refs/heads/main') {
    http_response_code(200);
    echo json_encode(['message' => 'Not a main branch push, ignoring']);
    exit;
}

// Get repository name
$repoName = $data['repository']['name'] ?? '';

// Verify repository name matches
$expectedRepo = 'crypto_folio';
if ($repoName !== $expectedRepo) {
    http_response_code(404);
    echo json_encode(['error' => "Unknown repo: {$repoName}"]);
    exit;
}

// Get the repository path (adjust this to your server's path)
$repoPath = dirname(__DIR__);

// Verify the directory exists and is a git repository
if (!is_dir($repoPath) || !is_dir($repoPath . '/.git')) {
    http_response_code(500);
    echo json_encode(['error' => 'Repository directory not found or not a git repo']);
    exit;
}

// Change to repository directory
chdir($repoPath);

// Pull the latest changes
$output = [];
$returnCode = 0;
exec('git pull origin main 2>&1', $output, $returnCode);

if ($returnCode !== 0) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Git pull failed',
        'output' => implode("\n", $output)
    ]);
    exit;
}

// Success
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Repository updated successfully',
    'commit' => $data['head_commit']['id'] ?? 'unknown',
    'output' => implode("\n", $output)
]);

