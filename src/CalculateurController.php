<?php
// Fichier : src/CalculateurController.php

require_once __DIR__ . '/services/VersionService.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/ClotureStateService.php';
require_once __DIR__ . '/services/BackupService.php';
require_once __DIR__ . '/Repository/ComptageRepository.php';

class CalculateurController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $versionService;
    private $clotureStateService;
    private $backupService;
    private $comptageRepository;

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse_obsolete, $comptageRepository, BackupService $backupService = null) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->versionService = new VersionService();
        $this->clotureStateService = new ClotureStateService($pdo);
        $this->comptageRepository = $comptageRepository;
        // Si aucun service n'est fourni lors de l'instanciation, on en crée un par défaut.
        $this->backupService = $backupService ?? new BackupService();
    }

    public function getInitialData() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        
        $stmt_auto = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
        $autosave = $stmt_auto->fetch();
        $stmt_j1 = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages WHERE nom_comptage LIKE 'Fond de caisse J+1%' ORDER BY id DESC LIMIT 1");
        $fond_j1 = $stmt_j1->fetch();

        $last_comptage = null;
        if ($autosave && $fond_j1) {
            $last_comptage = ($autosave['id'] > $fond_j1['id']) ? $autosave : $fond_j1;
        } elseif ($autosave) {
            $last_comptage = $autosave;
        } elseif ($fond_j1) {
            $last_comptage = $fond_j1;
        } else {
            $stmt_last = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages ORDER BY id DESC LIMIT 1");
            $last_comptage = $stmt_last->fetch();
        }

        if ($last_comptage) {
            $data = $this->comptageRepository->findDetailsById($last_comptage['id']);
            $data['nom_comptage'] = $last_comptage['nom_comptage'];
            $data['explication'] = $last_comptage['explication'];
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            echo json_encode(['success' => false, 'data' => null]);
        }
    }

    public function cloture() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        try {
            $caisse_id_a_cloturer = intval($_POST['caisse_id_a_cloturer'] ?? 0);
            if ($caisse_id_a_cloturer <= 0) {
                throw new Exception("ID de caisse à clôturer invalide.");
            }
    
            $caisse_data = $_POST['caisse'][$caisse_id_a_cloturer] ?? [];
            if (empty($caisse_data)) {
                throw new Exception("Données manquantes pour la caisse {$caisse_id_a_cloturer}.");
            }
            
            $caisse_data['retraits'] = $_POST['retraits'][$caisse_id_a_cloturer] ?? [];
            $data_json = json_encode($caisse_data);
    
            $this->clotureStateService->confirmCaisse($caisse_id_a_cloturer, $data_json);
    
            echo json_encode(['success' => true, 'message' => 'La caisse a été clôturée avec succès.']);
    
        } catch (Exception $e) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            error_log("Erreur de clôture: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture : ' . $e->getMessage()]);
        }
    }
    
    public function cloture_generale() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }

        $allCaisseIds = array_keys($this->noms_caisses);
        $closedCaissesIds = $this->clotureStateService->getClosedCaisses();

        if (count($allCaisseIds) !== count($closedCaissesIds)) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(400); }
            echo json_encode(['success' => false, 'message' => "Action impossible : Toutes les caisses ne sont pas encore clôturées."]);
            return;
        }

        $backupResult = $this->backupService->createBackup();
        if (!$backupResult['success']) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            echo json_encode(['success' => false, 'message' => $backupResult['message']]);
            return;
        }
        
        try {
            $this->pdo->beginTransaction();
            $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
            
            $now = date('Y-m-d H:i:s');
            $date_for_name = date('d/m/Y H:i');
            
            $stmt_cg = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_cg->execute(["Clôture Générale du " . $date_for_name, "Comptage final consolidé de la journée.", $now]);
            $comptage_id_cg = $this->pdo->lastInsertId();

            $stmt_j1 = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_j1->execute(["Fond de caisse J+1 du " . $date_for_name, "Préparation pour la journée suivante.", $now]);
            $comptage_id_j1 = $this->pdo->lastInsertId();

            foreach ($allCaisseIds as $caisse_id) {
                $cloture_data = $this->clotureStateService->getClosedCaisseData($caisse_id);
                if (!$cloture_data) continue;

                $detail_id_cg = $this->insertComptageDetail($comptage_id_cg, $caisse_id, $cloture_data);
                $this->copyDetailsToNewRecord($detail_id_cg, $cloture_data);

                $all_denoms_map = array_merge($this->denominations['billets'] ?? [], $this->denominations['pieces'] ?? []);
                $nouveau_fond_de_caisse = 0;
                $denominations_j1 = [];

                if(isset($cloture_data['denominations'])){
                    foreach ($cloture_data['denominations'] as $denom_name => $quantity) {
                        $quantite_retiree = $cloture_data['retraits'][$denom_name] ?? 0;
                        $quantite_restante = intval($quantity) - intval($quantite_retiree);
                        
                        if ($quantite_restante > 0) {
                            $denominations_j1[$denom_name] = $quantite_restante;
                            $nouveau_fond_de_caisse += $quantite_restante * ($all_denoms_map[$denom_name] ?? 0);
                        }
                    }
                }
                
                $data_j1 = ['fond_de_caisse' => $nouveau_fond_de_caisse, 'denominations' => $denominations_j1];
                $detail_id_j1 = $this->insertComptageDetail($comptage_id_j1, $caisse_id, $data_j1);
                $this->copyDetailsToNewRecord($detail_id_j1, $data_j1);
            }

            $this->clotureStateService->resetState();
            
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => "Clôture générale réussie ! Le fond de caisse pour le jour suivant a été préparé."]);

        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            error_log("Erreur de clôture générale: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture générale : ' . $e->getMessage()]);
        }
    }

    private function insertComptageDetail($comptage_id, $caisse_id, $data) {
        $stmt_details = $this->pdo->prepare(
            "INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession, retrocession_cb, retrocession_cheques) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt_details->execute([
            $comptage_id, $caisse_id,
            get_numeric_value($data, 'fond_de_caisse'),
            get_numeric_value($data, 'ventes_especes'),
            get_numeric_value($data, 'ventes_cb'),
            get_numeric_value($data, 'ventes_cheques'),
            get_numeric_value($data, 'retrocession'),
            get_numeric_value($data, 'retrocession_cb'),
            get_numeric_value($data, 'retrocession_cheques')
        ]);
        return $this->pdo->lastInsertId();
    }

    private function copyDetailsToNewRecord($new_detail_id, $source_data) {
        if (!empty($source_data['denominations'])) {
            foreach ($source_data['denominations'] as $denom_name => $quantity) {
                if (intval($quantity) > 0) {
                    $stmt = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                    $stmt->execute([$new_detail_id, $denom_name, intval($quantity)]);
                }
            }
        }
        if (!empty($source_data['tpe'])) {
            foreach ($source_data['tpe'] as $terminal_id => $releves) {
                if(is_array($releves)) {
                    foreach ($releves as $releve) {
                        $stmt = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant, heure_releve) VALUES (?, ?, ?, ?)");
                        $heure_releve_raw = $releve['heure'] ?? null;
                        $heure_releve = (in_array($heure_releve_raw, [null, 'undefined', 'null', ''], true)) ? null : $heure_releve_raw;
                        $stmt->execute([$new_detail_id, $terminal_id, get_numeric_value($releve, 'montant'), $heure_releve]);
                    }
                }
            }
        }
        if (!empty($source_data['cheques'])) {
            foreach ($source_data['cheques'] as $cheque) {
                $stmt = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant, commentaire) VALUES (?, ?, ?)");
                $stmt->execute([$new_detail_id, get_numeric_value($cheque, 'montant'), $cheque['commentaire'] ?? '']);
            }
        }
        if (!empty($source_data['retraits'])) {
            foreach ($source_data['retraits'] as $denom_name => $quantity) {
                 if (intval($quantity) > 0) {
                    $stmt = $this->pdo->prepare("INSERT INTO comptage_retraits (comptage_detail_id, denomination_nom, quantite_retiree) VALUES (?, ?, ?)");
                    $stmt->execute([$new_detail_id, $denom_name, intval($quantity)]);
                 }
            }
        }
    }
    
    public function save() { $this->handleSave(false); }
    public function autosave() { $this->handleSave(true); }

    private function handleSave($is_autosave) {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        try {
            $this->pdo->beginTransaction();
            $nom_comptage = trim($_POST['nom_comptage'] ?? '');
            if ($is_autosave) {
                $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
                $nom_comptage = "Sauvegarde auto du " . date('Y-m-d H:i:s');
            } else {
                $nom_comptage = empty($nom_comptage) ? "Comptage du " . date('Y-m-d H:i:s') : $nom_comptage;
            }
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$nom_comptage, trim($_POST['explication'] ?? ''), date('Y-m-d H:i:s')]);
            $comptage_id = $this->pdo->lastInsertId();
            
            foreach ($_POST['caisse'] as $caisse_id => $caisse_data) {
                if (isset($this->noms_caisses[$caisse_id])) {
                   $detail_id = $this->insertComptageDetail($comptage_id, $caisse_id, $caisse_data);
                   $this->copyDetailsToNewRecord($detail_id, $caisse_data);
                }
            }
            
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => "Sauvegarde réussie !"]);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            error_log("Erreur de sauvegarde: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur côté serveur lors de la sauvegarde : ' . $e->getMessage()]);
        }
    }

    public function loadFromHistory() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        $comptage_id_to_load = intval($_POST['comptage_id'] ?? 0);
        if ($comptage_id_to_load <= 0) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(400); }
            echo json_encode(['success' => false, 'message' => 'ID de comptage invalide.']);
            return;
        }
        try {
            $stmt_name = $this->pdo->prepare("SELECT nom_comptage, explication FROM comptages WHERE id = ?");
            $stmt_name->execute([$comptage_id_to_load]);
            $original_comptage = $stmt_name->fetch(PDO::FETCH_ASSOC);

            if (!$original_comptage) {
                throw new Exception("Comptage original non trouvé.");
            }
            $data_to_load = $this->comptageRepository->findDetailsById($comptage_id_to_load);
            
            $this->pdo->beginTransaction();
            $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
            $new_nom_comptage = "Sauvegarde auto du " . date('Y-m-d H:i:s');
            $new_explication = "Chargé depuis le comptage '" . $original_comptage['nom_comptage'] . "'";
            
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$new_nom_comptage, $new_explication, date('Y-m-d H:i:s')]);
            $new_comptage_id = $this->pdo->lastInsertId();

            foreach ($data_to_load as $caisse_id => $caisse_data) {
                if (isset($this->noms_caisses[$caisse_id])) {
                    $new_comptage_detail_id = $this->insertComptageDetail($new_comptage_id, $caisse_id, $caisse_data);
                    $this->copyDetailsToNewRecord($new_comptage_detail_id, $caisse_data);
                }
            }
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Sauvegarde automatique créée depuis l\'historique.']);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(500); }
            error_log("Erreur loadFromHistory: " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $e->getMessage()]);
        }
    }

    public function getClosedCaisseData() {
        if (!defined('PHPUNIT_RUNNING')) { header('Content-Type: application/json'); }
        $caisse_id = intval($_GET['caisse_id'] ?? 0);
        if ($caisse_id <= 0) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(400); }
            echo json_encode(['success' => false, 'message' => 'ID de caisse invalide.']);
            return;
        }

        try {
            $data = $this->clotureStateService->getClosedCaisseData($caisse_id);
            if (!$data) {
                throw new Exception("Aucune donnée de clôture trouvée pour cette caisse.");
            }
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            if (!defined('PHPUNIT_RUNNING')) { http_response_code(404); }
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
