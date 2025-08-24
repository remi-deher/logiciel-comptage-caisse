// Fichier JavaScript pour la page d'historique.
// Mise à jour pour fonctionner avec le nouveau schéma normalisé de la base de données et corriger le bug de la modale.

document.addEventListener('DOMContentLoaded', function() {
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // --- Fonctions utilitaires ---
    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateFr = (dateString) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
    };
    
    // --- Configuration globale ---
    const configElement = document.getElementById('history-data');
    const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};
    
    // --- Éléments du DOM ---
    const historyGrid = document.querySelector('.history-grid');
    const paginationNav = document.querySelector('.pagination-nav');
    const form = document.getElementById('history-filter-form');
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    const resetBtn = document.querySelector('.filter-section .action-btn');
    const globalChartContainer = document.getElementById('global-chart-container');
    
    // --- Variables d'état ---
    let globalChart = null;

    // --- LOGIQUE DE LA MODALE (CORRIGÉE ET AMÉLIORÉE) ---
    const modal = document.getElementById('details-modal');
    const modalContent = document.getElementById('modal-details-content');
    const closeModalBtn = modal ? modal.querySelector('.modal-close') : null;

    // Fonction pour fermer la modale
    const closeModal = () => {
        if (modal) {
            modal.classList.remove('visible');
        }
    };

    // Fonctions d'export et d'impression
    const exportModalToPdf = (comptageData, caisseId = null) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const caisseNom = caisseId ? globalConfig.nomsCaisses[caisseId] : 'Ensemble';
        const fileName = `Export-${comptageData.nom_comptage.replace(/\s/g, '_')}-${caisseNom}.pdf`;

        doc.setFontSize(18);
        doc.text(`Détails du comptage : ${comptageData.nom_comptage}`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Date: ${formatDateFr(comptageData.date_comptage)}`, 14, 30);

        const tableHeaders = ["Dénomination", "Quantité", "Total"];
        
        const processCaisse = (caisseDetails) => {
            const rows = [];
            let totalCaisse = 0;
            if (globalConfig.denominations && caisseDetails && caisseDetails.denominations) {
                for (const type in globalConfig.denominations) {
                    for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                        const quantite = parseInt(caisseDetails.denominations[name] || 0);
                        if (quantite > 0) {
                            const totalLigne = quantite * value;
                            totalCaisse += totalLigne;
                            const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                            rows.push([`${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}`, quantite, formatEuros(totalLigne)]);
                        }
                    }
                }
            }
            rows.push([{content: 'Total Compté', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' }}, {content: formatEuros(totalCaisse), styles: { fontStyle: 'bold' }}]);
            return rows;
        };

        let startY = 40;
        if (caisseId) {
            doc.setFontSize(14);
            doc.text(`Caisse : ${caisseNom}`, 14, startY);
            doc.autoTable({
                startY: startY + 5,
                head: [tableHeaders],
                body: processCaisse(comptageData.caisses_data[caisseId]),
            });
        } else {
             for (const id in comptageData.caisses_data) {
                const nom = globalConfig.nomsCaisses[id];
                doc.setFontSize(14);
                doc.text(`Caisse : ${nom}`, 14, startY);
                doc.autoTable({
                    startY: startY + 5,
                    head: [tableHeaders],
                    body: processCaisse(comptageData.caisses_data[id]),
                });
                startY = doc.autoTable.previous.finalY + 15;
             }
        }
       
        doc.save(fileName);
    };

    const exportModalToCsv = (comptageData, caisseId = null) => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Comptage;${comptageData.nom_comptage}\r\n`;
        csvContent += `Date;${formatDateFr(comptageData.date_comptage)}\r\n\r\n`;

        const processCaisse = (caisseDetails, caisseNom) => {
            let content = `Caisse;${caisseNom}\r\n`;
            content += "Dénomination;Quantité;Total\r\n";
             let totalCaisse = 0;
            if (globalConfig.denominations && caisseDetails && caisseDetails.denominations) {
                for (const type in globalConfig.denominations) {
                    for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                        const quantite = parseInt(caisseDetails.denominations[name] || 0);
                        if (quantite > 0) {
                            const totalLigne = quantite * value;
                            totalCaisse += totalLigne;
                            const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                            content += `"${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}";${quantite};"${formatEuros(totalLigne)}"\r\n`;
                        }
                    }
                }
            }
            content += `\r\nTotal;;"${formatEuros(totalCaisse)}"\r\n\r\n`;
            return content;
        };
        
        if (caisseId) {
            csvContent += processCaisse(comptageData.caisses_data[caisseId], globalConfig.nomsCaisses[caisseId]);
        } else {
            for (const id in comptageData.caisses_data) {
                 csvContent += processCaisse(comptageData.caisses_data[id], globalConfig.nomsCaisses[id]);
            }
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Export-${comptageData.nom_comptage.replace(/\s/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const printModal = () => {
        const contentToPrint = modalContent.innerHTML;
        
        const printWindow = window.open('', '', 'height=800,width=1000');
        printWindow.document.write('<html><head><title>Détails du comptage</title>');
        printWindow.document.write('<link rel="stylesheet" href="css/print-styles.css" type="text/css" />');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<div class="print-container">');
        printWindow.document.write(contentToPrint);
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 500);
    };


    // Écouteur pour ouvrir la modale, attaché à la grille des cartes
    if (historyGrid) {
        historyGrid.addEventListener('click', function(event) {
            const detailsButton = event.target.closest('.details-btn, .details-all-btn');
            if (!detailsButton) return;

            const card = detailsButton.closest('.history-card');
            if (!card || !card.dataset.comptage) return;

            const comptageData = JSON.parse(card.dataset.comptage);
            let html = '';
            let caisseIdForExport = null;

            // Si le bouton pour une seule caisse est cliqué
            if (detailsButton.classList.contains('details-btn')) {
                const caisseId = detailsButton.dataset.caisseId;
                caisseIdForExport = caisseId;
                const caisseNom = detailsButton.dataset.caisseNom;
                const caisseDetails = comptageData.caisses_data[caisseId];
                
                html = `<div class="modal-header"><h3>Détails pour : ${caisseNom}</h3><div class="modal-actions"><button class="action-btn modal-print-btn"><i class="fa-solid fa-print"></i> Imprimer</button><button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button></div></div>`;
                html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';

                let totalCaisse = 0;
                if (globalConfig.denominations && caisseDetails && caisseDetails.denominations) {
                    for (const type in globalConfig.denominations) {
                        for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                            const quantite = caisseDetails.denominations[name] || 0;
                            const totalLigne = quantite * value;
                            totalCaisse += totalLigne;
                            const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                            html += `<tr><td data-label="Dénomination">${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td data-label="Quantité">${quantite}</td><td data-label="Total">${formatEuros(totalLigne)}</td></tr>`;
                        }
                    }
                }
                html += '</tbody></table>';
                html += `<h4 style="text-align: right; margin-top: 15px;">Total Compté : ${formatEuros(totalCaisse)}</h4>`;
            }
            
            // Si le bouton "Ensemble" est cliqué
            if (detailsButton.classList.contains('details-all-btn')) {
                 html = `<div class="modal-header"><h3>Détails Complets du Comptage</h3><div class="modal-actions"><button class="action-btn modal-print-btn"><i class="fa-solid fa-print"></i> Imprimer</button><button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button></div></div>`;
                html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                
                const summaryQuantities = {};
                let summaryTotal = 0;

                if (globalConfig.nomsCaisses) {
                    for (const caisseId in comptageData.caisses_data) {
                        const caisseNom = globalConfig.nomsCaisses[caisseId];
                        const caisseDetails = comptageData.caisses_data[caisseId];
                        html += `<h4 class="modal-table-title">${caisseNom}</h4>`;
                        html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';

                        let totalCaisse = 0;
                        if (globalConfig.denominations && caisseDetails.denominations) {
                             for (const type in globalConfig.denominations) {
                                for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                                    const quantite = caisseDetails.denominations[name] || 0;
                                    summaryQuantities[name] = (summaryQuantities[name] || 0) + parseInt(quantite);
                                    const totalLigne = quantite * value;
                                    totalCaisse += totalLigne;
                                    const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                                    html += `<tr><td data-label="Dénomination">${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td data-label="Quantité">${quantite}</td><td data-label="Total">${formatEuros(totalLigne)}</td></tr>`;
                                }
                            }
                        }
                        html += '</tbody></table>';
                        html += `<h5 class="modal-table-total">Total (${caisseNom}) : ${formatEuros(totalCaisse)}</h5>`;
                    }

                    html += `<h4 class="modal-table-title">Synthèse Globale</h4>`;
                    html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité Totale</th><th>Total</th></tr></thead><tbody>';

                    if (globalConfig.denominations) {
                        for (const type in globalConfig.denominations) {
                            for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                                const quantite = summaryQuantities[name] || 0;
                                const totalLigne = quantite * value;
                                summaryTotal += totalLigne;
                                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                                html += `<tr><td data-label="Dénomination">${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td data-label="Quantité">${quantite}</td><td data-label="Total">${formatEuros(totalLigne)}</td></tr>`;
                            }
                        }
                    }
                    html += '</tbody></table>';
                    html += `<h5 class="modal-table-total">Total Général Compté : ${formatEuros(summaryTotal)}</h5>`;
                }
            }

            if (html && modalContent) {
                modalContent.innerHTML = html;
                modal.classList.add('visible');
                
                // Attache les écouteurs aux nouveaux boutons
                modalContent.querySelector('.modal-export-pdf').addEventListener('click', () => exportModalToPdf(comptageData, caisseIdForExport));
                modalContent.querySelector('.modal-export-excel').addEventListener('click', () => exportModalToCsv(comptageData, caisseIdForExport));
                modalContent.querySelector('.modal-print-btn').addEventListener('click', printModal);
            }
        });
    }
    
    // Écouteurs pour fermer la modale
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }
    // FIN DE LA LOGIQUE DE LA MODALE

    
    // Fonction de calcul mise à jour pour le nouveau schéma
    function calculateResults(comptageData) {
        const results = { caisses: {}, combines: { total_compté: 0, recette_reelle: 0, ecart: 0, recette_theorique: 0 }};
        const noms_caisses = globalConfig.nomsCaisses;
        const denominations = globalConfig.denominations;
        
        for (const caisseId in comptageData.caisses_data) {
            const caisseData = comptageData.caisses_data[caisseId];
            let total_compte = 0;
            
            if (denominations && caisseData.denominations) {
                for (const type in denominations) {
                    for (const name in denominations[type]) {
                        total_compte += (parseFloat(caisseData.denominations[name]) || 0) * denominations[type][name];
                    }
                }
            }
            
            const fond_de_caisse = parseFloat(caisseData.fond_de_caisse) || 0;
            const ventes = parseFloat(caisseData.ventes) || 0;
            const retrocession = parseFloat(caisseData.retrocession) || 0;
            const recette_theorique = ventes + retrocession;
            const recette_reelle = total_compte - fond_de_caisse;
            const ecart = recette_reelle - recette_theorique;

            results.caisses[caisseId] = { total_compte, fond_de_caisse, ventes, retrocession, recette_theorique, recette_reelle, ecart };
            results.combines.total_compté += total_compte;
            results.combines.recette_reelle += recette_reelle;
            results.combines.recette_theorique += recette_theorique;
            results.combines.ecart += ecart;
        }

        return results;
    }
    
    function renderGlobalChart(historique) {
        if (!globalChartContainer) return;
        
        if (globalChart) {
            globalChart.destroy();
            globalChart = null;
        }

        if (!historique || historique.length === 0) {
             globalChartContainer.innerHTML = '<p class="no-chart-data">Aucune donnée disponible pour le graphique.</p>';
             return;
        }
        
        const sortedHistorique = historique.sort((a, b) => new Date(a.date_comptage) - new Date(b.date_comptage));
        const dates = sortedHistorique.map(c => new Date(c.date_comptage).toLocaleDateString('fr-FR'));
        
        // Calcule les totaux globaux et les écarts
        const ventesTotales = sortedHistorique.map(c => calculateResults(c).combines.recette_reelle);
        const ecartsGlobaux = sortedHistorique.map(c => calculateResults(c).combines.ecart);

        const options = {
            chart: {
                type: 'line',
                height: 350
            },
            series: [
                {
                    name: 'Ventes totales',
                    data: ventesTotales
                },
                {
                    name: 'Écart global',
                    data: ecartsGlobaux
                }
            ],
            xaxis: {
                categories: dates
            },
            yaxis: {
                labels: {
                    formatter: function (value) {
                        return formatEuros(value);
                    }
                }
            },
            colors: ['#3498db', '#e74c3c'],
            tooltip: {
                y: {
                    formatter: function (value) {
                        return formatEuros(value);
                    }
                }
            }
        };
        // NOUVEAU : On initialise le graphique avec un petit délai
        setTimeout(() => {
            globalChart = new ApexCharts(globalChartContainer, options);
            globalChart.render();
        }, 100);
    }

    function renderMiniChart(element, data) {
        if (!data || data.every(val => val === 0)) {
            element.innerHTML = '<p class="no-chart-data">Pas de données de vente.</p>';
            return;
        }

        element.innerHTML = '';
        
        const labels = Object.values(globalConfig.nomsCaisses);
        const options = {
            chart: {
                type: 'bar',
                height: 150,
                toolbar: { show: false }
            },
            series: [{
                data: data
            }],
            labels: labels,
            colors: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'],
            legend: { show: false },
            dataLabels: {
                enabled: false,
            },
            tooltip: {
                y: {
                    formatter: function (value) {
                        return formatEuros(value);
                    }
                }
            },
            xaxis: {
                categories: labels,
                labels: {
                    style: {
                        colors: getComputedStyle(document.body).getPropertyValue('--color-text-secondary')
                    }
                }
            }
        };
        // NOUVEAU : On initialise le graphique avec un petit délai
        setTimeout(() => {
            const chart = new ApexCharts(element, options);
            chart.render();
            element.chart = chart;
        }, 100);
    }


    function renderHistoriqueCards(historique) {
        historyGrid.innerHTML = '';
        if (historique.length === 0) {
            historyGrid.innerHTML = '<p>Aucun enregistrement trouvé pour ces critères.</p>';
            return;
        }
        historique.forEach(comptage => {
            const calculated = calculateResults(comptage);
            const caisseVentesData = Object.values(calculated.caisses).map(caisse => caisse.ventes);

            const cardDiv = document.createElement('div');
            cardDiv.classList.add('history-card');
            cardDiv.dataset.comptage = JSON.stringify(comptage);

            cardDiv.innerHTML = `
                <div class="history-card-header">
                    <h4>${comptage.nom_comptage}</h4>
                    <div class="date"><i class="fa-regular fa-calendar"></i> ${formatDateFr(comptage.date_comptage)}</div>
                    ${comptage.explication ? `<p class="explication"><i class="fa-solid fa-lightbulb"></i> ${comptage.explication}</p>` : ''}
                </div>
                <div class="history-card-body">
                    <div class="summary-line">
                        <div><i class="fa-solid fa-coins icon-total"></i> Total Compté Global</div>
                        <span>${formatEuros(calculated.combines.total_compté)}</span>
                    </div>
                    <div class="summary-line">
                         <div><i class="fa-solid fa-right-left icon-ecart"></i> Écart Global</div>
                        <span class="${calculated.combines.ecart > 0.001 ? 'ecart-positif' : (calculated.combines.ecart < -0.001 ? 'ecart-negatif' : '')}">
                            ${formatEuros(calculated.combines.ecart)}
                        </span>
                    </div>
                    <hr class="card-divider">
                    <div class="mini-chart-container"></div>
                </div>
                <div class="history-card-footer no-export">
                    <button class="action-btn-small details-all-btn"><i class="fa-solid fa-layer-group"></i> Ensemble</button>
                    ${Object.entries(globalConfig.nomsCaisses).map(([caisseId, nom]) => `
                        <button class="action-btn-small details-btn" data-caisse-id="${caisseId}" data-caisse-nom="${nom}">
                            <i class="fa-solid fa-list-ul"></i> ${nom}
                        </button>
                    `).join('')}
                    <div style="flex-grow: 1;"></div>
                    <a href="index.php?page=calculateur&load=${comptage.id}" class="action-btn-small save-btn"><i class="fa-solid fa-pen-to-square"></i></a>
                    <button type="button" class="action-btn-small delete-btn delete-comptage-btn" data-id-to-delete="${comptage.id}"><i class="fa-solid fa-trash-can"></i></button>
                </div>`;
            
            historyGrid.appendChild(cardDiv);
            
            const miniChartElement = cardDiv.querySelector('.mini-chart-container');
            renderMiniChart(miniChartElement, caisseVentesData);
        });
    }

    function renderPagination(currentPage, totalPages) {
        if (!paginationNav) return;
        paginationNav.innerHTML = '';
        if (totalPages <= 1) return;

        const urlParams = new URLSearchParams(window.location.search);
        const params = urlParams.toString().replace(/&?p=\d+/, '');
        const maxVisible = 5;
        const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);

        let paginationHtml = '<ul class="pagination">';

        if (currentPage > 1) {
            paginationHtml += `<li><a href="#" data-page="${currentPage - 1}">« Préc.</a></li>`;
        } else {
            paginationHtml += `<li class="disabled"><span>« Préc.</span></li>`;
        }

        for (let i = start; i <= end; i++) {
            if (i === currentPage) {
                paginationHtml += `<li class="active"><span>${i}</span></li>`;
            } else {
                paginationHtml += `<li><a href="#" data-page="${i}">${i}</a></li>`;
            }
        }

        if (currentPage < totalPages) {
            paginationHtml += `<li><a href="#" data-page="${currentPage + 1}">Suiv. »</a></li>`;
        } else {
            paginationHtml += `<li class="disabled"><span>Suiv. »</span></li>`;
        }
        
        paginationHtml += '</ul>';
        paginationNav.innerHTML = paginationHtml;
    }

    function loadHistoriqueData(params) {
        const query = new URLSearchParams(params).toString();
        // Ajout d'un paramètre anti-cache pour forcer le rechargement
        const cacheBuster = `&_=${new Date().getTime()}`;
        
        fetch(`index.php?action=get_historique_data&${query}${cacheBuster}`)
            .then(response => response.json())
            .then(data => {
                // Débogage : Affiche les données brutes reçues du serveur
                console.log("Données de l'historique reçues:", data);
                renderHistoriqueCards(data.historique);
                renderPagination(data.page_courante, data.pages_totales);
                renderGlobalChart(data.historique_complet);
                
                // Met à jour les boutons de filtre rapide
                updateQuickFilterButtons(params);
            })
            .catch(error => {
                console.error("Erreur de chargement de l'historique:", error);
                historyGrid.innerHTML = '<p>Erreur lors du chargement des données. Veuillez réessayer.</p>';
            });
    }

    // NOUVELLE FONCTION : Met à jour la classe "active" sur les boutons de filtre rapide
    function updateQuickFilterButtons(params) {
        // Retire la classe 'active' de tous les boutons
        quickFilterBtns.forEach(btn => btn.classList.remove('active'));

        if (params.date_debut && params.date_fin) {
            // Vérifie si les dates correspondent à un filtre rapide
            const today = new Date();
            const formatDate = (date) => date.toISOString().split('T')[0];
            
            const start = params.date_debut;
            const end = params.date_fin;

            quickFilterBtns.forEach(btn => {
                const days = parseInt(btn.dataset.days);
                const startDate = new Date();
                startDate.setDate(today.getDate() - days);
                
                const filterStart = formatDate(startDate);
                const filterEnd = formatDate(today);

                if (start === filterStart && end === filterEnd) {
                    btn.classList.add('active');
                }
            });
        }
    }


    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const params = {};
        for (const [key, value] of formData.entries()) {
            params[key] = value;
        }
        params.page = 'historique';
        history.pushState(null, '', `?${new URLSearchParams(params).toString()}`);
        loadHistoriqueData(params);
    });
    
    if (paginationNav) {
        paginationNav.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
                const page = link.dataset.page;
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('p', page);
                history.pushState(null, '', `?${urlParams.toString()}`);
                loadHistoriqueData(Object.fromEntries(urlParams.entries()));
            }
        });
    }

    historyGrid.addEventListener('click', function(e) {
        const deleteButton = e.target.closest('.delete-comptage-btn');
        if (deleteButton) {
            e.preventDefault();
            if (confirm('Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT ce comptage ?')) {
                const idToDelete = deleteButton.dataset.idToDelete;
                
                const formData = new FormData();
                formData.append('id_a_supprimer', idToDelete);
                
                fetch('index.php?action=delete_historique_data', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const cardToRemove = deleteButton.closest('.history-card');
                        cardToRemove.remove();
                        loadHistoriqueData(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
                    } else {
                        alert(data.message || 'Erreur lors de la suppression.');
                    }
                })
                .catch(error => {
                    console.error("Erreur de suppression:", error);
                    alert("Erreur lors de la suppression. Veuillez réessayer.");
                });
            }
        }
    });

    if (quickFilterBtns) {
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // NOUVELLE LOGIQUE : Réinitialise les autres filtres
                document.getElementById('date_debut').value = '';
                document.getElementById('date_fin').value = '';

                const days = parseInt(this.dataset.days);
                const today = new Date();
                const startDate = new Date();
                if (days > 0) { startDate.setDate(today.getDate() - days); }
                const formatDate = (date) => date.toISOString().split('T')[0];
                
                const params = {
                    page: 'historique',
                    date_debut: formatDate(startDate),
                    date_fin: formatDate(today)
                };
                
                document.getElementById('date_debut').value = params.date_debut;
                document.getElementById('date_fin').value = params.date_fin;

                history.pushState(null, '', `?${new URLSearchParams(params).toString()}`);
                loadHistoriqueData(params);
            });
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('date_debut').value = '';
            document.getElementById('date_fin').value = '';
            document.getElementById('recherche').value = '';
            history.pushState(null, '', `?page=historique`);
            loadHistoriqueData({ page: 'historique' });
        });
    }
    
    const exportCsvBtn = document.getElementById('excel-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.delete('page');
            const exportUrl = `index.php?action=export_csv&${urlParams.toString()}`;
            window.location.href = exportUrl;
        });
    }

    const initialParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    loadHistoriqueData(initialParams);
    
    // NOUVEL ÉCOUTEUR D'ÉVÉNEMENT : Redimensionne les graphiques au redimensionnement de la fenêtre
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (globalChart && globalChart.resize) {
                globalChart.resize();
            }
            document.querySelectorAll('.mini-chart-container').forEach(element => {
                // Correction : Vérifier que l'élément a bien une instance de graphique
                if (element.chart && element.chart.resize) {
                    element.chart.resize();
                }
            });
        }, 200); // Délai de 200ms pour éviter de surcharger
    });

});
