// public/js/history/events.js
// Ce module centralise tous les écouteurs d'événements de la page.

import * as dom from './dom.js';
import { state } from './state.js';
import { loadHistoriqueData, deleteComptage } from './api.js';
import { handleSelectionChange } from './comparison.js';
import { showDetailsModal, closeDetailsModal, showComparisonModal, closeComparisonModal, showWithdrawalDetailsModal, closeWithdrawalDetailsModal } from './modals.js';
import { calculateResults } from './utils.js';

/**
 * Initialise tous les écouteurs d'événements pour la page d'historique.
 */
export function initializeEventListeners() {

    // Bouton Imprimer la vue
    if (dom.printBtn) {
        dom.printBtn.addEventListener('click', () => window.print());
    }

    // Bouton Exporter en CSV (vue comptages)
    if (dom.excelBtn) {
        dom.excelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.delete('page');
            window.location.href = `index.php?action=export_csv&${urlParams.toString()}`;
        });
    }

    // Bouton Exporter en PDF (vue comptages)
    if (dom.pdfBtn) {
        dom.pdfBtn.addEventListener('click', function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const tableData = [];
            const headers = ['ID', 'Nom', 'Date', 'Total Global', 'Ecart Global'];
            tableData.push(headers);
            const allComptages = JSON.parse(dom.historyGrid.dataset.allComptages || '[]');
            allComptages.forEach(comptage => {
                const calculated = calculateResults(comptage);
                tableData.push([
                    comptage.id,
                    comptage.nom_comptage,
                    new Date(comptage.date_comptage).toLocaleDateString('fr-FR'),
                    `${calculated.combines.total_compté.toFixed(2)} €`,
                    `${calculated.combines.ecart.toFixed(2)} €`
                ]);
            });
            doc.autoTable({ head: [tableData[0]], body: tableData.slice(1) });
            doc.save('historique_comptages.pdf');
        });
    }
    
    // Gestion du formulaire de filtre
    if (dom.form) {
        dom.form.addEventListener('submit', function(e) {
            e.preventDefault();
            const params = Object.fromEntries(new FormData(dom.form).entries());
            params.page = 'historique';
            history.pushState(null, '', `?${new URLSearchParams(params).toString()}`);
            loadHistoriqueData(params);
        });
    }

    // Gestion de la pagination
    if (dom.paginationNav) {
        dom.paginationNav.addEventListener('click', function(e) {
            e.preventDefault();
            const link = e.target.closest('a');
            if (link && link.dataset.page) {
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('p', link.dataset.page);
                history.pushState(null, '', `?${urlParams.toString()}`);
                loadHistoriqueData(Object.fromEntries(urlParams.entries()));
            }
        });
    }

    // Gestion des clics sur la grille principale (détails, suppression)
    if (dom.historyGrid) {
        dom.historyGrid.addEventListener('click', function(event) {
            const detailsButton = event.target.closest('.details-btn, .details-all-btn');
            const deleteButton = event.target.closest('.delete-comptage-btn');

            if (detailsButton) {
                const card = detailsButton.closest('.history-card');
                if (!card || !card.dataset.comptage) return;
                const comptageData = JSON.parse(card.dataset.comptage);
                const caisseId = detailsButton.classList.contains('details-btn') ? detailsButton.dataset.caisseId : null;
                showDetailsModal(comptageData, caisseId);
                return;
            }

            if (deleteButton) {
                const idToDelete = deleteButton.dataset.idToDelete;
                deleteComptage(idToDelete);
                return;
            }
        });
        
        dom.historyGrid.addEventListener('change', handleSelectionChange);
    }
    
    // Gestion des filtres rapides
    if (dom.quickFilterBtns) {
        dom.quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const days = parseInt(this.dataset.days);
                const today = new Date();
                const startDate = new Date();
                if (days > 0) startDate.setDate(today.getDate() - days);
                const formatDate = (date) => date.toISOString().split('T')[0];
                const params = { page: 'historique', date_debut: formatDate(startDate), date_fin: formatDate(today) };
                
                if(dom.form) {
                    dom.form.querySelector('#date_debut').value = params.date_debut;
                    dom.form.querySelector('#date_fin').value = params.date_fin;
                }
                
                history.pushState(null, '', `?${new URLSearchParams(params).toString()}`);
                loadHistoriqueData(params);
            });
        });
    }

    // Bouton de réinitialisation
    if (dom.resetBtn) {
        dom.resetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if(dom.form) dom.form.reset();
            history.pushState(null, '', `?page=historique`);
            loadHistoriqueData({ page: 'historique' });
        });
    }

    // Bouton pour lancer la comparaison
    if (dom.compareBtn) {
        dom.compareBtn.addEventListener('click', () => showComparisonModal(state.selectedForComparison));
    }

    // Fermeture des modales
    if (dom.detailsModal) {
        dom.detailsModal.addEventListener('click', (event) => {
            if (event.target === dom.detailsModal || event.target.closest('.modal-close')) {
                closeDetailsModal();
            }
        });
    }
    if (dom.comparisonModal) {
        dom.comparisonModal.addEventListener('click', (event) => {
            if (event.target === dom.comparisonModal || event.target.closest('.modal-close')) {
                closeComparisonModal();
            }
        });
    }
    
    const withdrawalModal = document.getElementById('withdrawal-details-modal');
    if (withdrawalModal) {
        withdrawalModal.addEventListener('click', (event) => {
            if (event.target === withdrawalModal || event.target.closest('.modal-close')) {
                closeWithdrawalDetailsModal();
            }
        });
    }

    // (NOUVEAU) Écouteur pour ouvrir la modale des détails de retraits
    document.body.addEventListener('click', function(event) {
        const viewDetailsBtn = event.target.closest('.view-day-details-btn');
        if (viewDetailsBtn) {
            const dayCard = viewDetailsBtn.closest('.day-card');
            const dateKey = dayCard.dataset.dateKey;
            const logContainer = document.getElementById('withdrawals-log-container');
            const groupedData = JSON.parse(logContainer.dataset.groupedWithdrawals);
            if (groupedData && groupedData[dateKey]) {
                showWithdrawalDetailsModal(groupedData[dateKey]);
            }
        }
    });

    // Redimensionnement de la fenêtre
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.globalChart && typeof state.globalChart.resize === 'function') {
                state.globalChart.resize();
            }
            document.querySelectorAll('.mini-chart-container').forEach(element => {
                if (element.chart && typeof element.chart.resize === 'function') {
                    element.chart.resize();
                }
            });
        }, 200);
    });

    // Gestion des onglets de vue
    if (dom.viewTabs) {
        dom.viewTabs.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.tab-link');
            if (!link) return;
            document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
            const viewElement = document.getElementById(`${link.dataset.view}-view`);
            if (viewElement) {
                viewElement.classList.add('active');
            }
        });
    }
}
