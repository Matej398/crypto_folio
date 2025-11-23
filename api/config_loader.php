<?php
// Auto-setup: Creates config.php from config.example.php if it doesn't exist
// This file stays in git, config.php does not

$configFile = __DIR__ . '/config.php';
$exampleFile = __DIR__ . '/config.example.php';

// Auto-create config.php if it doesn't exist
if (!file_exists($configFile) && file_exists($exampleFile)) {
    $exampleContent = file_get_contents($exampleFile);
    
    // Replace with local defaults for easier setup
    $exampleContent = str_replace(
        ["define('DB_USER', 'crypto_portfolio');", "define('DB_PASS', 'PxBeoY5Ei#xB');"],
        ["define('DB_USER', 'root');", "define('DB_PASS', '');"],
        $exampleContent
    );
    
    file_put_contents($configFile, $exampleContent);
}

// Now require the config file (either existing or newly created)
require_once $configFile;
?>



