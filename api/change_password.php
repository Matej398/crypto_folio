<?php
/**
 * Change Password Script
 * Use this to change your login password
 * Access via: http://localhost:8000/api/change_password.php
 * 
 * SECURITY: Delete this file after changing password in production!
 */

require_once 'config.php';

// Default email (same as in auth.php)
define('DEFAULT_EMAIL', 'admin@portfolio.com');

// Get new password from URL parameter or form
$newPassword = $_GET['password'] ?? $_POST['password'] ?? '';

if (empty($newPassword)) {
    // Show form
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Change Password</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
            .error { color: red; }
            .success { color: green; }
        </style>
    </head>
    <body>
        <h2>Change Portfolio Password</h2>
        <form method="POST">
            <label>New Password:</label>
            <input type="password" name="password" required minlength="6" placeholder="Enter new password">
            <button type="submit">Change Password</button>
        </form>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
            <strong>Current email:</strong> <?php echo DEFAULT_EMAIL; ?><br>
            <strong>Note:</strong> Delete this file after changing password for security!
        </p>
    </body>
    </html>
    <?php
    exit;
}

// Validate password
if (strlen($newPassword) < 6) {
    die("<div class='error'>Password must be at least 6 characters long.</div>");
}

try {
    $pdo = getDBConnection();
    
    // Get user
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([DEFAULT_EMAIL]);
    $user = $stmt->fetch();
    
    if (!$user) {
        die("<div class='error'>User not found. Make sure you've logged in at least once.</div>");
    }
    
    // Update password
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    $stmt->execute([$passwordHash, DEFAULT_EMAIL]);
    
    echo "<div class='success'><h2>Password changed successfully!</h2>";
    echo "<p>Your new password is: <strong>" . htmlspecialchars($newPassword) . "</strong></p>";
    echo "<p style='color: red;'><strong>IMPORTANT:</strong> Delete this file (change_password.php) now for security!</p></div>";
    
} catch (PDOException $e) {
    echo "<div class='error'>Error: " . htmlspecialchars($e->getMessage()) . "</div>";
}
?>

