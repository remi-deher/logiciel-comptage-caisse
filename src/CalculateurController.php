<?php
// src/CalculateurController.php
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

    public function calculateur() {
        $loaded_data = [];
        $isLoadedFromHistory = false;
        
        $comptageIdToLoad = intval($_GET['load'] ?? $_GET['resume_from'] ?? 0);
    
        if ($comptageIdToLoad > 0) {
            if (isset($_GET['resume_from'])) {
                $isLoadedFromHistory = false;
                 $_SESSION['message'] = "Le comptage a été repris. N'oubliez pas de l'enregistrer sous un nouveau nom.";
            } elseif (isset($_SESSION['just_saved']) && $_SESSION['just_saved'] == $comptageIdToLoad) {
                $isLoadedFromHistory = false;
                unset($_SESSION['just_saved']);
            } else {
                $isLoadedFromHistory = true;
            }
    
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE id = ?");
            $stmt->execute([$comptageIdToLoad]);
            $loaded_comptage = $stmt->fetch() ?: [];
    
            if ($loaded_comptage) {
                $loaded_data = $this->loadComptageData($loaded_comptage['id']);
                $loaded_data['nom_comptage'] = $loaded_comptage['nom_comptage'];
                $loaded_data['explication'] = $loaded_comptage['explication'];
            }
        }
    
        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $terminaux_par_caisse = $this->terminaux_par_caisse;
        
        $page_js = ['calculator.js', 'realtime.js', 'cloture.js'];
        $page_css = 'calculateur.css';
        
        require __DIR__ . '/../templates/calculateur.php';
    }
    
    public function getInitialData() {
        header('Content-Type: application/json');

        // On récupère la toute dernière sauvegarde, quelle qu'elle soit
        $stmt = $this->pdo->prepare("SELECT id, nom_comptage, explication FROM comptages ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $last_comptage = $stmt->fetch();

        if ($last_comptage) {
            $nom = $last_comptage['nom_comptage'];
            $data = null;

            if (strpos($nom, 'Fond de caisse J+1') === 0) {
                $data = $this->loadComptageData($last_comptage['id']);
                $data['nom_comptage'] = ''; 
                $data['explication'] = '';
                echo json_encode(['success' => true, 'data' => $data]);
                exit;
            } 
            elseif (strpos($nom, 'Sauvegarde auto') === 0) {
                $data = $this->loadComptageData($last_comptage['id']);
                $data['nom_comptage'] = $last_comptage['nom_comptage'];
                $data['explication'] = $last_comptage['explication'];
                echo json_encode(['success' => true, 'data' => $data]);
                exit;
            }
        }

        echo json_encode(['success' => false, 'data' => null]);
    }


    private function loadComptageData($comptage_id) {
        $data = [];
        
        $sql_query = "
            SELECT
                cd.id as comptage_detail_id,
                cd.caisse_id,
                cd.fond_de_caisse,
                cd.ventes,
                cd.retrocession
            FROM comptage_details cd
            WHERE cd.comptage_id = ?
        ";
        $stmt = $this->pdo->prepare($sql_query);
        $stmt->execute([$comptage_id]);
        $details_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($details_data as $row) {
            $caisse_id = $row['caisse_id'];
            $comptage_detail_id = $row['comptage_detail_id'];

            $data[$caisse_id] = [
                'fond_de_caisse' => $row['fond_de_caisse'],
                'ventes' => $row['ventes'],
                'retrocession' => $row['retrocession'],
                'denominations' => [],
                'cb' => [],
                'cheques' => []
            ];
            
            $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
            $stmt_denoms->execute([$comptage_detail_id]);
            while ($denom_row = $stmt_denoms->fetch()) {
                $data[$caisse_id]['denominations'][$denom_row['denomination_nom']] = $denom_row['quantite'];
            }

            $stmt_cb = $this->pdo->prepare("SELECT terminal_id, montant FROM comptage_cb WHERE comptage_detail_id = ?");
            $stmt_cb->execute([$comptage_detail_id]);
            while ($cb_row = $stmt_cb->fetch()) {
                $data[$caisse_id]['cb'][$cb_row['terminal_id']] = $cb_row['montant'];
            }
            
            $stmt_cheques = $this->pdo->prepare("SELECT montant FROM comptage_cheques WHERE comptage_detail_id = ?");
            $stmt_cheques->execute([$comptage_detail_id]);
            $data[$caisse_id]['cheques'] = $stmt_cheques->fetchAll(PDO::FETCH_COLUMN, 0);
        }
        
        return $data;
    }

    public function save() { $this->handleSave(false); }
    public function autosave() { $this->handleSave(true); }

    private function handleSave($is_autosave) {
        if ($is_autosave) { header('Content-Type: application/json'); ob_start(); }
    
        $nom_comptage = trim($_POST['nom_comptage'] ?? '');
        $explication = trim($_POST['explication'] ?? '');
        $has_data = false;
        foreach ($_POST['caisse'] ?? [] as $caisse_data) {
            foreach ($caisse_data as $value) { 
                if (is_array($value)) {
                    foreach ($value as $sub_value) {
                         if (!empty($sub_value)) { $has_data = true; break 3; }
                    }
                } elseif (!empty($value)) { $has_data = true; break 2; } 
            }
        }
        if (!$has_data) {
            if ($is_autosave) { ob_end_clean(); echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']); }
            else { $_SESSION['message'] = "Aucune donnée n'a été saisie."; header('Location: index.php?page=calculateur'); }
            exit;
        }
    
        try {
            $this->pdo->beginTransaction();
    
            $comptage_id = null;
    
            if ($is_autosave) {
                $nom_comptage = "Sauvegarde auto du " . date('Y-m-d H:i:s');
                $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                $stmt->execute([$nom_comptage, $explication, date('Y-m-d H:i:s')]);
                $comptage_id = $this->pdo->lastInsertId();
            } else {
                if (empty($nom_comptage)) {
                    $nom_comptage = "Comptage du " . date('Y-m-d H:i:s');
                }
                $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                $stmt->execute([$nom_comptage, $explication, date('Y-m-d H:i:s')]);
                $comptage_id = $this->pdo->lastInsertId();
            }
    
            if (empty($comptage_id)) {
                throw new Exception("La création de l'enregistrement de comptage a échoué.");
            }
    
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                
                $has_real_data_for_caisse = false;
                foreach ($caisse_data as $value) {
                    if (is_array($value)) {
                        foreach ($value as $sub_value) {
                            if (is_numeric(str_replace(',', '.', $sub_value)) && floatval(str_replace(',', '.', $sub_value)) != 0) {
                                $has_real_data_for_caisse = true; break 2;
                            }
                        }
                    } elseif (is_numeric(str_replace(',', '.', $value)) && floatval(str_replace(',', '.', $value)) != 0) {
                        $has_real_data_for_caisse = true; break;
                    }
                }
                
                if (!$has_real_data_for_caisse) continue;
    
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                $stmt_details->execute([
                    $comptage_id,
                    $caisse_id,
                    get_numeric_value($caisse_data, 'fond_de_caisse'),
                    get_numeric_value($caisse_data, 'ventes'),
                    get_numeric_value($caisse_data, 'retrocession')
                ]);
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

                if (isset($caisse_data['cb']) && is_array($caisse_data['cb'])) {
                    foreach ($caisse_data['cb'] as $terminal_id => $montant) {
                        $montant_numerique = get_numeric_value(['montant' => $montant], 'montant');
                        if ($montant_numerique > 0) {
                            $stmt_cb = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant) VALUES (?, ?, ?)");
                            $stmt_cb->execute([$comptage_detail_id, $terminal_id, $montant_numerique]);
                        }
                    }
                }
                
                if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
                    foreach ($caisse_data['cheques'] as $montant) {
                        $montant_numerique = get_numeric_value(['montant' => $montant], 'montant');
                        if ($montant_numerique > 0) {
                            $stmt_cheque = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant) VALUES (?, ?)");
                            $stmt_cheque->execute([$comptage_detail_id, $montant_numerique]);
                        }
                    }
                }
            }
            
            $this->pdo->commit();
    
            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
            } else {
                $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !";
                $_SESSION['just_saved'] = $comptage_id;
                header('Location: index.php?page=calculateur&load=' . $comptage_id);
            }
            exit;
    
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => false, 'message' => 'Erreur de BDD: ' . $e->getMessage()]);
            } else {
                $_SESSION['message'] = "Erreur de BDD lors de la sauvegarde : " . $e->getMessage();
                header('Location: index.php?page=calculateur');
            }
            exit;
        }
    }
    
    public function getClotureState() {
        header('Content-Type: application/json');
        try {
            $lockedCaisses = $this->clotureStateService->getLockedCaisses();
            $closedCaisses = $this->clotureStateService->getClosedCaisses();
            echo json_encode(['success' => true, 'locked_caisses' => $lockedCaisses, 'closed_caisses' => $closedCaisses]);
        } catch (Exception $e) {
            error_log("Erreur dans getClotureState : " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false, 
                'message' => 'Erreur serveur lors de la récupération de l\'état de clôture.'
            ]);
        }
        exit;
    }

    public function cloture() {
        header('Content-Type: application/json');

        try {
            $caisse_id_a_cloturer = intval($_POST['caisse_id_a_cloturer'] ?? 0);
            if ($caisse_id_a_cloturer === 0) {
                throw new Exception("ID de caisse invalide.");
            }

            $nom_cloture = "Clôture Caisse " . ($this->noms_caisses[$caisse_id_a_cloturer] ?? $caisse_id_a_cloturer) . " du " . date('Y-m-d H:i:s');
            $explication = "Clôture quotidienne de la caisse.";
            
            $this->pdo->beginTransaction();

            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$nom_cloture, $explication, date('Y-m-d H:i:s')]);
            $comptage_id_cloture = $this->pdo->lastInsertId();
            
            $caisse_data = $_POST['caisse'][$caisse_id_a_cloturer] ?? [];
            if (!empty($caisse_data)) {
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                $stmt_details->execute([
                    $comptage_id_cloture,
                    $caisse_id_a_cloturer,
                    get_numeric_value($caisse_data, 'fond_de_caisse'),
                    get_numeric_value($caisse_data, 'ventes'),
                    get_numeric_value($caisse_data, 'retrocession')
                ]);
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
            
            $this->clotureStateService->confirmCaisse($caisse_id_a_cloturer);
            echo json_encode(['success' => true, 'message' => "La caisse a été clôturée avec succès."]);
        
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log("Erreur lors de la clôture : " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture : ' . $e->getMessage()]);
        }
        exit;
    }

    public function cloture_generale() {
        global $min_to_keep;
        header('Content-Type: application/json');
        
        $newState = null;

        try {
            $this->pdo->beginTransaction();
    
            $nom_comptage_final = "Comptage final du " . date('d/m/Y H:i:s');
            $explication_final = "Sauvegarde complète avant la clôture générale.";
            $stmt_final = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_final->execute([$nom_comptage_final, $explication_final, date('Y-m-d H:i:s')]);
            $comptage_id_final = $this->pdo->lastInsertId();
    
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (!empty($caisse_data)) {
                    $stmt_details_final = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, ?, ?)");
                    $stmt_details_final->execute([
                        $comptage_id_final,
                        $caisse_id,
                        get_numeric_value($caisse_data, 'fond_de_caisse'),
                        get_numeric_value($caisse_data, 'ventes'),
                        get_numeric_value($caisse_data, 'retrocession')
                    ]);
                    $comptage_detail_id_final = $this->pdo->lastInsertId();
    
                    foreach ($this->denominations as $type => $denominations_list) {
                        foreach ($denominations_list as $name => $value) {
                            $quantite = get_numeric_value($caisse_data, $name);
                            if ($quantite > 0) {
                                $stmt_denom_final = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                                $stmt_denom_final->execute([$comptage_detail_id_final, $name, $quantite]);
                            }
                        }
                    }
                }
            }
    
            $nom_comptage_j1 = "Fond de caisse J+1 - cloture du " . date('d/m/Y');
            $explication_j1 = "Comptage généré automatiquement après la clôture générale.";
            $stmt_j1 = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_j1->execute([$nom_comptage_j1, $explication_j1, date('Y-m-d H:i:s')]);
            $comptage_id_j1 = $this->pdo->lastInsertId();
    
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                
                $total_compte = 0;
                $current_counts = [];
                foreach ($this->denominations as $type => $denominations_list) {
                    foreach ($denominations_list as $name => $value) {
                        $quantite = get_numeric_value($caisse_data, $name);
                        $current_counts[$name] = $quantite;
                        $total_compte += $quantite * $value;
                    }
                }
                $fond_de_caisse = get_numeric_value($caisse_data, 'fond_de_caisse');
                $recette_reelle = $total_compte - $fond_de_caisse;
                
                $suggestions = $this->generateWithdrawalSuggestion($recette_reelle, $current_counts, $this->denominations, $min_to_keep ?? []);
    
                $stmt_details_j1 = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes, retrocession) VALUES (?, ?, ?, 0, 0)");
                $stmt_details_j1->execute([$comptage_id_j1, $caisse_id, $fond_de_caisse]);
                $comptage_detail_id_j1 = $this->pdo->lastInsertId();
    
                foreach ($current_counts as $name => $quantite) {
                    $quantite_a_retirer = $suggestions[$name] ?? 0;
                    $nouvelle_quantite = $quantite - $quantite_a_retirer;
    
                    if ($nouvelle_quantite > 0) {
                        $stmt_denom_j1 = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                        $stmt_denom_j1->execute([$comptage_detail_id_j1, $name, $nouvelle_quantite]);
                    }
                }
            }
    
            $this->pdo->commit();
    
            $stmt_delete = $this->pdo->prepare(
                "DELETE FROM comptages WHERE DATE(date_comptage) = CURDATE() AND id NOT IN (?, ?)"
            );
            $stmt_delete->execute([$comptage_id_final, $comptage_id_j1]);
    
            $newState = $this->loadComptageData($comptage_id_j1);
            $newState['nom_comptage'] = '';
            $newState['explication'] = '';

            $this->clotureStateService->resetState();
    
            echo json_encode(['success' => true, 'message' => "Clôture générale réussie. Les sauvegardes finales ont été créées et les sauvegardes intermédiaires nettoyées.", 'newState' => $newState]);
    
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            error_log("Erreur lors de la clôture générale : " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur de BDD lors de la clôture générale: ' . $e->getMessage()]);
        }
        exit;
    }
    
    private function generateWithdrawalSuggestion($amountToWithdraw, $currentCounts, $denominations, $minToKeep) {
        $remainingAmount = $amountToWithdraw;
        $suggestions = [];

        $allDenominations = array_merge($denominations['billets'], $denominations['pieces']);
        arsort($allDenominations);

        foreach ($allDenominations as $name => $value) {
            $countInCaisse = $currentCounts[$name] ?? 0;
            $toKeep = $minToKeep[$name] ?? 0;
            $availableToRemove = max(0, $countInCaisse - $toKeep);
            
            if ($value > 0) {
                $numToRemove = min(floor($remainingAmount / $value), $availableToRemove);
                if ($numToRemove > 0) {
                    $suggestions[$name] = $numToRemove;
                    $remainingAmount -= $numToRemove * $value;
                    $remainingAmount = round($remainingAmount, 2);
                }
            }
        }
        return $suggestions;
    }
}
