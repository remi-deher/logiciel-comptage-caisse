<?php
// src/services/ReserveService.php

class ReserveService {
    private $pdo;
    private $all_denominations = [];

    public function __construct(PDO $pdo, $denominations) {
        $this->pdo = $pdo;
        foreach ($denominations as $type) {
            foreach ($type as $key => $value) {
                $this->all_denominations[$key] = $value;
            }
        }
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
        $demandes = $stmt->fetchAll();
        foreach($demandes as &$demande) {
            $demande['caisse_nom'] = $noms_caisses[$demande['caisse_id']] ?? 'Inconnue';
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
        $valeur_demandee = 0;
        $demande_items = [];
        $valeur_proposee = 0;
        $donne_items = [];

        // --- DÉBUT DE LA CORRECTION : GESTION DES DEUX FORMATS DE DONNÉES ---
        
        // Cas 1 : Nouveau format (multi-dénominations via le calculateur)
        if (isset($data['demande_denoms']) || isset($data['donne_denoms'])) {
            if (isset($data['demande_denoms']) && is_array($data['demande_denoms'])) {
                foreach ($data['demande_denoms'] as $index => $denom) {
                    $qty = intval($data['demande_qtys'][$index] ?? 0);
                    if ($qty > 0) {
                        $valeur_demandee += ($this->all_denominations[$denom] ?? 0) * $qty;
                        $demande_items[] = ['denom' => $denom, 'qty' => $qty];
                    }
                }
            }

            if (isset($data['donne_denoms']) && is_array($data['donne_denoms'])) {
                foreach ($data['donne_denoms'] as $index => $denom) {
                    $qty = intval($data['donne_qtys'][$index] ?? 0);
                    if ($qty > 0) {
                        $valeur_proposee += ($this->all_denominations[$denom] ?? 0) * $qty;
                        $donne_items[] = ['denom' => $denom, 'qty' => $qty];
                    }
                }
            }

            if (abs($valeur_demandee - $valeur_proposee) > 0.01) {
                throw new Exception("La balance de l'échange proposé n'est pas équilibrée.");
            }

        } else {
            // Cas 2 : Ancien format (simple demande, pour la rétrocompatibilité des tests)
            $denom_demandee = $data['denomination_demandee'] ?? $data['denomination_vers_caisse'] ?? null;
            $qty_demandee = intval($data['quantite_demandee'] ?? $data['quantite_vers_caisse'] ?? 0);

            if ($denom_demandee && $qty_demandee > 0) {
                $valeur_demandee = ($this->all_denominations[$denom_demandee] ?? 0) * $qty_demandee;
                $demande_items[] = ['denom' => $denom_demandee, 'qty' => $qty_demandee];
            }
        }
        // --- FIN DE LA CORRECTION ---
        
        if (empty($demande_items) && empty($donne_items)) {
             throw new Exception("La proposition d'échange est vide.");
        }

        $notes_demandeur = trim($data['notes_demandeur'] ?? '');
        $exchange_proposal = [
            'vers_caisse' => $demande_items,
            'depuis_caisse' => $donne_items
        ];
        $notes_finales = json_encode($exchange_proposal);
        if (!empty($notes_demandeur)) {
            $notes_finales .= "\n\n--- Notes ---\n" . $notes_demandeur;
        }

        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $now_function = ($driver === 'sqlite') ? "datetime('now')" : "NOW()";

        $premiere_denom_demandee = !empty($demande_items) ? $demande_items[0]['denom'] : 'multiple';
        $premiere_qty_demandee = !empty($demande_items) ? $demande_items[0]['qty'] : 0;

        $sql = "INSERT INTO reserve_demandes (date_demande, caisse_id, demandeur_nom, denomination_demandee, quantite_demandee, valeur_demandee, notes_demandeur, statut) 
                VALUES ({$now_function}, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $data['caisse_id'],
            $_SESSION['admin_username'] ?? 'Operateur',
            $premiere_denom_demandee,
            $premiere_qty_demandee,
            $valeur_demandee,
            $notes_finales
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
            // Décrémenter la réserve
            $stmt = $this->pdo->prepare("UPDATE reserve_denominations SET quantite = quantite - ? WHERE denomination_nom = ? AND quantite >= ?");
            $stmt->execute([$data['quantite_vers_caisse'], $data['denomination_vers_caisse'], $data['quantite_vers_caisse']]);
            if ($stmt->rowCount() == 0) {
                throw new Exception("Quantité insuffisante dans la réserve pour la dénomination demandée.");
            }

            // Incrémenter la réserve
            $stmt = $this->pdo->prepare("UPDATE reserve_denominations SET quantite = quantite + ? WHERE denomination_nom = ?");
            $stmt->execute([$data['quantite_depuis_caisse'], $data['denomination_depuis_caisse']]);
            
            $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            $now_function = ($driver === 'sqlite') ? "datetime('now')" : "NOW()";
            
            // Mettre à jour la demande
            $stmt = $this->pdo->prepare("UPDATE reserve_demandes SET statut = 'TRAITEE', date_traitement = {$now_function}, approbateur_nom = ? WHERE id = ?");
            $stmt->execute([$_SESSION['admin_username'] ?? 'Admin', $data['demande_id']]);

            // Ajouter au journal des opérations
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
