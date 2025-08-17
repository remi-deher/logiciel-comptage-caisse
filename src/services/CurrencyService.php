<?php
// src/services/CurrencyService.php

/**
 * Gère la lecture et l'écriture du fichier de devises JSON.
 */
class CurrencyService {
    private $currencyPath;

    public function __construct() {
        $this->currencyPath = dirname(__DIR__, 2) . '/config/currencies.json';
    }

    /**
     * Lit le fichier de devises et le renvoie sous forme de tableau associatif.
     * @return array
     */
    public function getCurrenciesData() {
        if (!file_exists($this->currencyPath)) {
            return [];
        }
        $content = file_get_contents($this->currencyPath);
        return json_decode($content, true) ?? [];
    }
    
    /**
     * Met à jour les dénominations pour une devise donnée.
     * @param string $currencyCode
     * @param array $newDenominations
     * @return bool
     */
    public function updateCurrency($currencyCode, $newDenominations, $newMinToKeep) {
        $data = $this->getCurrenciesData();
        if (!isset($data[$currencyCode])) {
            return false;
        }

        $data[$currencyCode]['billets'] = $newDenominations['billets'];
        $data[$currencyCode]['pieces'] = $newDenominations['pieces'];
        $data[$currencyCode]['min_to_keep'] = $newMinToKeep;
        
        return $this->saveCurrenciesData($data);
    }
    
    /**
     * Sauvegarde toutes les données de devises dans le fichier JSON.
     * @param array $data
     * @return bool
     */
    private function saveCurrenciesData($data) {
        if (!is_writable($this->currencyPath)) {
            return false;
        }
        $json_content = json_encode($data, JSON_PRETTY_PRINT);
        return file_put_contents($this->currencyPath, $json_content, LOCK_EX) !== false;
    }
}
