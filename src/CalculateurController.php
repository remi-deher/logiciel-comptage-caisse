<?php
// src/CalculateurController.php - Version corrigée pour le chargement des données.
// Ce contrôleur gère la page du calculateur et les actions de sauvegarde.
require_once 'services/VersionService.php';
require_once 'Utils.php';
class CalculateurController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;
    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
    }
    public function calculateur() {
        $loaded_data = [];
        $isLoadedFromHistory = false;
        $isAutosaveLoaded = false;

        // Nouvelle logique de chargement pour le schéma normalisé
        if (isset($_GET['load'])) {
            $comptageIdToLoad = intval($_GET['load']);
            error_log("Tentative de chargement du comptage ID: " . $comptageIdToLoad);
            $isLoadedFromHistory = true;
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE id = ?");
            $stmt->execute([$comptageIdToLoad]);
            $loaded_comptage = $stmt->fetch() ?: [];

            if ($loaded_comptage) {
                error_log("Comptage trouvé avec l'ID: " . $comptageIdToLoad);
                // La méthode loadComptageData a été mise à jour pour renvoyer le bon format
                $loaded_data = $this->loadComptageData($loaded_comptage['id']);
                $loaded_data['nom_comptage'] = $loaded_comptage['nom_comptage'];
                $loaded_data['explication'] = $loaded_comptage['explication'];
            } else {
                error_log("Comptage avec l'ID " . $comptageIdToLoad . " non trouvé.");
            }
        } else {
            // Sauvegarde auto
            $stmt = $this->pdo->prepare("SELECT * FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
            error_log("Recherche de la dernière sauvegarde automatique...");
            $stmt->execute();
            $loaded_comptage = $stmt->fetch() ?: [];
            if ($loaded_comptage) {
                error_log("Sauvegarde automatique trouvée avec l'ID: " . $loaded_comptage['id']);
                $isAutosaveLoaded = true;
                $loaded_data = $this->loadComptageData($loaded_comptage['id']);
                $loaded_data['nom_comptage'] = $loaded_comptage['nom_comptage'];
                $loaded_data['explication'] = $loaded_comptage['explication'];
            } else {
                error_log("Aucune sauvegarde automatique trouvée.");
            }
        }

        $message = $_SESSION['message'] ?? null;
        unset($_SESSION['message']);
        $noms_caisses = $this->noms_caisses;
        $denominations = $this->denominations;
        $page_css = 'calculateur.css';
        require __DIR__ . '/../templates/calculateur.php';
    }

    // Nouvelle fonction pour charger les données d'un comptage depuis le nouveau schéma
    // Cette fonction re-structure les données dans le format attendu par le template
    private function loadComptageData($comptage_id) {
        $data = [];
        
        // Requête pour récupérer tous les détails et les dénominations en une seule fois
        $sql_query = "
            SELECT
                cd.caisse_id,
                cd.fond_de_caisse,
                cd.ventes,
                cd.retrocession,
                d.denomination_nom,
                d.quantite
            FROM comptage_details cd
            LEFT JOIN comptage_denominations d ON cd.id = d.comptage_detail_id
            WHERE cd.comptage_id = ?
        ";
        error_log("Exécution de la requête : " . $sql_query);
        error_log("Avec l'ID de comptage : " . $comptage_id);

        $stmt = $this->pdo->prepare($sql_query);
        $stmt->execute([$comptage_id]);
        $raw_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($raw_data)) {
            error_log("Aucun détail trouvé pour le comptage ID: " . $comptage_id);
            return $data;
        }

        error_log("Données brutes de la BDD pour le comptage ID " . $comptage_id . ": " . print_r($raw_data, true));

        // Refonte de la boucle pour regrouper les données par caisse
        foreach ($raw_data as $row) {
            $caisse_id = $row['caisse_id'];
            
            // Initialiser le tableau pour la caisse si elle n'existe pas
            if (!isset($data[$caisse_id])) {
                $data[$caisse_id] = [
                    'fond_de_caisse' => $row['fond_de_caisse'],
                    'ventes' => $row['ventes'],
                    'retrocession' => $row['retrocession'],
                    'denominations' => []
                ];
            }
            
            // Ajouter les dénominations si elles existent
            if ($row['denomination_nom']) {
                $data[$caisse_id]['denominations'][$row['denomination_nom']] = $row['quantite'];
            }
        }
        
        error_log("Données formatées pour la vue : " . print_r($data, true));

        // Retourner le tableau structuré
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
            foreach ($caisse_data as $value) { if (!empty($value)) { $has_data = true; break 2; } }
        }
        if (!$has_data) {
            if ($is_autosave) { ob_end_clean(); echo json_encode(['success' => false, 'message' => 'Aucune donnée à sauvegarder.']); }
            else { $_SESSION['message'] = "Aucune donnée n'a été saisie."; header('Location: index.php?page=calculateur'); }
            exit;
        }

        try {
            $comptage_id = null;

            if ($is_autosave) {
                // Logique de SAUVEGARDE AUTOMATIQUE
                $stmt_check = $this->pdo->prepare("SELECT id FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY id DESC LIMIT 1");
                $stmt_check->execute();
                $existing_autosave_id = $stmt_check->fetchColumn();

                if ($existing_autosave_id) {
                    // Mise à jour de l'enregistrement principal
                    $stmt_update_comptage = $this->pdo->prepare("UPDATE comptages SET nom_comptage = ?, explication = ?, date_comptage = ? WHERE id = ?");
                    $stmt_update_comptage->execute([$nom_comptage, $explication, date('Y-m-d H:i:s'), $existing_autosave_id]);
                    $comptage_id = $existing_autosave_id;
                    
                    // Suppression des détails et dénominations précédents pour pouvoir les réinsérer
                    $stmt_delete_details = $this->pdo->prepare("DELETE FROM comptage_details WHERE comptage_id = ?");
                    $stmt_delete_details->execute([$comptage_id]);
                } else {
                    // Création d'une nouvelle sauvegarde automatique
                    $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                    $stmt->execute([$nom_comptage, $explication, date('Y-m-d H:i:s')]);
                    $comptage_id = $this->pdo->lastInsertId();
                }
            } else {
                // Logique de SAUVEGARDE MANUELLE : On crée toujours un nouvel enregistrement.
                // 1. On crée un NOUVEL enregistrement de comptage
                if (empty($nom_comptage)) {
                    $nom_comptage = "Comptage du " . date('Y-m-d H:i:s');
                }
                $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
                $stmt->execute([$nom_comptage, $explication, date('Y-m-d H:i:s')]);
                $comptage_id = $this->pdo->lastInsertId();

                // 2. On supprime l'ancienne sauvegarde automatique pour qu'elle ne soit plus chargée par défaut
                $stmt_delete_autosave = $this->pdo->prepare("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
                $stmt_delete_autosave->execute();
            }

            // Étape d'insertion commune pour les détails et les dénominations
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                if (empty($caisse_data)) {
                    continue;
                }

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
            }

            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
            } else {
                $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !";
                // Rediriger vers le calculateur pour effacer la session de sauvegarde auto
                header('Location: index.php?page=calculateur');
            }
            exit;

        } catch (PDOException $e) {
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
}
