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

        $stmt_auto = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
        $autosave = $stmt_auto->fetch();

        $stmt_j1 = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages WHERE nom_comptage LIKE 'Fond de caisse J+1%' ORDER BY id DESC LIMIT 1");
        $fond_j1 = $stmt_j1->fetch();
        
        $last_comptage = null;

        if ($autosave && $fond_j1) {
            $last_comptage = ($autosave['id'] > $fond_j1['id']) ? $autosave : $fond_j1;
        } else if ($autosave) {
            $last_comptage = $autosave;
        } else if ($fond_j1) {
            $last_comptage = $fond_j1;
        } else {
            $stmt_last = $this->pdo->query("SELECT id, nom_comptage, explication FROM comptages ORDER BY id DESC LIMIT 1");
            $last_comptage = $stmt_last->fetch();
        }

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

    public function loadFromHistory() {
        header('Content-Type: application/json');
        $comptage_id_to_load = intval($_POST['comptage_id'] ?? 0);

        if ($comptage_id_to_load <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de comptage invalide.']);
            exit;
        }

        try {
            $stmt_name = $this->pdo->prepare("SELECT nom_comptage FROM comptages WHERE id = ?");
            $stmt_name->execute([$comptage_id_to_load]);
            $original_name = $stmt_name->fetchColumn();
            if (!$original_name) {
                throw new Exception("Comptage original non trouvé.");
            }

            $data_to_load = $this->loadComptageData($comptage_id_to_load);

            $this->pdo->beginTransaction();

            $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");

            $new_nom_comptage = "Sauvegarde Auto - chargement depuis historique [" . $original_name . "]";
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$new_nom_comptage, "Chargé depuis l'historique.", date('Y-m-d H:i:s')]);
            $new_comptage_id = $this->pdo->lastInsertId();

            foreach ($data_to_load as $caisse_id => $caisse_data) {
                if (isset($this->noms_caisses[$caisse_id])) {
                    $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                    $stmt_details->execute([$new_comptage_id, $caisse_id, $caisse_data['fond_de_caisse'], $caisse_data['ventes'], $caisse_data['retrocession']]);
                    $new_comptage_detail_id = $this->pdo->lastInsertId();

                    if (isset($caisse_data['denominations'])) {
                        foreach ($caisse_data['denominations'] as $denom_name => $quantity) {
                             $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                             $stmt_denom->execute([$new_comptage_detail_id, $denom_name, $quantity]);
                        }
                    }
                }
            }

            $this->pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Sauvegarde automatique créée depuis l\'historique.']);

        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $e->getMessage()]);
        }
        exit;
    }

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
            $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");

            // CORRECTION : Une seule transaction pour toute l'opération
            $this->pdo->beginTransaction();

            // Étape 1 : Création de l'enregistrement "Clôture Générale"
            $nom_comptage_cg = "Clôture Générale du " . date('d/m/Y');
            $explication_cg = "Comptage final consolidé de la journée.";
            $stmt_cg = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_cg->execute([$nom_comptage_cg, $explication_cg, date('Y-m-d H:i:s')]);
            $comptage_id_cloture_generale = $this->pdo->lastInsertId();

            // Étape 2 : Création de l'enregistrement "Fond de caisse J+1"
            $nom_comptage_j1 = "Fond de caisse J+1 du " . date('d/m/Y');
            $stmt_j1 = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_j1->execute([$nom_comptage_j1, "Préparation pour la journée suivante.", date('Y-m-d H:i:s')]);
            $comptage_id_j1 = $this->pdo->lastInsertId();

            foreach ($this->noms_caisses as $caisse_id => $nom) {
                // On récupère les données de la dernière clôture individuelle de la caisse
                $stmt_latest_cloture = $this->pdo->prepare(
                    "SELECT cd.*, 
                           (SELECT GROUP_CONCAT(CONCAT(denomination_nom, ':', quantite) SEPARATOR ';') FROM comptage_denominations WHERE comptage_detail_id = cd.id) as denominations_str,
                           (SELECT GROUP_CONCAT(CONCAT(denomination_nom, ':', quantite_retiree) SEPARATOR ';') FROM comptage_retraits WHERE comptage_detail_id = cd.id) as retraits_str
                     FROM comptage_details cd 
                     JOIN comptages c ON cd.comptage_id = c.id 
                     WHERE cd.caisse_id = ? AND c.nom_comptage LIKE 'Clôture Caisse%' 
                     ORDER BY c.id DESC LIMIT 1"
                );
                $stmt_latest_cloture->execute([$caisse_id]);
                $latest_cloture_data = $stmt_latest_cloture->fetch(PDO::FETCH_ASSOC);

                if (!$latest_cloture_data) continue;

                // On remplit les détails de la "Clôture Générale"
                $stmt_details_cg = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                $stmt_details_cg->execute([$comptage_id_cloture_generale, $caisse_id, $latest_cloture_data['fond_de_caisse'], $latest_cloture_data['ventes'], $latest_cloture_data['retrocession']]);
                $detail_id_cg = $this->pdo->lastInsertId();

                // CORRECTION : S'assurer que la chaîne n'est pas vide avant de l'exploser
                $denominations_array = [];
                if (!empty($latest_cloture_data['denominations_str'])) {
                    $denominations_array = explode(';', $latest_cloture_data['denominations_str']);
                }
                
                foreach ($denominations_array as $denom_pair) {
                    if (strpos($denom_pair, ':') !== false) {
                        list($name, $quantity) = explode(':', $denom_pair);
                        $stmt_denom_cg = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                        $stmt_denom_cg->execute([$detail_id_cg, $name, $quantity]);
                    }
                }
                
                // On prépare les données pour J+1
                $retraits_array = [];
                if ($latest_cloture_data['retraits_str']) {
                    foreach (explode(';', $latest_cloture_data['retraits_str']) as $retrait_pair) {
                         if (strpos($retrait_pair, ':') !== false) {
                            list($name, $quantity) = explode(':', $retrait_pair);
                            $retraits_array[$name] = $quantity;
                         }
                    }
                }

                $nouveau_fond_de_caisse = 0;
                $nouvelles_quantites = [];
                $all_denoms = array_merge($this->denominations['billets'], $this->denominations['pieces']);
                
                foreach ($denominations_array as $denom_pair) {
                    if (strpos($denom_pair, ':') !== false) {
                        list($name, $qte_initiale) = explode(':', $denom_pair);
                        $qte_retiree = intval($retraits_array[$name] ?? 0);
                        $qte_finale = intval($qte_initiale) - $qte_retiree;
                        if ($qte_finale > 0) {
                            $nouvelles_quantites[$name] = $qte_finale;
                            $nouveau_fond_de_caisse += $qte_finale * floatval($all_denoms[$name]);
                        }
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
            
            // On valide toute la transaction
            $this->pdo->commit();
            
            echo json_encode(['success' => true, 'message' => "Clôture générale réussie ! Le fond de caisse pour le jour suivant a été préparé."]);

        } catch (Exception $e) {
            // S'il y a une erreur, on annule tout
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture générale : ' . $e->getMessage()]);
        }
        exit;
    }
}
