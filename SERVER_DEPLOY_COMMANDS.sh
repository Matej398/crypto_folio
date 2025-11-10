#!/bin/bash
# Run these commands on your Hostinger server via SSH

# Navigate to your projects directory
cd /var/www/html/codelabhaven/projects/

# Clone the repository (or pull if already exists)
if [ -d "crypto_folio" ]; then
    echo "Directory exists, pulling latest changes..."
    cd crypto_folio
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/Matej398/crypto_folio.git
    cd crypto_folio
fi

# Create config.php with server database credentials
cat > api/config.php << 'EOF'
<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'crypto_portfolio');
define('DB_USER', 'root');
define('DB_PASS', 'PxBeoY5Ei#xB');
define('DB_CHARSET', 'utf8mb4');

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

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>
EOF

# Set correct permissions
chmod 644 api/config.php
chmod 755 api/
chmod 644 api/*.php

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your site should be at: https://yourdomain.com/codelabhaven/projects/crypto_folio/"
echo "Or configure your domain to point to this directory"
echo ""
echo "Test: https://yourdomain.com/codelabhaven/projects/crypto_folio/api/auth.php?action=check"

