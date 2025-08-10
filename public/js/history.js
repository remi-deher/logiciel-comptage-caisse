/**
 * Module JavaScript pour la page Historique.
 */
document.addEventListener('DOMContentLoaded', function() {
    const historyPage = document.querySelector('.history-grid');
    if (!historyPage) return; // Ne s'exécute que sur la page d'historique

    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    
    const configElement = document.getElementById('history-data');
    const config = configElement ? JSON.parse(configElement.dataset.config) : {};

    const modal = document.getElementById('details-modal');
    if (modal) {
        const modalContent = document.getElementById('modal-details-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        historyPage.addEventListener('click', function(event) {
            const detailsButton = event.target.closest('.details-btn');
            const allDetailsButton = event.target.closest('.details-all-btn');

            if (detailsButton) {
                const card = detailsButton.closest('.history-card');
                if (!card || !card.dataset.comptage) return;

                const comptageData = JSON.parse(card.dataset.comptage);
                const caisseId = detailsButton.dataset.caisseId;
                const caisseNom = detailsButton.dataset.caisseNom;
                
                let html = `<div class="modal-header"><h3>Détails pour : ${caisseNom}</h3><div class="modal-actions"><button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button></div></div>`;
                html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';

                let totalCaisse = 0;
                if (config.denominations) {
                    for (const [name, value] of Object.entries(config.denominations.billets)) {
                        const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                        const totalLigne = quantite * value;
                        totalCaisse += totalLigne;
                        html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                    }
                    for (const [name, value] of Object.entries(config.denominations.pieces)) {
                        const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                        const totalLigne = quantite * value;
                        totalCaisse += totalLigne;
                        const label = value >= 1 ? `${value} €` : `${value * 100} cts`;
                        html += `<tr><td>Pièce de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                    }
                }
                html += '</tbody></table>';
                html += `<h4 style="text-align: right; margin-top: 15px;">Total Compté : ${formatEuros(totalCaisse)}</h4>`;

                modalContent.innerHTML = html;
                modal.style.display = 'block';
            }

            if (allDetailsButton) {
                // ... (La logique pour le bouton "Ensemble" peut être ajoutée ici de la même manière)
            }
        });

        // ... (La logique pour les exports et la fermeture de la modale peut être ajoutée ici)

        if(closeModalBtn) {
            closeModalBtn.onclick = function() { modal.style.display = 'none'; }
        }
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
    }

    const printBtn = document.getElementById('print-btn');
    if(printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }
});
