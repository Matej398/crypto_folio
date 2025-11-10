# Deploy to Server - Quick Commands

## Your Server Path
`/var/www/html/codelabhaven/projects/`

## Commands to Run on Server (via SSH)

Copy and paste these commands one by one:

```bash
# 1. Go to your projects directory
cd /var/www/html/codelabhaven/projects/

# 2. Clone the repository
git clone https://github.com/Matej398/crypto_folio.git

# 3. Go into the project
cd crypto_folio

# 4. Create config.php with your database credentials
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

# 5. Set permissions
chmod 644 api/config.php
```

## After Running Commands

Your site will be at:
- `https://yourdomain.com/codelabhaven/projects/crypto_folio/`

Or if you want it at the root:
- Move files from `crypto_folio/` to `public_html/` or configure your domain

## Test It

Visit: `https://yourdomain.com/codelabhaven/projects/crypto_folio/`

Login with:
- Email: `admin@portfolio.com`
- Password: `portfolio123`

