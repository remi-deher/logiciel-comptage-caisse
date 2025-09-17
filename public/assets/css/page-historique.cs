/* ==========================================================================
   public/css/historique.css (Version Finale Complète et Corrigée)
   ========================================================================== */

/* --- Onglets de vue --- */
.view-tabs {
    border-bottom: 2px solid var(--color-border-light);
    margin-bottom: 20px;
}
.view-tabs .tab-link {
    display: inline-block;
    padding: 10px 20px;
    font-weight: bold;
    color: var(--color-text-muted);
    text-decoration: none;
    border: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    transition: color 0.2s, border-color 0.2s;
    background-color: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 1em;
}
.view-tabs .tab-link:hover {
    color: var(--color-text-primary);
}
.view-tabs .tab-link.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}
.view-content {
    display: none;
}
.view-content.active {
    display: block;
}

/* --- Contrôles (Actions et Filtres) --- */
.history-controls {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
}
.history-actions {
    display: flex;
    flex-wrap: wrap;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px var(--shadow-color);
    border: 1px solid var(--color-border-light);
}
.action-btn {
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    border: none;
    border-right: 1px solid var(--color-border-light);
    padding: 10px 15px;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 600;
    transition: background-color 0.2s, opacity 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.action-btn:last-child { border-right: none; }
.action-btn:hover { background-color: var(--color-surface-alt-hover); }
.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-surface-alt);
}
.filter-section {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 4px 10px var(--shadow-color);
}
.filter-section h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    font-weight: bold;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: 10px;
}
.filter-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: flex-end;
}

/* --- Grille des cartes --- */
.history-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 25px; }
.history-card { 
    background-color: var(--color-surface); 
    border: 1px solid var(--color-border-light);
    border-left: 5px solid var(--color-border-light);
    box-shadow: 0 4px 25px var(--shadow-color); 
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    position: relative;
}
.history-card:hover { transform: translateY(-5px); box-shadow: 0 8px 30px var(--shadow-color); }

.history-card.ecart-ok { border-left-color: var(--color-success); }
.history-card.ecart-positif { border-left-color: var(--color-warning); }
.history-card.ecart-negatif { border-left-color: var(--color-danger); }

.history-card.selected {
    border-color: var(--color-primary);
    box-shadow: 0 8px 30px var(--shadow-color), 0 0 0 3px var(--color-primary);
}
.comparison-checkbox {
    position: absolute;
    top: 15px;
    right: 15px;
    transform: scale(1.5);
    cursor: pointer;
}
.history-card-header { border-bottom: 1px solid var(--color-border-light); padding: 20px; }
.history-card-header h4 { margin: 0 0 5px 0; font-size: 1.3em; padding-right: 25px; }
.history-card-header .date { color: var(--color-text-muted); font-size: 0.9em; }
.history-card-header .explication { color: var(--color-text-secondary); font-size: 0.95em; margin-top: 8px; font-style: italic; }
.history-card-body { padding: 20px; flex-grow: 1; }
.summary-line { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; font-size: 1.05em; }
.summary-line:not(:last-child) { border-bottom: 1px solid var(--color-border-light); }
.summary-line div { display: flex; align-items: center; gap: 10px; }
.summary-line span { font-weight: bold; font-family: monospace; }
.total-ecart .ecart-value {
    color: var(--color-text-primary);
}
.history-card.ecart-ok .total-ecart .ecart-value {
    color: var(--color-success);
}
.history-card.ecart-positif .total-ecart .ecart-value {
    color: var(--color-warning);
}
.history-card.ecart-negatif .total-ecart .ecart-value {
    color: var(--color-danger);
}
.history-card-footer { background-color: var(--color-surface-alt); border-top: 1px solid var(--color-border-light); padding: 15px 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: flex-start;}

/* --- Pagination --- */
.pagination-nav { display: flex; justify-content: center; margin-bottom: 20px; }
.pagination { display: inline-flex; list-style: none; padding: 0; margin: 0; gap: 8px; }
.pagination li a, .pagination li span { background-color: var(--color-surface-alt); border: 1px solid var(--color-border-light); color: var(--color-text-secondary); border-radius: 6px; padding: 10px 18px; text-decoration: none; transition: all 0.2s ease; font-weight: 600; }
.pagination li a:hover { border-color: var(--color-primary); color: var(--color-primary); background-color: rgba(52, 152, 219, 0.1); }
.pagination li.active span { background-color: var(--color-primary); color: white; border-color: var(--color-primary); }
.pagination li.disabled span { color: var(--color-text-muted); cursor: not-allowed; }

/* === NOUVEAU: Panneau de détails inférieur (Bottom Sheet) === */
.details-sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s;
}
.details-sheet-overlay.visible {
    opacity: 1;
    visibility: visible;
}
.details-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background-color: var(--color-surface);
    border-top: 1px solid var(--color-border);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -5px 30px rgba(0,0,0,0.2);
    z-index: 1000;
    transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    display: flex;
    flex-direction: column;
}
.details-sheet.visible {
    transform: translateY(0);
}
.details-sheet-header {
    padding: 15px 20px;
    border-bottom: 1px solid var(--color-border-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.details-sheet-handle {
    width: 50px;
    height: 24px;
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
    display: flex;
    align-items: center;
    justify-content: center;
}
.details-sheet-handle::before {
    content: '';
    width: 40px;
    height: 5px;
    background-color: var(--color-border);
    border-radius: 3px;
}
.details-sheet-header .title-container h3 { margin: 0; border: none; }
.details-sheet-header .title-container p { margin: 5px 0 0; color: var(--color-text-secondary); font-size: 0.9em; }
.details-sheet-actions { display: flex; gap: 10px; align-items: center; }
.details-sheet-close-btn { background: none; border: none; font-size: 1.5em; cursor: pointer; color: var(--color-text-muted); }
.details-sheet-content {
    padding: 25px 30px;
    overflow-y: auto;
    flex-grow: 1;
}
/* === FIN DU NOUVEAU BLOC === */

/* --- Boutons d'action dans les cartes --- */
.action-btn-small {
    padding: 8px 15px;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    border-radius: 20px;
    border: 2px solid transparent;
    transition: all 0.2s ease-in-out;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    line-height: 1;
}
.details-btn {
    background-color: var(--color-surface-alt);
    color: var(--color-text-secondary);
    border-color: var(--color-border-light);
}
.details-btn:hover {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px var(--shadow-color);
}
.load-btn {
    background-color: rgba(39, 174, 96, 0.1);
    color: var(--color-success-dark);
    border-color: transparent;
}
.load-btn:hover {
    background-color: var(--color-success);
    color: white;
}
.delete-btn {
    background-color: rgba(192, 57, 43, 0.1);
    color: var(--color-danger-dark);
    border-color: transparent;
}
.delete-btn:hover {
    background-color: var(--color-danger);
    color: white;
}

/* --- Styles pour la vue des retraits (inchangés) --- */
.withdrawals-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
    margin-bottom: 25px;
}
.withdrawals-header h3 { margin: 0; border: none; font-size: 1.5em; }
.info-table { width: 100%; border-collapse: collapse; }
.info-table th, .info-table td { padding: 8px; text-align: left; border-bottom: 1px solid var(--color-border-light); }
.info-table thead th { font-weight: bold; color: var(--color-text-secondary); }
.info-table td:nth-child(2), .info-table td:nth-child(3) { text-align: right; font-family: monospace; }
.withdrawals-log-wrapper { margin-top: 30px; background-color: var(--color-surface-alt); padding: 20px; border-radius: 12px; }
#withdrawals-log-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
.day-card { background-color: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 8px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; position: relative; }
.day-card:hover { transform: translateY(-4px); box-shadow: 0 6px 15px var(--shadow-color); }
.day-card-header { display: flex; align-items: center; gap: 10px; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid var(--color-border-light); color: var(--color-primary); }
.day-card-body { display: flex; justify-content: space-around; padding: 15px; flex-grow: 1; }
.day-kpi { text-align: center; }
.day-kpi span { font-size: 0.9em; color: var(--color-text-secondary); display: block; }
.day-kpi strong { font-size: 1.6em; display: block; }
.day-card-footer { padding: 10px 15px; background-color: var(--color-surface-alt); border-top: 1px solid var(--color-border-light); text-align: right; }

/* Styles pour le contenu à l'intérieur du panneau de détails (ancienne modale) */
.summary-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    list-style: none;
    padding: 0;
    margin-top: 15px;
}
.summary-list li {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border-light);
    border-left-width: 5px;
    border-radius: 8px;
    padding: 15px;
    display: flex;
    align-items: center;
    gap: 15px;
}
.summary-list .summary-icon {
    font-size: 1.8em; padding: 10px; border-radius: 50%;
    background-color: var(--color-surface);
    width: 30px; height: 30px; text-align: center;
}
.summary-list li div { display: flex; flex-direction: column; }
.summary-list li span { font-size: 0.9em; color: var(--color-text-secondary); }
.summary-list li strong { font-size: 1.4em; font-weight: 600; color: var(--color-text-primary); }
.summary-list li.ecart-ok { border-left-color: var(--color-success); }
.summary-list li.ecart-ok .summary-icon, .summary-list li.ecart-ok strong { color: var(--color-success); }
.summary-list li.ecart-positif { border-left-color: var(--color-warning); }
.summary-list li.ecart-positif .summary-icon, .summary-list li.ecart-positif strong { color: var(--color-warning); }
.summary-list li.ecart-negatif { border-left-color: var(--color-danger); }
.summary-list li.ecart-negatif .summary-icon, .summary-list li.ecart-negatif strong { color: var(--color-danger); }
.modal-details-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 30px;
}
@media (min-width: 1024px) {
    .modal-details-layout {
        grid-template-columns: 350px 1fr;
    }
}
.modal-charts-container h4 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    text-align: center;
}
.modal-charts-container .chart-wrapper {
    background-color: var(--color-surface-alt);
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
}
.modal-details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 25px;
}
@media (min-width: 768px) {
    .modal-details-grid {
        grid-template-columns: 1fr 1fr;
    }
}
.details-card {
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
    overflow: hidden;
}
.details-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--color-border-light);
}
.details-card-header h5 {
    margin: 0;
    font-size: 1.1em;
    display: flex;
    align-items: center;
    gap: 10px;
}
.details-card-header .total-amount {
    font-size: 1.1em;
    font-weight: bold;
    font-family: monospace;
}
.details-card-body {
    padding: 20px;
}
.details-card .modal-details-table {
    margin-top: 0;
    border: none;
}
.details-card .modal-details-table th, .details-card .modal-details-table td {
    padding: 10px;
    border-color: var(--color-border);
}
.details-card .modal-details-table thead {
    background-color: var(--color-surface);
}
.table-subtitle {
    font-weight: bold;
    color: var(--color-text-secondary);
    background-color: var(--color-surface);
}
.caisse-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 15px;
    margin-bottom: 25px;
}
.caisse-kpi-card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: 8px;
    padding: 15px;
    text-align: center;
}
.caisse-kpi-card span {
    display: block;
    font-size: 0.9em;
    color: var(--color-text-secondary);
    margin-bottom: 5px;
}
.caisse-kpi-card strong {
    display: block;
    font-size: 1.6em;
    font-weight: 600;
}
.caisse-kpi-card.ecart-ok strong { color: var(--color-success); }
.caisse-kpi-card.ecart-positif strong { color: var(--color-warning); }
.caisse-kpi-card.ecart-negatif strong { color: var(--color-danger); }
.text-right { text-align: right !important; }

/* Barre de comparaison */
.comparison-toolbar {
    display: none;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
    padding: 10px 20px;
    background-color: var(--color-surface-alt);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
}
.comparison-toolbar.visible {
    display: flex;
}
