<?php
// src/services/ClotureStateService.php

class ClotureStateService {
    private $filePath;
    private $state;

    public function __construct() {
        $this->filePath = dirname(__DIR__, 2) . '/config/cloture_status.json';
        $this->loadState();
    }

    public function loadState() {
        if (file_exists($this->filePath)) {
            $content = file_get_contents($this->filePath);
            if ($content === false) {
                error_log("ClotureStateService: Erreur de lecture du fichier 'cloture_status.json'.");
                $this->state = $this->getDefaultState();
                return;
            }
            $this->state = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("ClotureStateService: Erreur de décodage JSON dans 'cloture_status.json'. Erreur: " . json_last_error_msg());
                $this->state = $this->getDefaultState();
            }
        } else {
            $this->state = $this->getDefaultState();
            $this->saveState(); // Crée le fichier par défaut s'il n'existe pas
        }
    }

    public function saveState() {
        $json_content = json_encode($this->state, JSON_PRETTY_PRINT);
        if ($json_content === false) {
            error_log("ClotureStateService: Erreur d'encodage JSON. État non sauvegardé.");
            return;
        }

        // Utilisation de LOCK_EX pour verrouiller le fichier pendant l'écriture
        $result = file_put_contents($this->filePath, $json_content, LOCK_EX);
        if ($result === false) {
            error_log("ClotureStateService: Impossible d'écrire dans 'cloture_status.json'. Vérifiez les permissions du dossier config/.");
        }
    }

    public function lockCaisse($caisseId, $lockedBy) {
        $this->loadState();
        foreach ($this->state['locked_caisses'] as $lockedCaisse) {
            if ($lockedCaisse['caisse_id'] == $caisseId) {
                return false; // La caisse est déjà verrouillée
            }
        }
        $this->state['locked_caisses'][] = ['caisse_id' => $caisseId, 'locked_by' => $lockedBy];
        $this->saveState();
        return true;
    }

    public function unlockCaisse($caisseId) {
        $this->loadState();
        $this->state['locked_caisses'] = array_filter($this->state['locked_caisses'], function($lockedCaisse) use ($caisseId) {
            return $lockedCaisse['caisse_id'] != $caisseId;
        });
        $this->saveState();
    }

    public function confirmCaisse($caisseId) {
        $this->loadState();
        if (!in_array($caisseId, $this->state['closed_caisses'])) {
            $this->state['closed_caisses'][] = $caisseId;
            $this->saveState();
        }
    }

    public function isCaisseConfirmed($caisseId) {
        $this->loadState();
        return in_array($caisseId, $this->state['closed_caisses']);
    }

    public function getLockedCaisses() {
        $this->loadState();
        return $this->state['locked_caisses'];
    }
    
    public function getClosedCaisses() {
        $this->loadState();
        return $this->state['closed_caisses'];
    }
    
    public function resetState() {
        $this->state = $this->getDefaultState();
        $this->saveState();
    }

    private function getDefaultState() {
        return [
            'locked_caisses' => [],
            'closed_caisses' => [],
        ];
    }
}
