<?php
/**
 * Create Test User Script
 * Run this file once to create a test user account
 * Access via: http://localhost:8000/api/create_test_user.php
 * Then delete this file for security!
 */

require_once 'config.php';

// Test user credentials
$testEmail = 'test@example.com';
$testPassword = 'test123';

try {
    $pdo = getDBConnection();
    
    // Check if user already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$testEmail]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        echo "<h2>Test user already exists!</h2>";
        echo "<p><strong>Email:</strong> {$testEmail}</p>";
        echo "<p><strong>Password:</strong> {$testPassword}</p>";
        echo "<p>You can use these credentials to log in.</p>";
        exit;
    }
    
    // Create test user
    $passwordHash = password_hash($testPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
    $stmt->execute([$testEmail, $passwordHash]);
    
    $userId = $pdo->lastInsertId();
    
    // Initialize empty portfolio
    $emptyPortfolio = json_encode([]);
    $emptyStats = json_encode(['highestValue' => null, 'lowestValue' => null]);
    $stmt = $pdo->prepare("INSERT INTO portfolios (user_id, portfolio_data, stats_data) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $emptyPortfolio, $emptyStats]);
    
    echo "<h2>Test user created successfully!</h2>";
    echo "<p><strong>Email:</strong> {$testEmail}</p>";
    echo "<p><strong>Password:</strong> {$testPassword}</p>";
    echo "<p>You can now use these credentials to log in.</p>";
    echo "<p style='color: red; margin-top: 20px;'><strong>IMPORTANT:</strong> Delete this file (create_test_user.php) after testing for security!</p>";
    
} catch (PDOException $e) {
    echo "<h2>Error creating test user</h2>";
    echo "<p>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Make sure your database is set up correctly in config.php</p>";
}
?>

