<?php
// Fichier : src/CalculateurController.php (Final, refactorisé et corrigé)

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

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse_obsolete) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->versionService = new VersionService();
        $this->clotureStateService = new ClotureStateService($pdo);
        $this->backupService = new BackupService();
        $this->comptageRepository = new ComptageRepository($pdo);
    }

    public function getClosedCaisseData() {
        header('Content-Type: application/json');
        $caisse_id = intval($_GET['caisse_id'] ?? 0);
        if ($caisse_id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID de caisse invalide.']);
            exit;
        }

        try {
            $stmt = $this->pdo->prepare(
                "SELECT cd.* FROM comptage_details cd
                 JOIN comptages c ON cd.comptage_id = c.id
                 WHERE cd.caisse_id = ? AND c.nom_comptage LIKE 'Clôture Caisse%'
                 ORDER BY c.date_comptage DESC LIMIT 1"
            );
            $stmt->execute([$caisse_id]);
            $caisseData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$caisseData) {
                throw new Exception("Aucun comptage de clôture trouvé pour cette caisse.");
            }

            $comptage_detail_id = $caisseData['id'];
            $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
            $stmt_denoms->execute([$comptage_detail_id]);
            $caisseData['denominations'] = $stmt_denoms->fetchAll(PDO::FETCH_KEY_PAIR);

            echo json_encode(['success' => true, 'data' => $caisseData]);

        } catch (Exception $e) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
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
            $data = $this->comptageRepository->findDetailsById($last_comptage['id']);
            $data['nom_comptage'] = $last_comptage['nom_comptage'];
            $data['explication'] = $last_comptage['explication'];
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            echo json_encode(['success' => false, 'data' => null]);
        }
        exit;
    }

    public function save() { $this->handleSave(false); }
    public function autosave() { $this->handleSave(true); }

    private function handleSave($is_autosave) {
        header('Content-Type: application/json');
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
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt_details->execute([$comptage_id, $caisse_id, get_numeric_value($caisse_data, 'fond_de_caisse'), get_numeric_value($caisse_data, 'ventes_especes'), get_numeric_value($caisse_data, 'ventes_cb'), get_numeric_value($caisse_data, 'ventes_cheques'), get_numeric_value($caisse_data, 'retrocession')]);
                $comptage_detail_id = $this->pdo->lastInsertId();
                if (isset($caisse_data['denominations']) && is_array($caisse_data['denominations'])) {
                    foreach ($caisse_data['denominations'] as $name => $quantite) {
                        if (intval($quantite) > 0) {
                            $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                            $stmt_denom->execute([$comptage_detail_id, $name, intval($quantite)]);
                        }
                    }
                }
                if (isset($caisse_data['tpe']) && is_array($caisse_data['tpe'])) {
                    foreach ($caisse_data['tpe'] as $terminal_id => $releves) {
                        if (is_array($releves)) {
                            foreach ($releves as $releve) {
                                $montant_val = get_numeric_value($releve, 'montant');
                                if ($montant_val > 0) {
                                    $stmt_cb = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant, heure_releve) VALUES (?, ?, ?, ?)");
                                    $heure_releve_raw = $releve['heure'] ?? null;
                                    $heure_releve = ($heure_releve_raw && $heure_releve_raw !== 'undefined' && $heure_releve_raw !== 'null' && $heure_releve_raw !== '') ? $heure_releve_raw : null;
                                    $stmt_cb->execute([$comptage_detail_id, $terminal_id, $montant_val, $heure_releve]);
                                }
                            }
                        }
                    }
                }
                if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
                    foreach ($caisse_data['cheques'] as $cheque) {
                        $montant_cheque = get_numeric_value($cheque, 'montant');
                        if ($montant_cheque > 0) {
                            $stmt_cheque = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant, commentaire) VALUES (?, ?, ?)");
                            $stmt_cheque->execute([$comptage_detail_id, $montant_cheque, $cheque['commentaire'] ?? '']);
                        }
                    }
                }
            }
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => "Sauvegarde réussie !"]);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur côté serveur lors de la sauvegarde : ' . $e->getMessage()]);
        }
        exit;
    }

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
            $data_to_load = $this->comptageRepository->findDetailsById($comptage_id_to_load);
            $this->pdo->beginTransaction();
            $this->pdo->exec("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
            $new_nom_comptage = "Sauvegarde auto du " . date('Y-m-d H:i:s') . " (chargé depuis l'historique)";
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$new_nom_comptage, "Chargé depuis le comptage '" . $original_name . "'", date('Y-m-d H:i:s')]);
            $new_comptage_id = $this->pdo->lastInsertId();
            foreach ($data_to_load as $caisse_id => $caisse_data) {
                if (isset($this->noms_caisses[$caisse_id])) {
                    $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmt_details->execute([$new_comptage_id, $caisse_id, $caisse_data['fond_de_caisse'], $caisse_data['ventes_especes'], $caisse_data['ventes_cb'], $caisse_data['ventes_cheques'], $caisse_data['retrocession']]);
                    $new_comptage_detail_id = $this->pdo->lastInsertId();
                    if (isset($caisse_data['denominations']) && is_array($caisse_data['denominations'])) {
                        foreach ($caisse_data['denominations'] as $denom_name => $quantity) {
                            $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                            $stmt_denom->execute([$new_comptage_detail_id, $denom_name, $quantity]);
                        }
                    }
                    if (isset($caisse_data['tpe']) && is_array($caisse_data['tpe'])) {
                        foreach ($caisse_data['tpe'] as $terminal_id => $releves) {
                            if (is_array($releves)) {
                                foreach ($releves as $releve) {
                                    $stmt_cb = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant, heure_releve) VALUES (?, ?, ?, ?)");
                                    $heure_releve_raw = $releve['heure'] ?? null;
                                    $heure_releve = ($heure_releve_raw && $heure_releve_raw !== 'undefined' && $heure_releve_raw !== 'null' && $heure_releve_raw !== '') ? $heure_releve_raw : null;
                                    $stmt_cb->execute([$new_comptage_detail_id, $terminal_id, $releve['montant'], $heure_releve]);
                                }
                            }
                        }
                    }
                    if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
                        foreach ($caisse_data['cheques'] as $cheque) {
                            $stmt_cheque = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant, commentaire) VALUES (?, ?, ?)");
                            $stmt_cheque->execute([$new_comptage_detail_id, $cheque['montant'], $cheque['commentaire']]);
                        }
                    }
                }
            }
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Sauvegarde automatique créée depuis l\'historique.']);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $e->getMessage()]);
        }
        exit;
    }

    public function getClotureState() {
        header('Content-Type: application/json');
        try {
            echo json_encode([
                'success' => true,
                'locked_caisses' => $this->clotureStateService->getLockedCaisses(),
                'closed_caisses' => $this->clotureStateService->getClosedCaisses(),
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }
    
    public function cloture() {
        header('Content-Type: application/json');
        try {
            $this->pdo->beginTransaction();
            $caisses_a_cloturer = $_POST['caisses_a_cloturer'] ?? [];
            foreach ($caisses_a_cloturer as $caisse_id) {
                $caisse_id = intval($caisse_id);
                if ($this->clotureStateService->isCaisseConfirmed($caisse_id)) continue;
                $nom_comptage = "Clôture Caisse " . ($this->noms_caisses[$caisse_id] ?? $caisse_id) . " du " . date('Y-m-d H:i:s');
                $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                $stmt->execute([$nom_comptage, "Clôture individuelle via l'assistant.", date('Y-m-d H:i:s')]);
                $comptage_id = $this->pdo->lastInsertId();
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (empty($caisse_data)) continue;
                $stmt_details = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt_details->execute([$comptage_id, $caisse_id, get_numeric_value($caisse_data, 'fond_de_caisse'), get_numeric_value($caisse_data, 'ventes_especes'), get_numeric_value($caisse_data, 'ventes_cb'), get_numeric_value($caisse_data, 'ventes_cheques'), get_numeric_value($caisse_data, 'retrocession')]);
                $comptage_detail_id = $this->pdo->lastInsertId();
                if (isset($caisse_data['denominations'])) {
                    foreach ($caisse_data['denominations'] as $name => $quantite) {
                        $quantite = intval($quantite);
                        if ($quantite >= 0) {
                            $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                            $stmt_denom->execute([$comptage_detail_id, $name, $quantite]);
                        }
                    }
                }
                $retraits_data = $_POST['retraits'][$caisse_id] ?? [];
                foreach($retraits_data as $denom_name => $qty) {
                    if (intval($qty) > 0) {
                        $stmt_retrait = $this->pdo->prepare("INSERT INTO comptage_retraits (comptage_detail_id, denomination_nom, quantite_retiree) VALUES (?, ?, ?)");
                        $stmt_retrait->execute([$comptage_detail_id, $denom_name, intval($qty)]);
                    }
                }
                if (isset($caisse_data['tpe']) && is_array($caisse_data['tpe'])) {
                    foreach ($caisse_data['tpe'] as $terminal_id => $releves) {
                        if (is_array($releves)) {
                            foreach ($releves as $releve) {
                                $montant_val = get_numeric_value($releve, 'montant');
                                if ($montant_val > 0) {
                                    $stmt_cb = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant, heure_releve) VALUES (?, ?, ?, ?)");
                                    $heure_releve_raw = $releve['heure'] ?? null;
                                    $heure_releve = ($heure_releve_raw && $heure_releve_raw !== 'undefined' && $heure_releve_raw !== 'null' && $heure_releve_raw !== '') ? $heure_releve_raw : null;
                                    $stmt_cb->execute([$comptage_detail_id, $terminal_id, $montant_val, $heure_releve]);
                                }
                            }
                        }
                    }
                }
                if (isset($caisse_data['cheques']) && is_array($caisse_data['cheques'])) {
                    foreach ($caisse_data['cheques'] as $cheque) {
                        $montant_cheque = get_numeric_value($cheque, 'montant');
                        if ($montant_cheque > 0) {
                            $stmt_cheque = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant, commentaire) VALUES (?, ?, ?)");
                            $stmt_cheque->execute([$comptage_detail_id, $montant_cheque, $cheque['commentaire'] ?? '']);
                        }
                    }
                }
                $this->clotureStateService->confirmCaisse($caisse_id);
            }
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Les caisses sélectionnées ont été clôturées avec succès.']);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture : ' . $e->getMessage()]);
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
            $this->pdo->beginTransaction();
            $now = date('Y-m-d H:i:s');
            $date_for_name = date('d/m/Y H:i:s');
            $nom_comptage_cg = "Clôture Générale du " . $date_for_name;
            $stmt_cg = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_cg->execute([$nom_comptage_cg, "Comptage final consolidé de la journée.", $now]);
            $comptage_id_cloture_generale = $this->pdo->lastInsertId();
            $nom_comptage_j1 = "Fond de caisse J+1 du " . $date_for_name;
            $stmt_j1 = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt_j1->execute([$nom_comptage_j1, "Préparation pour la journée suivante.", $now]);
            $comptage_id_j1 = $this->pdo->lastInsertId();
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                
                // --- DÉBUT DE LA CORRECTION ---
                // La condition sur la date a été retirée pour trouver la dernière clôture,
                // peu importe le jour où elle a été faite.
                $stmt_latest_cloture = $this->pdo->prepare(
                    "SELECT cd.id FROM comptage_details cd 
                     JOIN comptages c ON cd.comptage_id = c.id 
                     WHERE cd.caisse_id = ? AND c.nom_comptage LIKE 'Clôture Caisse%'
                     ORDER BY c.id DESC LIMIT 1"
                );
                // --- FIN DE LA CORRECTION ---

                $stmt_latest_cloture->execute([$caisse_id]);
                $latest_detail_id = $stmt_latest_cloture->fetchColumn();
                if (!$latest_detail_id) continue;
                $latest_cloture_data = $this->loadComptageDataByDetailId($latest_detail_id);
                $stmt_details_cg = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt_details_cg->execute([
                    $comptage_id_cloture_generale, $caisse_id,
                    $latest_cloture_data['fond_de_caisse'], $latest_cloture_data['ventes_especes'],
                    $latest_cloture_data['ventes_cb'], $latest_cloture_data['ventes_cheques'], $latest_cloture_data['retrocession']
                ]);
                $detail_id_cg = $this->pdo->lastInsertId();
                $this->copyDetailsToNewRecord($detail_id_cg, $latest_cloture_data);
                $denominations_j1 = $latest_cloture_data['denominations'];
                $nouveau_fond_de_caisse = $latest_cloture_data['total_compte_especes'];
                if (!empty($latest_cloture_data['retraits'])) {
                    $all_denoms_map = ($this->denominations['billets'] ?? []) + ($this->denominations['pieces'] ?? []);
                    foreach ($latest_cloture_data['retraits'] as $denom_name => $qty_retiree) {
                        if (isset($denominations_j1[$denom_name])) {
                            $denominations_j1[$denom_name] -= $qty_retiree;
                            $valeur_retrait = $qty_retiree * ($all_denoms_map[$denom_name] ?? 0);
                            $nouveau_fond_de_caisse -= $valeur_retrait;
                        }
                    }
                }
                $stmt_details_j1 = $this->pdo->prepare("INSERT INTO comptage_details (comptage_id, caisse_id, fond_de_caisse, ventes_especes, ventes_cb, ventes_cheques, retrocession) VALUES (?, ?, ?, 0, 0, 0, 0)");
                $stmt_details_j1->execute([$comptage_id_j1, $caisse_id, $nouveau_fond_de_caisse]);
                $detail_id_j1 = $this->pdo->lastInsertId();
                foreach ($denominations_j1 as $denom_name => $quantity) {
                     if ($quantity > 0) {
                         $stmt_denom = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                         $stmt_denom->execute([$detail_id_j1, $denom_name, $quantity]);
                     }
                }
            }
            $this->clotureStateService->resetState();
            $this->pdo->commit();
            echo json_encode(['success' => true, 'message' => "Clôture générale réussie ! Le fond de caisse pour le jour suivant a été préparé."]);
        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la clôture générale : ' . $e->getMessage()]);
        }
        exit;
    }
    
    private function loadComptageDataByDetailId($detail_id) {
        $data = [];
        $stmt = $this->pdo->prepare("SELECT * FROM comptage_details WHERE id = ?");
        $stmt->execute([$detail_id]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
        $stmt_denoms->execute([$detail_id]);
        $data['denominations'] = $stmt_denoms->fetchAll(PDO::FETCH_KEY_PAIR);
        $stmt_retraits = $this->pdo->prepare("SELECT denomination_nom, quantite_retiree FROM comptage_retraits WHERE comptage_detail_id = ?");
        $stmt_retraits->execute([$detail_id]);
        $data['retraits'] = $stmt_retraits->fetchAll(PDO::FETCH_KEY_PAIR);
        $stmt_cb = $this->pdo->prepare("SELECT terminal_id, montant, heure_releve FROM comptage_cb WHERE comptage_detail_id = ?");
        $stmt_cb->execute([$detail_id]);
        $data['tpe'] = $stmt_cb->fetchAll(PDO::FETCH_ASSOC | PDO::FETCH_GROUP);
        $stmt_cheques = $this->pdo->prepare("SELECT montant, commentaire FROM comptage_cheques WHERE comptage_detail_id = ?");
        $stmt_cheques->execute([$detail_id]);
        $data['cheques'] = $stmt_cheques->fetchAll(PDO::FETCH_ASSOC);
        $data['total_compte_especes'] = 0;
        $all_denoms_map = ($this->denominations['billets'] ?? []) + ($this->denominations['pieces'] ?? []);
        foreach($data['denominations'] as $denomination_nom => $quantite) {
            $data['total_compte_especes'] += floatval($quantite) * floatval($all_denoms_map[$denomination_nom] ?? 0);
        }
        $data['total_compte_cb'] = 0;
        if (isset($data['tpe'])) {
            foreach ($data['tpe'] as $releves) {
                if (is_array($releves)) {
                    foreach ($releves as $releve) {
                        $data['total_compte_cb'] += floatval($releve['montant'] ?? 0);
                    }
                }
            }
        }
        $data['total_compte_cheques'] = 0;
        if (isset($data['cheques'])) {
            foreach ($data['cheques'] as $cheque) {
                $data['total_compte_cheques'] += floatval($cheque['montant'] ?? 0);
            }
        }
        return $data;
    }
    
    private function copyDetailsToNewRecord($new_detail_id, $source_data) {
        if (!empty($source_data['denominations'])) {
            foreach ($source_data['denominations'] as $denom_name => $quantity) {
                 $stmt = $this->pdo->prepare("INSERT INTO comptage_denominations (comptage_detail_id, denomination_nom, quantite) VALUES (?, ?, ?)");
                 $stmt->execute([$new_detail_id, $denom_name, $quantity]);
            }
        }
        if (!empty($source_data['tpe'])) {
            foreach ($source_data['tpe'] as $terminal_id => $releves) {
                if(is_array($releves)) {
                    foreach ($releves as $releve) {
                        $stmt = $this->pdo->prepare("INSERT INTO comptage_cb (comptage_detail_id, terminal_id, montant, heure_releve) VALUES (?, ?, ?, ?)");
                        $heure_releve_raw = $releve['heure'] ?? null;
                        $heure_releve = ($heure_releve_raw && $heure_releve_raw !== 'undefined' && $heure_releve_raw !== 'null' && $heure_releve_raw !== '') ? $heure_releve_raw : null;
                        $stmt->execute([$new_detail_id, $terminal_id, $releve['montant'], $heure_releve]);
                    }
                }
            }
        }
        if (!empty($source_data['cheques'])) {
            foreach ($source_data['cheques'] as $cheque) {
                $stmt = $this->pdo->prepare("INSERT INTO comptage_cheques (comptage_detail_id, montant, commentaire) VALUES (?, ?, ?)");
                $stmt->execute([$new_detail_id, $cheque['montant'], $cheque['commentaire']]);
            }
        }
    }
}
