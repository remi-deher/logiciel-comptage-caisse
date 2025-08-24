<?php
// src/CalculateurController.php - Version corrigée pour un nouvel enregistrement à chaque sauvegarde automatique.
// Ce contrôleur gère la page du calculateur et les actions de sauvegarde.
require_once __DIR__ . '/services/VersionService.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/ClotureStateService.php';

class CalculateurController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;
    private $clotureStateService;

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
        // Le service de clôture est maintenant initialisé avec l'objet PDO
        $this->clotureStateService = new ClotureStateService($pdo);
    }
    public function calculateur() {
        $loaded_data = [];
        $isLoadedFromHistory = false;
        $isAutosaveLoaded = false;
    
        // NOUVELLE LOGIQUE : Gère le chargement normal, après sauvegarde, et pour reprendre un comptage
        $comptageIdToLoad = intval($_GET['load'] ?? $_GET['resume_from'] ?? 0);
    
        if ($comptageIdToLoad > 0) {
            if (isset($_GET['resume_from'])) {
                // L'utilisateur veut reprendre un comptage, on le charge en mode actif
                $isLoadedFromHistory = false;
                 $_SESSION['message'] = "Le comptage a été repris. N'oubliez pas de l'enregistrer sous un nouveau nom.";
            } elseif (isset($_SESSION['just_saved']) && $_SESSION['just_saved'] == $comptageIdToLoad) {
                // On vient de sauvegarder, on reste en mode actif
                $isLoadedFromHistory = false;
                unset($_SESSION['just_saved']);
            } else {
                // Chargement standard depuis l'historique en mode consultation
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
        $page_css = 'calculateur.css';
        require __DIR__ . '/../templates/calculateur.php';
    }
    
    // NOUVELLE METHODE: pour récupérer la dernière sauvegarde automatique
    public function getLastAutosaveData() {
        $stmt = $this->pdo->prepare("SELECT id, nom_comptage, explication FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%' ORDER BY date_comptage DESC LIMIT 1");
        $stmt->execute();
        $loaded_comptage = $stmt->fetch() ?: [];
        
        $data = null;
        if ($loaded_comptage) {
            $data = $this->loadComptageData($loaded_comptage['id']);
            $data['nom_comptage'] = $loaded_comptage['nom_comptage'];
            $data['explication'] = $loaded_comptage['explication'];
        }
        
        header('Content-Type: application/json');
        echo json_encode(['success' => !is_null($data), 'data' => $data]);
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
            $this->pdo->beginTransaction(); // DÉBUT DE LA TRANSACTION
    
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
                $stmt_delete_autosave = $this->pdo->prepare("DELETE FROM comptages WHERE nom_comptage LIKE 'Sauvegarde auto%'");
                $stmt_delete_autosave->execute();
            }
    
            // VÉRIFICATION DE SÉCURITÉ
            if (empty($comptage_id)) {
                throw new Exception("La création de l'enregistrement de comptage a échoué.");
            }
    
            foreach ($this->noms_caisses as $caisse_id => $nom) {
                $caisse_data = $_POST['caisse'][$caisse_id] ?? [];
                
                // VÉRIFICATION AMÉLIORÉE : On ne traite que les caisses avec des données.
                $has_real_data_for_caisse = false;
                foreach ($caisse_data as $value) {
                    // Vérifie si la valeur est un nombre et n'est pas zéro
                    if (is_numeric(str_replace(',', '.', $value)) && floatval(str_replace(',', '.', $value)) != 0) {
                        $has_real_data_for_caisse = true;
                        break;
                    }
                }
                
                if (!$has_real_data_for_caisse) {
                    continue; // On passe à la caisse suivante si celle-ci est vide
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
            
            $this->pdo->commit(); // FIN DE LA TRANSACTION (TOUT EST OK)
    
            if ($is_autosave) {
                ob_end_clean();
                echo json_encode(['success' => true, 'message' => 'Sauvegarde auto à ' . date('H:i:s')]);
            } else {
                $_SESSION['message'] = "Comptage '" . htmlspecialchars($nom_comptage) . "' créé avec succès !";
                // CORRECTION : On utilise une variable de session pour indiquer que la sauvegarde vient d'être faite
                $_SESSION['just_saved'] = $comptage_id;
                header('Location: index.php?page=calculateur&load=' . $comptage_id);
            }
            exit;
    
        } catch (Exception $e) { // On attrape toutes les exceptions (PDO ou autres)
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack(); // ANNULATION DE LA TRANSACTION EN CAS D'ERREUR
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
    
    // NOUVEAU: Méthode pour récupérer l'état de clôture depuis la base de données
    public function getClotureState() {
        header('Content-Type: application/json');
        try {
            $lockedCaisses = $this->clotureStateService->getLockedCaisses();
            $closedCaisses = $this->clotureStateService->getClosedCaisses();
            echo json_encode(['success' => true, 'locked_caisses' => $lockedCaisses, 'closed_caisses' => $closedCaisses]);
        } catch (Exception $e) {
            error_log("Erreur lors de la récupération de l'état de clôture : " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur lors de la récupération de l\'état de clôture.']);
        }
        exit;
    }

    // NOUVEAU: Méthode pour gérer la clôture des caisses
    public function cloture() {
        header('Content-Type: application/json');

        // Débogage: Log les données reçues
        error_log("Requête de clôture reçue. Données POST brutes : " . file_get_contents('php://input'));
        error_log("Données POST décodées : " . print_r($_POST, true));

        try {
            // Étape 1: Sauvegarder l'état actuel de la caisse confirmée
            $caisse_id_a_cloturer = intval($_POST['caisse_id_a_cloturer'] ?? 0);
            if ($caisse_id_a_cloturer === 0) {
                error_log("Erreur: ID de caisse invalide reçu.");
                echo json_encode(['success' => false, 'message' => 'ID de caisse invalide.']);
                exit;
            }
            error_log("ID de caisse à clôturer: {$caisse_id_a_cloturer}");

            $nom_cloture = "Clôture de la caisse {$caisse_id_a_cloturer} du " . date('Y-m-d H:i:s');
            $explication = "Clôture quotidienne de la caisse " . $caisse_id_a_cloturer;
            
            // On crée un enregistrement pour cette caisse dans l'historique
            $stmt = $this->pdo->prepare("INSERT INTO comptages (nom_comptage, explication, date_comptage) VALUES (?, ?, ?)");
            $stmt->execute([$nom_cloture, $explication, date('Y-m-d H:i:s')]);
            $comptage_id_cloture = $this->pdo->lastInsertId();
            
            // Insertion des détails pour la caisse confirmée
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

            // Étape 2: On marque la caisse comme confirmée dans le service
            $this->clotureStateService->confirmCaisse($caisse_id_a_cloturer);
            echo json_encode(['success' => true, 'message' => "La caisse a été clôturée avec succès. En attente des autres caisses.", 'all_caisses_confirmed' => false]);
        
        } catch (PDOException $e) {
            error_log("Erreur PDO lors de la clôture : " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur de BDD lors de la clôture : ' . $e->getMessage()]);
        } catch (Exception $e) {
            error_log("Erreur générale lors de la clôture : " . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Erreur inattendue lors de la clôture.']);
        }
        exit;
    }
}
