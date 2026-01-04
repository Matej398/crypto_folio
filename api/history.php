<?php
require_once __DIR__ . '/config_loader.php';

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

// Handle POST request to add a new note
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $date = $input['date'] ?? null;
    $noteText = $input['note'] ?? null;
    
    if (!$date) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Date is required']);
        exit;
    }
    
    if (!$noteText || trim($noteText) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Note text is required']);
        exit;
    }
    
    try {
        $pdo = getDBConnection();
        
        // Check if portfolio_history_notes table exists
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'portfolio_history_notes'");
        if ($tableCheck->rowCount() === 0) {
            http_response_code(500);
            echo json_encode([
                'success' => false, 
                'error' => 'Database table portfolio_history_notes does not exist. Please run the migration script.'
            ]);
            exit;
        }
        
        // Check if history entry exists for this date
        $checkStmt = $pdo->prepare("SELECT id FROM portfolio_history WHERE user_id = :user_id AND snapshot_date = :date");
        $checkStmt->execute(['user_id' => $userId, 'date' => $date]);
        $historyId = $checkStmt->fetchColumn();
        
        // If history entry doesn't exist, create a minimal one
        if (!$historyId) {
            // Get user's current portfolio value to create a basic history entry
            $portfolioStmt = $pdo->prepare("SELECT portfolio_data FROM portfolios WHERE user_id = :user_id");
            $portfolioStmt->execute(['user_id' => $userId]);
            $portfolioData = $portfolioStmt->fetchColumn();
            
            $totalValue = 0;
            if ($portfolioData) {
                $portfolio = json_decode($portfolioData, true);
                if (is_array($portfolio)) {
                    // Calculate a basic total value (this is a fallback, ideally should use snapshot)
                    foreach ($portfolio as $coin) {
                        $quantity = (float)($coin['quantity'] ?? 0);
                        $price = (float)($coin['price'] ?? 0);
                        $totalValue += $quantity * $price;
                    }
                }
            }
            
            // Create a minimal history entry
            $createStmt = $pdo->prepare("
                INSERT INTO portfolio_history (user_id, snapshot_date, total_value, change_24h, daily_high, daily_low)
                VALUES (:user_id, :date, :total_value, 0, :total_value, :total_value)
            ");
            $createStmt->execute([
                'user_id' => $userId,
                'date' => $date,
                'total_value' => max(0, round($totalValue, 2))
            ]);
            $historyId = (int)$pdo->lastInsertId();
            
            if (!$historyId) {
                // If insert failed, try to get the ID (in case of duplicate key)
                $lookupStmt = $pdo->prepare("SELECT id FROM portfolio_history WHERE user_id = :user_id AND snapshot_date = :date");
                $lookupStmt->execute(['user_id' => $userId, 'date' => $date]);
                $historyId = (int)$lookupStmt->fetchColumn();
            }
        }
        
        if (!$historyId) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to create or find history entry for this date']);
            exit;
        }
        
        // Insert new note
        $insertStmt = $pdo->prepare("INSERT INTO portfolio_history_notes (history_id, note_text) VALUES (:history_id, :note_text)");
        $insertStmt->execute([
            'history_id' => $historyId,
            'note_text' => trim($noteText)
        ]);
        
        $noteId = (int)$pdo->lastInsertId();
        
        if ($noteId === 0) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to create note. Please check database connection.']);
            exit;
        }
        
        // Fetch the created note with timestamp
        $fetchStmt = $pdo->prepare("SELECT id, note_text, created_at FROM portfolio_history_notes WHERE id = :id");
        $fetchStmt->execute(['id' => $noteId]);
        $note = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$note) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Note was created but could not be retrieved.']);
            exit;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Note added successfully',
            'note' => [
                'id' => (int)$note['id'],
                'text' => $note['note_text'],
                'createdAt' => $note['created_at']
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        $errorMsg = $e->getMessage();
        // Check for common database errors
        if (strpos($errorMsg, "doesn't exist") !== false || strpos($errorMsg, "Unknown table") !== false) {
            $errorMsg = 'Database table portfolio_history_notes does not exist. Please run the migration script.';
        }
        echo json_encode(['success' => false, 'error' => $errorMsg]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Handle PUT request to update a note
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    $noteId = isset($input['noteId']) ? (int)$input['noteId'] : null;
    $noteText = $input['note'] ?? null;
    
    if (!$noteId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Note ID is required']);
        exit;
    }
    
    if (!$noteText || trim($noteText) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Note text is required']);
        exit;
    }
    
    try {
        $pdo = getDBConnection();
        
        // Verify the note belongs to a history entry owned by this user
        $verifyStmt = $pdo->prepare("
            SELECT phn.id 
            FROM portfolio_history_notes phn
            INNER JOIN portfolio_history ph ON ph.id = phn.history_id
            WHERE phn.id = :note_id AND ph.user_id = :user_id
        ");
        $verifyStmt->execute(['note_id' => $noteId, 'user_id' => $userId]);
        
        if (!$verifyStmt->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Note not found or access denied']);
            exit;
        }
        
        // Update the note
        $updateStmt = $pdo->prepare("UPDATE portfolio_history_notes SET note_text = :note_text WHERE id = :note_id");
        $updateStmt->execute([
            'note_text' => trim($noteText),
            'note_id' => $noteId
        ]);
        
        // Fetch the updated note
        $fetchStmt = $pdo->prepare("SELECT id, note_text, created_at FROM portfolio_history_notes WHERE id = :id");
        $fetchStmt->execute(['id' => $noteId]);
        $note = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'message' => 'Note updated successfully',
            'note' => [
                'id' => (int)$note['id'],
                'text' => $note['note_text'],
                'createdAt' => $note['created_at']
            ]
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Handle DELETE request to remove a note
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $noteId = isset($input['noteId']) ? (int)$input['noteId'] : null;
    
    if (!$noteId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Note ID is required']);
        exit;
    }
    
    try {
        $pdo = getDBConnection();
        
        // Verify the note belongs to a history entry owned by this user
        $verifyStmt = $pdo->prepare("
            SELECT phn.id 
            FROM portfolio_history_notes phn
            INNER JOIN portfolio_history ph ON ph.id = phn.history_id
            WHERE phn.id = :note_id AND ph.user_id = :user_id
        ");
        $verifyStmt->execute(['note_id' => $noteId, 'user_id' => $userId]);
        
        if (!$verifyStmt->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Note not found or access denied']);
            exit;
        }
        
        // Delete the note
        $deleteStmt = $pdo->prepare("DELETE FROM portfolio_history_notes WHERE id = :note_id");
        $deleteStmt->execute(['note_id' => $noteId]);
        
        echo json_encode(['success' => true, 'message' => 'Note deleted successfully']);
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
    $notesByHistory = [];
    
    if (!empty($historyIds)) {
        // Fetch coins
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
        
        // Fetch notes from new table
        $notesStmt = $pdo->prepare("
            SELECT history_id, id, note_text, created_at
            FROM portfolio_history_notes
            WHERE history_id IN ($placeholders)
            ORDER BY created_at DESC
        ");
        $notesStmt->execute($historyIds);
        foreach ($notesStmt as $noteRow) {
            $notesByHistory[$noteRow['history_id']][] = [
                'id' => (int)$noteRow['id'],
                'text' => $noteRow['note_text'],
                'createdAt' => $noteRow['created_at'],
            ];
        }
    }

    // Migrate old notes from notes column to new table
    foreach ($historyRows as $row) {
        $historyId = $row['id'];
        $oldNotes = $row['notes'] ?? null;
        
        // Only migrate if old note exists, no new notes exist, and we haven't already migrated
        if ($oldNotes && trim($oldNotes) !== '' && empty($notesByHistory[$historyId])) {
            // Double-check that no notes exist in the new table for this history entry
            $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM portfolio_history_notes WHERE history_id = ?");
            $checkStmt->execute([$historyId]);
            $existingNotesCount = (int)$checkStmt->fetchColumn();
            
            if ($existingNotesCount === 0) {
                try {
                    $migrateStmt = $pdo->prepare("INSERT INTO portfolio_history_notes (history_id, note_text, created_at) VALUES (:history_id, :note_text, :created_at)");
                    $migrateStmt->execute([
                        'history_id' => $historyId,
                        'note_text' => trim($oldNotes),
                        'created_at' => $row['created_at'] ?? date('Y-m-d H:i:s')
                    ]);
                    $migratedNoteId = (int)$pdo->lastInsertId();
                    
                    // Clear the old notes column to prevent re-migration
                    $clearStmt = $pdo->prepare("UPDATE portfolio_history SET notes = NULL WHERE id = ?");
                    $clearStmt->execute([$historyId]);
                    
                    // Add migrated note to the response
                    $notesByHistory[$historyId] = [[
                        'id' => $migratedNoteId,
                        'text' => trim($oldNotes),
                        'createdAt' => $row['created_at'] ?? date('Y-m-d H:i:s')
                    ]];
                } catch (Throwable $e) {
                    // If migration fails, just continue - don't break the request
                    error_log("Failed to migrate old note for history_id {$historyId}: " . $e->getMessage());
                }
            }
        }
    }

    $history = array_map(function ($row) use ($coinsByHistory, $notesByHistory) {
        $historyId = $row['id'];
        return [
            'id' => (int)$historyId,
            'date' => $row['snapshot_date'],
            'totalValue' => (float)$row['total_value'],
            'change24h' => (float)$row['change_24h'],
            'dailyHigh' => $row['daily_high'] !== null ? (float)$row['daily_high'] : null,
            'dailyLow' => $row['daily_low'] !== null ? (float)$row['daily_low'] : null,
            'notes' => $notesByHistory[$historyId] ?? [],
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

