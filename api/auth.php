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
        // User login - single user system
        $email = filter_var($input['email'] ?? '', FILTER_SANITIZE_EMAIL);
        $password = $input['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Email and password are required']);
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
                
                // Initialize empty portfolio
                $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
                $emptyPortfolio = json_encode([]);
                $emptyStats = json_encode(['highestValue' => null, 'lowestValue' => null]);
                $stmt->execute([$userId, $emptyPortfolio, $emptyStats]);
                
                $user = [
                    'id' => $userId,
                    'email' => DEFAULT_EMAIL,
                    'password_hash' => $passwordHash
                ];
            }
            
            // Verify password
            if ($email !== DEFAULT_EMAIL || !password_verify($password, $user['password_hash'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
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
        
    } elseif ($action === 'logout') {
        // User logout
        session_start();
        session_destroy();
        echo json_encode(['success' => true]);
        
    } elseif ($action === 'check') {
        // Check if user is logged in
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
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>

