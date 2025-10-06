<?php
// src/HistoriqueController.php (Version Finale Complète et Corrigée)

require_once __DIR__ . '/services/VersionService.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/FilterService.php';

class HistoriqueController {
    private $pdo;
    private $comptageRepository; // Utilise le Repository
    private $filterService;

    // Le constructeur est simplifié
    public function __construct($pdo, $comptageRepository) {
        $this->pdo = $pdo;
        $this->comptageRepository = $comptageRepository;
        $this->filterService = new FilterService();
    }

    public function getHistoriqueDataJson()
    {
        header('Content-Type: application/json');

        try {
            $page = isset($_GET['p']) ? (int)$_GET['p'] : 1;
            $items_par_page = 10;
            $offset = ($page - 1) * $items_par_page;

            $date_debut = $_GET['date_debut'] ?? '';
            $date_fin = $_GET['date_fin'] ?? '';
            $recherche = $_GET['recherche'] ?? '';

            $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, $recherche);
            $sql_where = $filter_params['sql_where'];
            $bind_values = $filter_params['bind_values'];

            $sql_total = "SELECT COUNT(id) FROM comptages" . $sql_where;
            $stmt_total = $this->pdo->prepare($sql_total);
            $stmt_total->execute($bind_values);
            $total_items = $stmt_total->fetchColumn();
            $pages_totales = ceil($total_items / $items_par_page);

            $sql_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC LIMIT ? OFFSET ?";
            $stmt_ids = $this->pdo->prepare($sql_ids);
            
            $stmt_ids->bindValue(count($bind_values) + 1, $items_par_page, PDO::PARAM_INT);
            $stmt_ids->bindValue(count($bind_values) + 2, $offset, PDO::PARAM_INT);
            foreach ($bind_values as $key => $value) {
                $stmt_ids->bindValue($key + 1, $value);
            }
            $stmt_ids->execute();
            $comptage_ids = $stmt_ids->fetchAll(PDO::FETCH_COLUMN);
            
            $historique_page = $this->comptageRepository->findMultipleDetailsByIds($comptage_ids);

            $sql_all_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC";
            $stmt_all_ids = $this->pdo->prepare($sql_all_ids);
            $stmt_all_ids->execute($bind_values);
            $all_comptage_ids = $stmt_all_ids->fetchAll(PDO::FETCH_COLUMN);
            $historique_complet = $this->comptageRepository->findMultipleDetailsByIds($all_comptage_ids);

            echo json_encode([
                'success' => true,
                'historique' => $historique_page,
                'historique_complet' => $historique_complet,
                'page_courante' => $page,
                'pages_totales' => $pages_totales,
                'total_items' => $total_items
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => "Erreur serveur lors de la récupération de l'historique : " . $e->getMessage()]);
        }
        exit;
    }

    public function delete() {
        header('Content-Type: application/json');
        
        // On vérifie l'authentification en premier
        // Si l'utilisateur n'est pas connecté, le script s'arrête ici avec une erreur 401
        AuthController::checkAuth();
        
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);

        if ($id_a_supprimer > 0) {
            try {
                // On s'assure que la suppression a bien eu lieu en vérifiant le nombre de lignes affectées
                $stmt = $this->pdo->prepare("DELETE FROM comptages WHERE id = ?");
                $stmt->execute([$id_a_supprimer]);

                if ($stmt->rowCount() > 0) {
                    echo json_encode(['success' => true, 'message' => "Le comptage a bien été supprimé."]);
                } else {
                    http_response_code(404); // Not Found
                    echo json_encode(['success' => false, 'message' => "Le comptage avec l'ID {$id_a_supprimer} n'a pas été trouvé."]);
                }
            } catch (Exception $e) {
                http_response_code(500);
                // On logue l'erreur pour le débogage côté serveur
                error_log("Erreur de suppression du comptage : " . $e->getMessage());
                echo json_encode(['success' => false, 'message' => "Erreur de base de données lors de la suppression."]);
            }
        } else {
            http_response_code(400); // Bad Request
            echo json_encode(['success' => false, 'message' => "ID de comptage invalide ou manquant."]);
        }
        exit;
    }
    
    public function exportCsv()
    {
        // ... (Cette méthode reste inchangée)
        global $noms_caisses, $denominations;
        
        $date_debut = $_GET['date_debut'] ?? '';
        $date_fin = $_GET['date_fin'] ?? '';
        $recherche = $_GET['recherche'] ?? '';
        
        $filter_params = $this->filterService->getWhereClauseAndBindings($date_debut, $date_fin, $recherche);
        $sql_where = $filter_params['sql_where'];
        $bind_values = $filter_params['bind_values'];

        $sql_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC";
        $stmt_ids = $this->pdo->prepare($sql_ids);
        $stmt_ids->execute($bind_values);
        $comptage_ids = $stmt_ids->fetchAll(PDO::FETCH_COLUMN);

        $historique = $this->comptageRepository->findMultipleDetailsByIds($comptage_ids);

        $filename = "export-comptages-" . date('Y-m-d') . ".csv";
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        
        $header = ['ID', 'Nom', 'Date', 'Explication'];
        foreach ($noms_caisses as $id => $nom) {
            $header[] = "Caisse {$id} - Nom";
            $header[] = "Caisse {$id} - Fond de caisse";
            $header[] = "Caisse {$id} - Ventes Espèces";
            $header[] = "Caisse {$id} - Ventes CB";
            $header[] = "Caisse {$id} - Ventes Chèques";
            $header[] = "Caisse {$id} - Rétrocession";
            $header[] = "Caisse {$id} - Rétrocession CB";
            $header[] = "Caisse {$id} - Rétrocession Chèques";
            foreach ($denominations as $type => $denoms) {
                foreach ($denoms as $key => $value) {
                    $label = ($value >= 1) ? "{$value} €" : "{$value} cts";
                    $header[] = "Caisse {$id} - {$label}";
                }
            }
        }
        fputcsv($output, $header, ';');

        foreach ($historique as $comptage) {
            $rowData = [$comptage['id'], $comptage['nom_comptage'], $comptage['date_comptage'], $comptage['explication']];
            foreach ($noms_caisses as $caisse_id => $nom_caisse) {
                $caisse_data = $comptage['caisses_data'][$caisse_id] ?? null;
                if ($caisse_data) {
                    $rowData[] = $nom_caisse;
                    $rowData[] = str_replace('.', ',', $caisse_data['fond_de_caisse']);
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_especes'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_cb'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_cheques'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['retrocession']);
                    $rowData[] = str_replace('.', ',', $caisse_data['retrocession_cb']);
                    $rowData[] = str_replace('.', ',', $caisse_data['retrocession_cheques']);
                    foreach ($denominations as $type => $denoms) {
                        foreach (array_keys($denoms) as $key) {
                             $denom_value = 0;
                            foreach($caisse_data['denominations'] as $d){
                                if($d['denomination_nom'] === $key){
                                    $denom_value = $d['quantite'];
                                    break;
                                }
                            }
                            $rowData[] = $denom_value;
                        }
                    }
                } else {
                    $columnCount = 8 + count($denominations['billets']) + count($denominations['pieces']);
                    for ($i=0; $i < $columnCount; $i++) { 
                        $rowData[] = '';
                    }
                }
            }
            fputcsv($output, $rowData, ';');
        }
        fclose($output);
        exit;
    }
}
