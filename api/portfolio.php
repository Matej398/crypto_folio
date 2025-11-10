<?php
require_once 'config.php';

// Check authentication
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$userId = $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDBConnection();
    
    if ($method === 'GET') {
        // Get user's portfolio
        $stmt = $pdo->prepare("SELECT portfolio_data, stats_data FROM portfolios WHERE user_id = ?");
        $stmt->execute([$userId]);
        $portfolio = $stmt->fetch();
        
        if ($portfolio) {
            echo json_encode([
                'success' => true,
                'portfolio' => json_decode($portfolio['portfolio_data'], true) ?? [],
                'stats' => json_decode($portfolio['stats_data'], true) ?? ['highestValue' => null, 'lowestValue' => null]
            ]);
        } else {
            // Initialize if doesn't exist
            $emptyPortfolio = json_encode([]);
            $emptyStats = json_encode(['highestValue' => null, 'lowestValue' => null]);
            $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $emptyPortfolio, $emptyStats]);
            
            echo json_encode([
                'success' => true,
                'portfolio' => [],
                'stats' => ['highestValue' => null, 'lowestValue' => null]
            ]);
        }
        
    } elseif ($method === 'POST' || $method === 'PUT') {
        // Save user's portfolio
        $input = json_decode(file_get_contents('php://input'), true);
        
        $portfolioData = json_encode($input['portfolio'] ?? []);
        $statsData = json_encode($input['stats'] ?? ['highestValue' => null, 'lowestValue' => null]);
        
        // Check if portfolio exists
        $stmt = $pdo->prepare("SELECT id FROM portfolios WHERE user_id = ?");
        $stmt->execute([$userId]);
        $exists = $stmt->fetch();
        
        if ($exists) {
            // Update existing portfolio
            $stmt = $pdo->prepare("UPDATE portfolios SET portfolio_data = ?, stats_data = ? WHERE user_id = ?");
            $stmt->execute([$portfolioData, $statsData, $userId]);
        } else {
            // Create new portfolio
            $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $portfolioData, $statsData]);
        }
        
        echo json_encode(['success' => true]);
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>

