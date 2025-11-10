<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Default credentials - change password in database or via change_password.php
define('DEFAULT_EMAIL', 'admin@portfolio.com');
define('DEFAULT_PASSWORD', 'portfolio123'); // Change this password!

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($action === 'login') {
        // User login - single user system (password only)
        $password = $input['password'] ?? '';
        
        if (empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Password is required']);
            exit;
        }
        
        try {
            $pdo = getDBConnection();
            
            // Check if user exists, if not create with default password
            $stmt = $pdo->prepare("SELECT id, email, password_hash FROM users WHERE email = ?");
            $stmt->execute([DEFAULT_EMAIL]);
            $user = $stmt->fetch();
            
            if (!$user) {
                // Create default user if doesn't exist
                $passwordHash = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
                $stmt->execute([DEFAULT_EMAIL, $passwordHash]);
                
                $userId = $pdo->lastInsertId();
                
                // Initialize empty portfolio - try with api_usage_data, fallback if column doesn't exist
                $emptyPortfolio = json_encode([]);
                $emptyStats = json_encode(['highestValue' => null, 'lowestValue' => null]);
                try {
                    $emptyApiUsage = json_encode([]);
                    $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data, api_usage_data) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$userId, $emptyPortfolio, $emptyStats, $emptyApiUsage]);
                } catch (PDOException $e) {
                    // Column doesn't exist, insert without it
                    $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
                    $stmt->execute([$userId, $emptyPortfolio, $emptyStats]);
                }
                
                $user = [
                    'id' => $userId,
                    'email' => DEFAULT_EMAIL,
                    'password_hash' => $passwordHash
                ];
            }
            
            // Verify password
            if (!password_verify($password, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'error' => 'Incorrect password. Please try again.']);
                exit;
            }
            
            // Start session
            session_start();
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $user['email'];
            
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email']
                ]
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } elseif ($action === 'change-password') {
        // Change password
        session_start();
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Authentication required']);
            exit;
        }
        
        $currentPassword = $input['currentPassword'] ?? '';
        $newPassword = $input['newPassword'] ?? '';
        
        if (empty($currentPassword) || empty($newPassword)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Current and new password are required']);
            exit;
        }
        
        if (strlen($newPassword) < 6) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'New password must be at least 6 characters']);
            exit;
        }
        
        try {
            $pdo = getDBConnection();
            
            // Get current user
            $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();
            
            if (!$user) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'User not found']);
                exit;
            }
            
            // Verify current password
            if (!password_verify($currentPassword, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'error' => 'Current password is incorrect']);
                exit;
            }
            
            // Update password
            $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$newPasswordHash, $_SESSION['user_id']]);
            
            echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        
    } elseif ($action === 'logout') {
        // User logout
        session_start();
        session_destroy();
        echo json_encode(['success' => true]);
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} elseif ($method === 'GET' && $action === 'check') {
    // Check if user is logged in (GET request)
    session_start();
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['email']
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>

