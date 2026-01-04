<?php
/**
 * Fear & Greed Index Proxy
 * Fetches Fear & Greed Index from multiple sources and returns the most accurate data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Try multiple sources
$sources = [
    'feargreedmeter_html' => function() {
        // Scrape feargreedmeter.com HTML page
        $url = 'https://feargreedmeter.com/fear-and-greed-index';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200 || !$html) {
            return null;
        }
        
        // Extract value from HTML - look for "now":42 pattern
        if (preg_match('/"now":\s*(\d+)/', $html, $matches)) {
            $value = (int)$matches[1];
            if ($value >= 0 && $value <= 100) {
                return [
                    'value' => $value,
                    'source' => 'feargreedmeter.com',
                    'timestamp' => time()
                ];
            }
        }
        
        return null;
    },
    'alternative_me' => function() {
        // Use alternative.me API
        $url = 'https://api.alternative.me/fng/?limit=1';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200 || !$response) {
            return null;
        }
        
        $data = json_decode($response, true);
        if ($data && isset($data['data'][0]['value'])) {
            $value = (int)$data['data'][0]['value'];
            if ($value >= 0 && $value <= 100) {
                return [
                    'value' => $value,
                    'classification' => $data['data'][0]['value_classification'] ?? '',
                    'source' => 'alternative.me',
                    'timestamp' => isset($data['data'][0]['timestamp']) ? (int)$data['data'][0]['timestamp'] : time()
                ];
            }
        }
        
        return null;
    }
];

// Try each source until we get valid data
$result = null;
foreach ($sources as $sourceName => $sourceFunc) {
    try {
        $result = $sourceFunc();
        if ($result !== null) {
            break; // Success, use this source
        }
    } catch (Exception $e) {
        error_log("Fear & Greed Index source {$sourceName} failed: " . $e->getMessage());
        continue;
    }
}

if ($result === null) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'All Fear & Greed Index sources failed'
    ]);
    exit;
}

// Add classification if not present
if (!isset($result['classification'])) {
    $value = $result['value'];
    if ($value >= 0 && $value <= 24) {
        $result['classification'] = 'Extreme Fear';
    } elseif ($value >= 25 && $value <= 44) {
        $result['classification'] = 'Fear';
    } elseif ($value >= 45 && $value <= 55) {
        $result['classification'] = 'Neutral';
    } elseif ($value >= 56 && $value <= 75) {
        $result['classification'] = 'Greed';
    } elseif ($value >= 76 && $value <= 100) {
        $result['classification'] = 'Extreme Greed';
    } else {
        $result['classification'] = 'Unknown';
    }
}

echo json_encode([
    'success' => true,
    'data' => [
        [
            'value' => (string)$result['value'],
            'value_classification' => $result['classification'],
            'timestamp' => (string)$result['timestamp'],
            'source' => $result['source']
        ]
    ]
]);

