<?php
// src/services/VersionService.php

/**
 * Gère la communication avec l'API de GitHub pour vérifier les versions et récupérer le changelog.
 */
class VersionService {
    private $cacheDir;
    private $repoApiUrl = 'https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases';

    public function __construct() {
        $this->cacheDir = dirname(__DIR__, 2) . '/cache';
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0755, true);
        }
    }

    /**
     * Récupère les informations de la dernière release, en utilisant un cache.
     * @param bool $force Pour ignorer le cache et forcer un appel à l'API.
     * @return array
     */
    public function getLatestReleaseInfo($force = false) {
        $cacheFile = $this->cacheDir . '/github_release.json';
        $cacheLifetime = 3600; // 1 heure
        $local_version = $this->getLocalVersion();

        if (!$force && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheLifetime)) {
            $cachedData = json_decode(file_get_contents($cacheFile), true);
            $remote_version = $cachedData['remote_version'] ?? $local_version;
            return array_merge($cachedData, [
                'local_version' => $local_version,
                'update_available' => version_compare(ltrim($local_version, 'v'), ltrim($remote_version, 'v'), '<')
            ]);
        }

        $response = $this->fetchFromApi('/latest');
        
        if ($response['success']) {
            $data = $response['data'];
            $remote_version = $data['tag_name'] ?? null;
            if ($remote_version) {
                $responseData = [
                    'remote_version' => $remote_version,
                    'release_notes' => $data['body'] ?? 'Notes de version non disponibles.',
                    'release_url' => $data['html_url'] ?? '#',
                    'formatted_release_date' => isset($data['published_at']) ? format_date_fr($data['published_at']) : 'N/A'
                ];
                file_put_contents($cacheFile, json_encode($responseData), LOCK_EX);
                return array_merge($responseData, [
                    'local_version' => $local_version,
                    'update_available' => version_compare(ltrim($local_version, 'v'), ltrim($remote_version, 'v'), '<')
                ]);
            }
        }
        
        $fallback = $this->getFallbackResponse($local_version);
        file_put_contents($cacheFile, json_encode($fallback), LOCK_EX);
        return $fallback;
    }

    /**
     * Récupère toutes les releases pour la page Changelog, en utilisant un cache.
     * @param bool $force Pour ignorer le cache et forcer un appel à l'API.
     * @return array
     */
    public function getAllReleases($force = false) {
        $cacheFile = $this->cacheDir . '/github_releases_full.json';
        $cacheLifetime = 3600;

        if (!$force && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheLifetime)) {
            return json_decode(file_get_contents($cacheFile), true);
        }

        $response = $this->fetchFromApi('', ['Accept: application/vnd.github.html+json']);

        if ($response['success']) {
            $releases = $response['data'];
            file_put_contents($cacheFile, json_encode($releases), LOCK_EX);
            return $releases;
        }

        $error_message = "<p>Impossible de contacter GitHub pour récupérer le journal des modifications.</p>";
        $fallback = [['tag_name' => 'Erreur', 'published_at' => date('c'), 'body_html' => $error_message]];
        file_put_contents($cacheFile, json_encode($fallback), LOCK_EX);
        return $fallback;
    }
    
    /**
     * CORRECTION : La méthode est maintenant 'protected' au lieu de 'private'
     * pour permettre aux tests de la surcharger (mocking).
     */
    protected function fetchFromApi($endpoint, $headers = []) {
        if (!function_exists('curl_init')) return ['success' => false];
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $this->repoApiUrl . $endpoint,
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_USERAGENT => 'Comptage-Caisse-App',
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'success' => $http_code == 200,
            'data' => json_decode($response, true)
        ];
    }

    public function getLocalVersion() {
        $version_file = dirname(__DIR__, 2) . '/VERSION';
        return file_exists($version_file) ? trim(file_get_contents($version_file)) : '0.0.0';
    }

    private function getFallbackResponse($local_version) {
        return [
            'local_version' => $local_version,
            'remote_version' => $local_version,
            'update_available' => false,
            'release_notes' => 'Impossible de vérifier les mises à jour pour le moment.',
            'release_url' => '#',
            'formatted_release_date' => 'N/A',
            'error' => 'API indisponible'
        ];
    }
}
