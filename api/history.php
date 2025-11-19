<?php
require_once __DIR__ . '/config.php';

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 30;
$limit = max(1, min($limit, 90));

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT id, snapshot_date, total_value, change_24h, daily_high, daily_low, created_at
        FROM portfolio_history
        WHERE user_id = ?
        ORDER BY snapshot_date DESC
        LIMIT {$limit}
    ");
    $stmt->execute([$userId]);
    $historyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$historyRows) {
        echo json_encode(['success' => true, 'history' => []]);
        exit;
    }

    $historyIds = array_column($historyRows, 'id');
    $placeholders = implode(',', array_fill(0, count($historyIds), '?'));
    $coinStmt = $pdo->prepare("
        SELECT history_id, coin_id, symbol, name, quantity, price_usd, value_usd, change_24h, image_url
        FROM portfolio_history_coins
        WHERE history_id IN ($placeholders)
        ORDER BY value_usd DESC
    ");
    $coinStmt->execute($historyIds);
    $coinsByHistory = [];
    foreach ($coinStmt as $coinRow) {
        $coinsByHistory[$coinRow['history_id']][] = [
            'coinId' => $coinRow['coin_id'],
            'symbol' => $coinRow['symbol'],
            'name' => $coinRow['name'],
            'quantity' => (float)$coinRow['quantity'],
            'price' => (float)$coinRow['price_usd'],
            'value' => (float)$coinRow['value_usd'],
            'change24h' => (float)$coinRow['change_24h'],
            'image' => $coinRow['image_url'],
        ];
    }

    $history = array_map(function ($row) use ($coinsByHistory) {
        $historyId = $row['id'];
        return [
            'id' => (int)$historyId,
            'date' => $row['snapshot_date'],
            'totalValue' => (float)$row['total_value'],
            'change24h' => (float)$row['change_24h'],
            'dailyHigh' => $row['daily_high'] !== null ? (float)$row['daily_high'] : null,
            'dailyLow' => $row['daily_low'] !== null ? (float)$row['daily_low'] : null,
            'coins' => $coinsByHistory[$historyId] ?? [],
        ];
    }, $historyRows);

    echo json_encode(['success' => true, 'history' => $history]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

