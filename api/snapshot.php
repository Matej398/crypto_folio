<?php
require_once __DIR__ . '/config.php';

$isCli = php_sapi_name() === 'cli';
$providedToken = null;

if ($isCli) {
    global $argv;
    foreach ($argv as $arg) {
        if (strpos($arg, '--token=') === 0) {
            $providedToken = substr($arg, 8);
            break;
        }
    }
    if (defined('CRON_SECRET') && CRON_SECRET !== 'replace-this-token' && $providedToken && $providedToken !== CRON_SECRET) {
        fwrite(STDERR, "Invalid cron token provided.\n");
        exit(1);
    }
} else {
    $providedToken = $_GET['token'] ?? $_SERVER['HTTP_X_CRON_TOKEN'] ?? null;
    if (!defined('CRON_SECRET') || !$providedToken || $providedToken !== CRON_SECRET) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Invalid cron token']);
        exit;
    }
    header('Content-Type: application/json');
}

$timezone = defined('SNAPSHOT_TIMEZONE') ? SNAPSHOT_TIMEZONE : 'UTC';
$now = new DateTime('now', new DateTimeZone($timezone));
$snapshotDate = $now->format('Y-m-d');

try {
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT p.user_id, p.portfolio_data, u.email FROM portfolios p INNER JOIN users u ON u.id = p.user_id");
    $portfolios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$portfolios) {
        outputResult(['success' => true, 'message' => 'No portfolios found to snapshot.']);
        exit;
    }

    $allCoinIds = [];
    foreach ($portfolios as $portfolioRow) {
        $portfolioData = json_decode($portfolioRow['portfolio_data'], true) ?? [];
        foreach ($portfolioData as $coin) {
            if (!empty($coin['id'])) {
                $allCoinIds[] = $coin['id'];
            }
        }
    }
    $priceMap = fetchCoinPrices(array_unique($allCoinIds));

    $historyResults = [];
    foreach ($portfolios as $portfolioRow) {
        $portfolioData = json_decode($portfolioRow['portfolio_data'], true) ?? [];
        if (empty($portfolioData)) {
            continue;
        }

        $coinsSnapshot = [];
        $totalValue = 0;
        $weightedChange = 0;

        foreach ($portfolioData as $coin) {
            $coinId = $coin['id'] ?? null;
            $quantity = (float)($coin['quantity'] ?? 0);
            if (!$coinId || $quantity <= 0 || !isset($priceMap[$coinId])) {
                continue;
            }

            $priceInfo = $priceMap[$coinId];
            $price = (float)($priceInfo['usd'] ?? 0);
            $changePercent = (float)($priceInfo['usd_24h_change'] ?? 0);
            $value = $price * $quantity;

            $coinsSnapshot[] = [
                'coin_id' => $coinId,
                'symbol' => strtoupper($coin['symbol'] ?? ''),
                'name' => $coin['name'] ?? $coinId,
                'quantity' => $quantity,
                'price' => $price,
                'value' => $value,
                'change' => $changePercent,
                'image' => $coin['image'] ?? null,
            ];

            $totalValue += $value;
            $weightedChange += $value * $changePercent;
        }

        if ($totalValue <= 0 || empty($coinsSnapshot)) {
            continue;
        }

        $portfolioChange = $totalValue > 0 ? $weightedChange / $totalValue : 0;

        $historyId = upsertHistory(
            $pdo,
            (int)$portfolioRow['user_id'],
            $snapshotDate,
            $totalValue,
            $portfolioChange
        );

        storeHistoryCoins($pdo, $historyId, $coinsSnapshot);
        $historyResults[] = [
            'user_id' => (int)$portfolioRow['user_id'],
            'total_value' => $totalValue,
            'change_24h' => $portfolioChange,
            'coin_count' => count($coinsSnapshot),
        ];
    }

    outputResult([
        'success' => true,
        'message' => 'Snapshot completed',
        'snapshot_date' => $snapshotDate,
        'entries' => $historyResults,
    ]);
} catch (Throwable $e) {
    if ($isCli) {
        fwrite(STDERR, "Snapshot failed: " . $e->getMessage() . PHP_EOL);
        exit(1);
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

function fetchCoinPrices(array $coinIds): array {
    if (empty($coinIds)) {
        return [];
    }

    $results = [];
    $chunks = array_chunk($coinIds, 120);
    foreach ($chunks as $chunk) {
        $idsParam = implode('%2C', array_map('rawurlencode', $chunk));
        $url = "https://api.coingecko.com/api/v3/simple/price?ids={$idsParam}&vs_currencies=usd&include_24hr_change=true";
        $response = httpRequest($url);
        if (!$response) {
            continue;
        }
        $data = json_decode($response, true);
        if (!is_array($data)) {
            continue;
        }
        foreach ($data as $coinId => $info) {
            $results[$coinId] = $info;
        }
        // Be polite with CoinGecko
        usleep(250000);
    }
    return $results;
}

function httpRequest(string $url): ?string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'CryptoFolioSnapshot/1.0',
    ]);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        curl_close($ch);
        return null;
    }
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $statusCode === 200 ? $response : null;
}

function upsertHistory(PDO $pdo, int $userId, string $snapshotDate, float $totalValue, float $changePercent): int {
    $stmt = $pdo->prepare("
        INSERT INTO portfolio_history (user_id, snapshot_date, total_value, change_24h, daily_high, daily_low)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            total_value = VALUES(total_value),
            change_24h = VALUES(change_24h),
            daily_high = GREATEST(COALESCE(daily_high, VALUES(daily_high)), VALUES(daily_high)),
            daily_low = LEAST(COALESCE(daily_low, VALUES(daily_low)), VALUES(daily_low)),
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        $userId,
        $snapshotDate,
        round($totalValue, 2),
        round($changePercent, 4),
        round($totalValue, 2),
        round($totalValue, 2),
    ]);

    $historyId = (int)$pdo->lastInsertId();
    if ($historyId === 0) {
        $lookup = $pdo->prepare("SELECT id FROM portfolio_history WHERE user_id = ? AND snapshot_date = ?");
        $lookup->execute([$userId, $snapshotDate]);
        $historyId = (int)$lookup->fetchColumn();
    }
    return $historyId;
}

function storeHistoryCoins(PDO $pdo, int $historyId, array $coins): void {
    $pdo->prepare("DELETE FROM portfolio_history_coins WHERE history_id = ?")->execute([$historyId]);
    $insert = $pdo->prepare("
        INSERT INTO portfolio_history_coins
        (history_id, coin_id, symbol, name, quantity, price_usd, value_usd, change_24h, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($coins as $coin) {
        $insert->execute([
            $historyId,
            $coin['coin_id'],
            $coin['symbol'],
            $coin['name'],
            $coin['quantity'],
            round($coin['price'], 8),
            round($coin['value'], 8),
            round($coin['change'], 4),
            $coin['image'],
        ]);
    }
}

function outputResult(array $payload): void {
    global $isCli;
    if ($isCli) {
        echo json_encode($payload, JSON_PRETTY_PRINT) . PHP_EOL;
    } else {
        echo json_encode($payload);
    }
}

