<?php
// src/HistoriqueController.php (Version Finale Complète et Corrigée)

require_once __DIR__ . '/services/VersionService.php';
require_once __DIR__ . '/Utils.php';
require_once __DIR__ . '/services/FilterService.php';

class HistoriqueController {
    private $pdo;
    private $noms_caisses;
    private $denominations;
    private $tpe_par_caisse;
    private $versionService;
    private $filterService;

    public function __construct($pdo, $noms_caisses, $denominations, $tpe_par_caisse) {
        $this->pdo = $pdo;
        $this->noms_caisses = $noms_caisses;
        $this->denominations = $denominations;
        $this->tpe_par_caisse = $tpe_par_caisse;
        $this->versionService = new VersionService();
        $this->filterService = new FilterService();
    }

    public function getHistoriqueDataJson()
    {
        header('Content-Type: application/json');

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
        $stmt_ids->execute(array_merge($bind_values, [$items_par_page, $offset]));
        $comptage_ids = $stmt_ids->fetchAll(PDO::FETCH_COLUMN);

        $historique_page = $this->fetchComptagesDetails($comptage_ids);

        $sql_all_ids = "SELECT id FROM comptages" . $sql_where . " ORDER BY date_comptage DESC";
        $stmt_all_ids = $this->pdo->prepare($sql_all_ids);
        $stmt_all_ids->execute($bind_values);
        $all_comptage_ids = $stmt_all_ids->fetchAll(PDO::FETCH_COLUMN);
        $historique_complet = $this->fetchComptagesDetails($all_comptage_ids);

        echo json_encode([
            'success' => true,
            'historique' => $historique_page,
            'historique_complet' => $historique_complet,
            'page_courante' => $page,
            'pages_totales' => $pages_totales,
            'total_items' => $total_items
        ]);
        exit;
    }

    private function fetchComptagesDetails(array $comptage_ids) {
        if (empty($comptage_ids)) return [];

        $historique = [];
        $placeholders = implode(',', array_fill(0, count($comptage_ids), '?'));

        $stmt = $this->pdo->prepare("
            SELECT 
                c.id, c.nom_comptage, c.date_comptage, c.explication,
                cd.caisse_id, cd.fond_de_caisse, 
                cd.ventes_especes, cd.ventes_cb, cd.ventes_cheques, 
                cd.retrocession,
                cd.id as comptage_detail_id
            FROM comptages c
            LEFT JOIN comptage_details cd ON c.id = cd.comptage_id
            WHERE c.id IN ({$placeholders})
            ORDER BY c.date_comptage DESC, cd.caisse_id ASC
        ");
        
        $stmt->execute($comptage_ids);
        $raw_data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($raw_data as $row) {
            $comptage_id = $row['id'];
            if (!isset($historique[$comptage_id])) {
                $historique[$comptage_id] = [
                    'id' => $comptage_id,
                    'nom_comptage' => $row['nom_comptage'],
                    'date_comptage' => $row['date_comptage'],
                    'explication' => $row['explication'],
                    'caisses_data' => []
                ];
            }
            
            $stmt_denoms = $this->pdo->prepare("SELECT denomination_nom, quantite FROM comptage_denominations WHERE comptage_detail_id = ?");
            $stmt_denoms->execute([$row['comptage_detail_id']]);
            $denominations_array = $stmt_denoms->fetchAll(PDO::FETCH_ASSOC);

            $stmt_retraits = $this->pdo->prepare("SELECT denomination_nom, quantite_retiree FROM comptage_retraits WHERE comptage_detail_id = ?");
            $stmt_retraits->execute([$row['comptage_detail_id']]);
            $retraits_array = $stmt_retraits->fetchAll(PDO::FETCH_KEY_PAIR);
            
            $stmt_cheques = $this->pdo->prepare("SELECT montant, commentaire FROM comptage_cheques WHERE comptage_detail_id = ?");
            $stmt_cheques->execute([$row['comptage_detail_id']]);
            $cheques_array = $stmt_cheques->fetchAll(PDO::FETCH_ASSOC);

            // CORRECTION : On récupère les relevés TPE et on les groupe manuellement
            $stmt_cb = $this->pdo->prepare("SELECT terminal_id, montant, heure_releve FROM comptage_cb WHERE comptage_detail_id = ? ORDER BY heure_releve ASC");
            $stmt_cb->execute([$row['comptage_detail_id']]);
            $releves_bruts = $stmt_cb->fetchAll(PDO::FETCH_ASSOC);
            $cb_releves_array = [];
            foreach ($releves_bruts as $releve) {
                $cb_releves_array[$releve['terminal_id']][] = [
                    'montant' => $releve['montant'],
                    'heure' => $releve['heure_releve']
                ];
            }

            $historique[$comptage_id]['caisses_data'][$row['caisse_id']] = [
                'fond_de_caisse' => $row['fond_de_caisse'],
                'ventes_especes' => $row['ventes_especes'],
                'ventes_cb' => $row['ventes_cb'],
                'ventes_cheques' => $row['ventes_cheques'],
                'retrocession' => $row['retrocession'],
                'denominations' => $denominations_array,
                'retraits' => $retraits_array,
                'cb' => $cb_releves_array,
                'cheques' => $cheques_array
            ];
        }

        foreach ($historique as &$comptage) {
            $comptage['results'] = calculate_results_from_data($comptage['caisses_data']);
        }

        return array_values($historique);
    }

    public function delete() {
        header('Content-Type: application/json');
        AuthController::checkAuth();
        $id_a_supprimer = intval($_POST['id_a_supprimer'] ?? 0);

        if ($id_a_supprimer > 0) {
            try {
                $stmt = $this->pdo->prepare("DELETE FROM comptages WHERE id = ?");
                $stmt->execute([$id_a_supprimer]);
                echo json_encode(['success' => true, 'message' => "Le comptage a bien été supprimé."]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => "Erreur de base de données : " . $e->getMessage()]);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "ID de comptage invalide."]);
        }
        exit;
    }

    public function exportCsv()
    {
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

        $historique = $this->fetchComptagesDetails($comptage_ids);

        $filename = "export-comptages-" . date('Y-m-d') . ".csv";
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        
        $header = ['ID', 'Nom', 'Date', 'Explication'];
        foreach ($this->noms_caisses as $id => $nom) {
            $header[] = "Caisse {$id} - Nom";
            $header[] = "Caisse {$id} - Fond de caisse";
            $header[] = "Caisse {$id} - Ventes Espèces";
            $header[] = "Caisse {$id} - Ventes CB";
            $header[] = "Caisse {$id} - Ventes Chèques";
            $header[] = "Caisse {$id} - Rétrocession";
            foreach ($this->denominations as $type => $denoms) {
                foreach ($denoms as $key => $value) {
                    $label = ($value >= 1) ? "{$value} €" : "{$value} cts";
                    $header[] = "Caisse {$id} - {$label}";
                }
            }
        }
        fputcsv($output, $header, ';');

        foreach ($historique as $comptage) {
            $rowData = [$comptage['id'], $comptage['nom_comptage'], $comptage['date_comptage'], $comptage['explication']];
            foreach ($this->noms_caisses as $caisse_id => $nom_caisse) {
                $caisse_data = $comptage['caisses_data'][$caisse_id] ?? null;
                if ($caisse_data) {
                    $rowData[] = $nom_caisse;
                    $rowData[] = str_replace('.', ',', $caisse_data['fond_de_caisse']);
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_especes'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_cb'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['ventes_cheques'] ?? '0');
                    $rowData[] = str_replace('.', ',', $caisse_data['retrocession']);
                    foreach ($this->denominations as $type => $denoms) {
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
                    $columnCount = 6 + count($this->denominations['billets']) + count($this->denominations['pieces']);
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
