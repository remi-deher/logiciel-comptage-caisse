<?php
// src/services/ReserveService.php

class ReserveService {
    private $pdo;
    private $all_denominations = [];
    private $rouleaux_pieces = []; 

    public function __construct(PDO $pdo, $denominations) {
        global $rouleaux_pieces; 
        $this->pdo = $pdo;
        foreach ($denominations as $type) {
            foreach ($type as $key => $value) {
                $this->all_denominations[$key] = floatval($value);
            }
        }
        $this->rouleaux_pieces = $rouleaux_pieces ?? [];
    }

    public function initDenominations() {
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM reserve_denominations");
        if ($stmt->fetchColumn() == 0) {
            $sql = "INSERT INTO reserve_denominations (denomination_nom, quantite) VALUES ";
            $values = [];
            foreach ($this->all_denominations as $nom => $valeur) {
                $values[] = "('{$nom}', 0)";
            }
            $sql .= implode(', ', $values);
            $this->pdo->exec($sql);
        }
    }

    public function updateQuantities(array $quantities) {
        $this->pdo->beginTransaction();
        try {
            foreach ($quantities as $denomination_nom => $quantite) {
                if (!isset($this->all_denominations[$denomination_nom])) {
                    continue;
                }
                $stmt = $this->pdo->prepare(
                    "UPDATE reserve_denominations SET quantite = ? WHERE denomination_nom = ?"
                );
                $stmt->execute([intval($quantite), $denomination_nom]);
            }
            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            error_log("Erreur lors de la mise à jour de la réserve : " . $e->getMessage());
            return false;
        }
    }

    public function getReserveStatus() {
        $stmt = $this->pdo->query("SELECT * FROM reserve_denominations");
        $denominations = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $total = 0;
        foreach ($denominations as $nom => $qte) {
            $total += $qte * ($this->all_denominations[$nom] ?? 0);
        }
        return ['denominations' => $denominations, 'total' => $total];
    }

    public function getDemandesEnAttente() {
        global $noms_caisses;
        $stmt = $this->pdo->query("SELECT * FROM reserve_demandes WHERE statut = 'EN_ATTENTE' ORDER BY date_demande ASC");
        $demandes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach($demandes as &$demande) {
            $demande['caisse_nom'] = $noms_caisses[$demande['caisse_id']] ?? 'Inconnue';
            $demande['details'] = json_decode($demande['details_json'], true);
        }
        return $demandes;
    }

    public function getHistoriqueOperations($limit = 10) {
        global $noms_caisses;
        $stmt = $this->pdo->prepare("SELECT * FROM reserve_operations_log ORDER BY date_operation DESC LIMIT ?");
        $stmt->execute([$limit]);
        $historique = $stmt->fetchAll();
         foreach($historique as &$item) {
            $item['caisse_nom'] = $noms_caisses[$item['caisse_id']] ?? 'Inconnue';
        }
        return $historique;
    }

    public function createDemande($data) {
        $details_demande = [];
        $valeur_totale = 0;

        // --- DÉBUT DE LA CORRECTION : GESTION DE LA RÉTROCOMPATIBILITÉ ---
        // Si les nouvelles clés (pièces/billets) n'existent pas, on traite l'ancien format des tests.
        if (!isset($data['demande_pieces_denoms']) && !isset($data['demande_billets_denoms'])) {
            $denom = $data['denomination_demandee'] ?? null;
            $qty = intval($data['quantite_demandee'] ?? 0);

            if ($denom && $qty > 0) {
                // On détermine si c'est un billet ou une pièce pour le type
                $type = isset($this->all_denominations[$denom]) && strpos($denom, 'b') === 0 ? 'billet' : 'piece';
                $details_demande[] = ['type' => $type, 'denomination' => $denom, 'quantite' => $qty];
                $valeur_totale += $qty * ($this->all_denominations[$denom] ?? 0);
            }
        } else {
            // --- FIN DE LA CORRECTION ---

            // Traitement des pièces et des rouleaux (nouveau format)
            if (isset($data['demande_pieces_denoms']) && is_array($data['demande_pieces_denoms'])) {
                foreach ($data['demande_pieces_denoms'] as $index => $denom) {
                    $qty_pieces = intval($data['demande_pieces_qtys'][$index] ?? 0);
                    $qty_rouleaux = intval($data['demande_rouleaux_qtys'][$index] ?? 0);

                    if ($qty_pieces > 0) {
                        $details_demande[] = ['type' => 'piece', 'denomination' => $denom, 'quantite' => $qty_pieces];
                        $valeur_totale += $qty_pieces * ($this->all_denominations[$denom] ?? 0);
                    }
                    if ($qty_rouleaux > 0) {
                        $details_demande[] = ['type' => 'rouleau', 'denomination' => $denom, 'quantite' => $qty_rouleaux];
                        $pieces_par_rouleau = $this->rouleaux_pieces[$denom] ?? 0;
                        $valeur_totale += $qty_rouleaux * $pieces_par_rouleau * ($this->all_denominations[$denom] ?? 0);
                    }
                }
            }

            // Traitement des billets (nouveau format)
            if (isset($data['demande_billets_denoms']) && is_array($data['demande_billets_denoms'])) {
                foreach ($data['demande_billets_denoms'] as $index => $denom) {
                    $qty = intval($data['demande_billets_qtys'][$index] ?? 0);
                    if ($qty > 0) {
                        $details_demande[] = ['type' => 'billet', 'denomination' => $denom, 'quantite' => $qty];
                        $valeur_totale += $qty * ($this->all_denominations[$denom] ?? 0);
                    }
                }
            }
        }

        if (empty($details_demande)) {
             throw new Exception("La demande est vide.");
        }
        
        $notes_demandeur = trim($data['notes_demandeur'] ?? '');
        $details_json = json_encode($details_demande);

        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $now_function = ($driver === 'sqlite') ? "datetime('now')" : "NOW()";

        $sql = "INSERT INTO reserve_demandes (date_demande, caisse_id, demandeur_nom, valeur_demandee, details_json, notes_demandeur, statut) 
                VALUES ({$now_function}, ?, ?, ?, ?, ?, 'EN_ATTENTE')";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $data['caisse_id'],
            $_SESSION['admin_username'] ?? 'Operateur',
            round($valeur_totale, 2),
            $details_json,
            $notes_demandeur
        ]);
        return $this->pdo->lastInsertId();
    }
    
    public function processDemande($data) {
        $valeur_vers_caisse = ($this->all_denominations[$data['denomination_vers_caisse']] ?? 0) * intval($data['quantite_vers_caisse']);
        $valeur_depuis_caisse = ($this->all_denominations[$data['denomination_depuis_caisse']] ?? 0) * intval($data['quantite_depuis_caisse']);

        if (abs($valeur_vers_caisse - $valeur_depuis_caisse) > 0.01) {
            throw new Exception("La balance de l'échange n'est pas équilibrée.");
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("UPDATE reserve_denominations SET quantite = quantite - ? WHERE denomination_nom = ? AND quantite >= ?");
            $stmt->execute([$data['quantite_vers_caisse'], $data['denomination_vers_caisse'], $data['quantite_vers_caisse']]);
            if ($stmt->rowCount() == 0) {
                throw new Exception("Quantité insuffisante dans la réserve pour la dénomination '" . $data['denomination_vers_caisse'] . "'.");
            }

            $stmt = $this->pdo->prepare("UPDATE reserve_denominations SET quantite = quantite + ? WHERE denomination_nom = ?");
            $stmt->execute([$data['quantite_depuis_caisse'], $data['denomination_depuis_caisse']]);
            
            $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            $now_function = ($driver === 'sqlite') ? "datetime('now')" : "NOW()";
            
            $stmt = $this->pdo->prepare("UPDATE reserve_demandes SET statut = 'TRAITEE', date_traitement = {$now_function}, approbateur_nom = ? WHERE id = ?");
            $stmt->execute([$_SESSION['admin_username'] ?? 'Admin', $data['demande_id']]);

            $sql_log = "INSERT INTO reserve_operations_log (demande_id, date_operation, caisse_id, denomination_vers_caisse, quantite_vers_caisse, denomination_depuis_caisse, quantite_depuis_caisse, valeur_echange, notes, approbateur_nom)
                        VALUES (?, {$now_function}, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt_log = $this->pdo->prepare($sql_log);

            $stmt_log->execute([
                $data['demande_id'], $data['caisse_id'],
                $data['denomination_vers_caisse'], $data['quantite_vers_caisse'],
                $data['denomination_depuis_caisse'], $data['quantite_depuis_caisse'],
                $valeur_vers_caisse, $data['notes'], $_SESSION['admin_username'] ?? 'Admin'
            ]);

            $this->pdo->commit();
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
