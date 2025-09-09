<?php
// Fichier : src/CalculateurController.php (Version Finale Complète et Corrigée)

require_once __DIR__ . '/services/VersionService.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/ClotureStateService.php';
require_once __DIR__ . '/services/BackupService.php';

class CalculateurController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $versionService;
    private $clotureStateService;
    private $backupService;
    private $terminaux_par_caisse = [];

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse_obsolete) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->versionService = new VersionService();
        $this->clotureStateService = new ClotureStateService($pdo);
        $this->backupService = new BackupService();
        $stmt = $this->pdo->query("SELECT id, nom_terminal, caisse_associee FROM terminaux_paiement ORDER BY nom_terminal");
        $terminaux = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($terminaux as $terminal) {
            $this->terminaux_par_caisse[$terminal['caisse_associee']][] = $terminal;
        }
    }

    public function getInitialData() {
        header('Content-Type: application/json');
        // CORRECTION : La priorité est maintenant donnée à la sauvegarde automatique.
        $sql = "SELECT id, nom_comptage, explication FROM comptages ORDER BY CASE WHEN nom_comptage LIKE 'Sauvegarde auto%' THEN 1 WHEN nom_comptage LIKE 'Fond de caisse J+1%' THEN 2 ELSE 3 END, date_comptage DESC LIMIT 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        $last_comptage = $stmt->fetch();
        
        if ($last_comptage) {
            $data = $this->loadComptageData($last_comptage['id']);
            $data['nom_comptage'] = $last_comptage['nom_comptage'];
            $data['explication'] = $last_comptage['explication'];
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            echo json_encode(['success' => false, 'data' => null]);
        }
        exit;
    }

    private function loadComptageData($comptage_id) {
        $data = [];
        $stmt = $this->pdo->prepare("SELECT * FROM comptage_details WHERE comptage_id = ?");
        $stmt->execute([$comptage_id]);
        $details_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($details_data as $row) {
            $caisse_id = $row['caisse_id'];
            $comptage_detail_id = $row['id'];
            $data[$caisse_id] = ['fond_de_caisse' => $row['fond_de_caisse'], 'ventes' => $row['ventes'], 'retrocession' => $row['retrocession'], 'denominations' => []];
            $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
            $stmt_denoms->execute([$comptage_detail_id]);
            while ($denom_row = $stmt_denoms->fetch()) {
                $data[$caisse_id]['denominations'][$denom_row['denomination_nom']] = $denom_row['quantite'];
            }
        }
        return $data;
    }

    public function save() { $this->handleSave(false); }
    public function autosave() { $this->handleSave(true); }

    private function handleSave($is_autosave) {
        header('Content-Type: application/json');
        if ($is_autosave) ob_start();
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
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (empty($caisse_data)) continue;
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                $stmt_details->execute([$comptage_id, $caisse_id, get_numeric_value($caisse_data, 'fond_de_caisse'), get_numeric_value($caisse_data, 'ventes'), get_numeric_value($caisse_data, 'retrocession')]);
                $comptage_detail_id = $this->pdo->lastInsertId();
                foreach ($this->denominations as $type => $denominations_list) {
                    foreach ($denominations_list as $name => $value) {
                        $quantite = get_numeric_value($caisse_data, $name);
                        if ($quantite > 0) {
                            $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                            $stmt_denom->execute([$comptage_detail_id, $name, $quantite]);
                        }
                    }
                }
            }
            $this->pdo->commit();
            if ($is_autosave) ob_end_clean();
            echo json_encode(['success' => true, 'message' => "Sauvegarde réussie !"]);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            if ($is_autosave) ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur de BDD: ' . $e->getMessage()]);
        }
        exit;
    }

    public function getClotureState() {
        header('Content-Type: application/json');
        try {
            echo json_encode(['success' => true, 'locked_caisses' => $this->clotureStateService->getLockedCaisses(), 'closed_caisses' => $this->clotureStateService->getClosedCaisses()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur serveur.']);
        }
        exit;
    }

    public function cloture() {
        header('Content-Type: application/json');
        try {
            $caisses_a_cloturer = $_POST['caisses_a_cloturer'] ?? [];
            if (empty($caisses_a_cloturer)) {
                throw new Exception("Aucune caisse sélectionnée pour la clôture.");
            }

            $this->pdo->beginTransaction();

            foreach ($caisses_a_cloturer as $caisse_id) {
                $caisse_id = intval($caisse_id);
                $nom_cloture = "Clôture Caisse " . ($this->noms_caisses[$caisse_id] ?? $caisse_id) . " du " . date('Y-m-d H:i:s');
                $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                $stmt->execute([$nom_cloture, "Clôture quotidienne.", date('Y-m-d H:i:s')]);
                $comptage_id_cloture = $this->pdo->lastInsertId();
                
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (!empty($caisse_data)) {
                    $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                    $stmt_details->execute([$comptage_id_cloture, $caisse_id, get_numeric_value($caisse_data, 'fond_de_caisse'), get_numeric_value($caisse_data, 'ventes'), get_numeric_value($caisse_data, 'retrocession')]);
                    $comptage_detail_id = $this->pdo->lastInsertId();

                    foreach ($this->denominations as $type => $list) {
                        foreach ($list as $name => $value) {
                            $quantite = get_numeric_value($caisse_data, $name);
                            if ($quantite > 0) {
                                $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                                $stmt_denom->execute([$comptage_detail_id, $name, $quantite]);
                            }
                        }
                    }
                    
                    $retraits_data = isset($_POST['retraits'][$caisse_id]) && is_array($_POST['retraits'][$caisse_id]) ? $_POST['retraits'][$caisse_id] : [];
                    foreach ($retraits_data as $denom_name => $quantity) {
                        if (intval($quantity) > 0) {
                            $stmt_retrait = $this->pdo->prepare("INSERT INTO comptage_retraits (comptage_detail_id, denomination_nom, quantite_retiree) VALUES (?, ?, ?)");
                            $stmt_retrait->execute([$comptage_detail_id, $denom_name, intval($quantity)]);
                        }
                    }
                }
                $this->clotureStateService->confirmCaisse($caisse_id);
            }
            
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => "La ou les caisses ont été clôturées."]);

        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur: ' . $e->getMessage()]);
        }
        exit;
    }

    public function cloture_generale() {
        header('Content-Type: application/json');
        $backupResult = $this->backupService->createBackup();
        if (!$backupResult['success']) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $backupResult['message']]);
            exit;
        }
        try {
            $this->pdo->beginTransaction();
            $nom_comptage = "Clôture Générale du " . date('d/m/Y');
            $explication = "Comptage final consolidé de la journée.";
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$nom_comptage, $explication, date('Y-m-d H:i:s')]);
            $comptage_id = $this->pdo->lastInsertId();
            
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (empty($caisse_data)) continue;
                
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                $stmt_details->execute([$comptage_id, $caisse_id, get_numeric_value($caisse_data, 'fond_de_caisse'), get_numeric_value($caisse_data, 'ventes'), get_numeric_value($caisse_data, 'retrocession')]);
            }
            $this->pdo->commit();

            $this->pdo->beginTransaction();
            $nom_comptage_j1 = "Fond de caisse J+1 du " . date('d/m/Y');
            $stmt_j1 = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_j1->execute([$nom_comptage_j1, "Préparation pour la journée suivante.", date('Y-m-d H:i:s')]);
            $comptage_id_j1 = $this->pdo->lastInsertId();

            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                $retraits_data = $_POST['retraits'][$caisse_id] ?? [];
                if (empty($caisse_data)) continue;

                $nouveau_fond_de_caisse = 0;
                $nouvelles_quantites = [];
                $all_denoms = array_merge($this->denominations['billets'], $this->denominations['pieces']);

                foreach ($all_denoms as $name => $value) {
                    $qte_initiale = intval(get_numeric_value($caisse_data, $name));
                    $qte_retiree = intval($retraits_data[$name] ?? 0);
                    $qte_finale = $qte_initiale - $qte_retiree;
                    if ($qte_finale > 0) {
                        $nouvelles_quantites[$name] = $qte_finale;
                        $nouveau_fond_de_caisse += $qte_finale * $value;
                    }
                }
                
                $stmt_details_j1 = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, 0, 0)");
                $stmt_details_j1->execute([$comptage_id_j1, $caisse_id, $nouveau_fond_de_caisse]);
                $comptage_detail_id_j1 = $this->pdo->lastInsertId();

                foreach ($nouvelles_quantites as $name => $qte) {
                    $stmt_denom_j1 = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                    $stmt_denom_j1->execute([$comptage_detail_id_j1, $name, $qte]);
                }
            }
            
            $this->clotureStateService->resetState();
            $this->pdo->commit();
            
            echo json_encode(['success' => true, 'message' => "Clôture générale réussie ! Le fond de caisse pour le jour suivant a été préparé."]);

        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture générale : ' . $e->getMessage()]);
        }
        exit;
    }
}
