<?php
require_once 'config_loader.php';

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
        // Get user's portfolio - try with api_usage_data first, fallback if column doesn't exist
        try {
            $stmt = $pdo->prepare("SELECT portfolio_data, stats_data, api_usage_data FROM portfolios WHERE user_id = ?");
            $stmt->execute([$userId]);
            $portfolio = $stmt->fetch();
            $hasApiUsageColumn = true;
        } catch (PDOException $e) {
            // Column doesn't exist, try without it
            $stmt = $pdo->prepare("SELECT portfolio_data, stats_data FROM portfolios WHERE user_id = ?");
            $stmt->execute([$userId]);
            $portfolio = $stmt->fetch();
            $hasApiUsageColumn = false;
        }
        
        if ($portfolio) {
            $apiUsage = [];
            if ($hasApiUsageColumn && isset($portfolio['api_usage_data'])) {
                $apiUsage = json_decode($portfolio['api_usage_data'], true) ?? [];
            }
            
            echo json_encode([
                'success' => true,
                'portfolio' => json_decode($portfolio['portfolio_data'], true) ?? [],
                'stats' => json_decode($portfolio['stats_data'], true) ?? ['highestValue' => null, 'lowestValue' => null],
                'apiUsage' => $apiUsage
            ]);
        } else {
            // Initialize if doesn't exist - try with api_usage_data, fallback if column doesn't exist
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
            
            echo json_encode([
                'success' => true,
                'portfolio' => [],
                'stats' => ['highestValue' => null, 'lowestValue' => null],
                'apiUsage' => []
            ]);
        }
        
    } elseif ($method === 'POST' || $method === 'PUT') {
        // Save user's portfolio
        $input = json_decode(file_get_contents('php://input'), true);
        
        $portfolioData = json_encode($input['portfolio'] ?? []);
        $statsData = json_encode($input['stats'] ?? ['highestValue' => null, 'lowestValue' => null]);
        $apiUsageData = json_encode($input['apiUsage'] ?? []);
        
        // Check if portfolio exists
        $stmt = $pdo->prepare("SELECT id FROM portfolios WHERE user_id = ?");
        $stmt->execute([$userId]);
        $exists = $stmt->fetch();
        
        // Check if api_usage_data column exists
        try {
            $testStmt = $pdo->prepare("SELECT api_usage_data FROM portfolios LIMIT 1");
            $testStmt->execute();
            $hasApiUsageColumn = true;
        } catch (PDOException $e) {
            $hasApiUsageColumn = false;
        }
        
        if ($exists) {
            // Update existing portfolio
            if ($hasApiUsageColumn) {
                $stmt = $pdo->prepare("UPDATE portfolios SET portfolio_data = ?, stats_data = ?, api_usage_data = ? WHERE user_id = ?");
                $stmt->execute([$portfolioData, $statsData, $apiUsageData, $userId]);
            } else {
                $stmt = $pdo->prepare("UPDATE portfolios SET portfolio_data = ?, stats_data = ? WHERE user_id = ?");
                $stmt->execute([$portfolioData, $statsData, $userId]);
            }
        } else {
            // Create new portfolio
            if ($hasApiUsageColumn) {
                $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data, api_usage_data) VALUES (?, ?, ?, ?)");
                $stmt->execute([$userId, $portfolioData, $statsData, $apiUsageData]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $portfolioData, $statsData]);
            }
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

