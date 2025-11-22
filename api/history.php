<?php
require_once __DIR__ . '/config.php';

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

// Handle POST request to save notes
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $date = $input['date'] ?? null;
    $notes = $input['notes'] ?? null;
    
    if (!$date) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Date is required']);
        exit;
    }
    
    try {
        $pdo = getDBConnection();
        
        // Check if history entry exists for this date
        $checkStmt = $pdo->prepare("SELECT id FROM portfolio_history WHERE user_id = :user_id AND snapshot_date = :date");
        $checkStmt->execute(['user_id' => $userId, 'date' => $date]);
        $historyId = $checkStmt->fetchColumn();
        
        if ($historyId) {
            // Update existing entry
            $updateStmt = $pdo->prepare("UPDATE portfolio_history SET notes = :notes WHERE id = :id AND user_id = :user_id");
            $updateStmt->execute([
                'notes' => $notes ? trim($notes) : null,
                'id' => $historyId,
                'user_id' => $userId
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'History entry not found for this date']);
            exit;
        }
        
        echo json_encode(['success' => true, 'message' => 'Notes saved successfully']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Handle GET request to fetch history
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = max(1, min((int)($_GET['per_page'] ?? 10), 50));
$offset = ($page - 1) * $perPage;

try {
    $pdo = getDBConnection();
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM portfolio_history WHERE user_id = :user_id");
    $countStmt->execute(['user_id' => $userId]);
    $total = (int)$countStmt->fetchColumn();

    if ($total === 0) {
        echo json_encode([
            'success' => true,
            'history' => [],
            'page' => $page,
            'perPage' => $perPage,
            'total' => 0,
        ]);
        exit;
    }

    if ($offset >= $total) {
        $page = (int)ceil($total / $perPage);
        $offset = max(0, ($page - 1) * $perPage);
    }

    $stmt = $pdo->prepare("
        SELECT id, snapshot_date, total_value, change_24h, daily_high, daily_low, notes, fear_greed_index, created_at
        FROM portfolio_history
        WHERE user_id = :user_id
        ORDER BY snapshot_date DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $historyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $historyIds = array_column($historyRows, 'id');
    $placeholders = implode(',', array_fill(0, count($historyIds), '?'));
    $coinsByHistory = [];
    if (!empty($historyIds)) {
        $coinStmt = $pdo->prepare("
            SELECT history_id, coin_id, symbol, name, quantity, price_usd, value_usd, change_24h, image_url
            FROM portfolio_history_coins
            WHERE history_id IN ($placeholders)
            ORDER BY value_usd DESC
        ");
        $coinStmt->execute($historyIds);
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
            'notes' => $row['notes'] ?? null,
            'fearGreedIndex' => $row['fear_greed_index'] !== null ? (int)$row['fear_greed_index'] : null,
            'coins' => $coinsByHistory[$historyId] ?? [],
        ];
    }, $historyRows);

    echo json_encode([
        'success' => true,
        'history' => $history,
        'page' => $page,
        'perPage' => $perPage,
        'total' => $total,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

