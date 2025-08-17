// Fichier JavaScript pour la page d'historique.

document.addEventListener('DOMContentLoaded', function() {
    const historyPage = document.getElementById('history-page');
    if (!historyPage) return;

    // Fonction d'aide pour formater les montants en euros
    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateFr = (dateString) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
    };
    
    const configElement = document.getElementById('history-data');
    const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};
    
    const historyGrid = document.querySelector('.history-grid');
    const paginationNav = document.querySelector('.pagination-nav');
    const form = document.getElementById('history-filter-form');
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    const resetBtn = document.querySelector('.filter-section .action-btn');

    const globalChartContainer = document.getElementById('global-chart-container');
    let globalChart = null;

    const modal = document.getElementById('details-modal');
    if (modal) {
        const modalContent = document.getElementById('modal-details-content');
        const closeModalBtn = modal.querySelector('.modal-close');

        // Gère l'affichage de la fenêtre modale pour les détails
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
                if (globalConfig.denominations) {
                    for (const [name, value] of Object.entries(globalConfig.denominations.billets)) {
                        const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                        const totalLigne = quantite * value;
                        totalCaisse += totalLigne;
                        html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                    }
                    for (const [name, value] of Object.entries(globalConfig.denominations.pieces)) {
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
                modal.style.display = 'flex';
            }

            if (allDetailsButton) {
                const card = allDetailsButton.closest('.history-card');
                if (!card || !card.dataset.comptage) return;

                const comptageData = JSON.parse(card.dataset.comptage);
                
                let html = `<div class="modal-header"><h3>Détails Complets du Comptage</h3><div class="modal-actions"><button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button></div></div>`;
                html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                
                const summaryQuantities = {};
                let summaryTotal = 0;

                if (globalConfig.nomsCaisses) {
                    for (const caisseId in globalConfig.nomsCaisses) {
                        const caisseNom = globalConfig.nomsCaisses[caisseId];
                        html += `<h4 class="modal-table-title">${caisseNom}</h4>`;
                        html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';

                        let totalCaisse = 0;
                        if (globalConfig.denominations) {
                            for (const [name, value] of Object.entries(globalConfig.denominations.billets)) {
                                const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                                summaryQuantities[name] = (summaryQuantities[name] || 0) + quantite;
                                const totalLigne = quantite * value;
                                totalCaisse += totalLigne;
                                html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                            for (const [name, value] of Object.entries(globalConfig.denominations.pieces)) {
                                const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                                summaryQuantities[name] = (summaryQuantities[name] || 0) + quantite;
                                const totalLigne = quantite * value;
                                totalCaisse += totalLigne;
                                const label = value >= 1 ? `${value} €` : `${value * 100} cts`;
                                html += `<tr><td>Pièce de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                        }
                        html += '</tbody></table>';
                        html += `<h5 class="modal-table-total">Total (${caisseNom}) : ${formatEuros(totalCaisse)}</h5>`;
                    }

                    html += `<h4 class="modal-table-title">Synthèse Globale</h4>`;
                    html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité Totale</th><th>Total</th></tr></thead><tbody>';

                    if (globalConfig.denominations) {
                        for (const [name, value] of Object.entries(globalConfig.denominations.billets)) {
                            const quantite = summaryQuantities[name] || 0;
                            const totalLigne = quantite * value;
                            summaryTotal += totalLigne;
                            html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                        }
                        for (const [name, value] of Object.entries(globalConfig.denominations.pieces)) {
                            const quantite = summaryQuantities[name] || 0;
                            const totalLigne = quantite * value;
                            summaryTotal += totalLigne;
                            const label = value >= 1 ? `${value} €` : `${value * 100} cts`;
                            html += `<tr><td>Pièce de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                        }
                    }
                    html += '</tbody></table>';
                    html += `<h5 class="modal-table-total">Total Général Compté : ${formatEuros(summaryTotal)}</h5>`;
                }

                modalContent.innerHTML = html;
                modal.style.display = 'flex';
            }
        });

        // Gère les exports PDF et Excel dans la fenêtre modale
        modalContent.addEventListener('click', function(event) {
            const mainTitle = modalContent.querySelector('h3').textContent;
            const tables = modalContent.querySelectorAll('.modal-details-table');
            
            if (event.target.closest('.modal-export-pdf')) {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                doc.text(mainTitle, 14, 16);
                let startY = 25;

                tables.forEach((table) => {
                    const subTitleEl = table.previousElementSibling;
                    if (subTitleEl && (subTitleEl.tagName === 'H4' || subTitleEl.tagName === 'H5')) {
                        doc.text(subTitleEl.textContent, 14, startY);
                        startY += 8;
                    }
                    doc.autoTable({ html: table, startY: startY });
                    startY = doc.autoTable.previous.finalY + 10;
                    const totalEl = table.nextElementSibling;
                     if (totalEl && totalEl.tagName === 'H5') {
                        doc.text(totalEl.textContent, 14, startY);
                        startY += 15;
                    }
                });
                doc.save(`details-${mainTitle.replace(/ /g, '_')}.pdf`);
            }

            if (event.target.closest('.modal-export-excel')) {
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += mainTitle + '\r\n\r\n';

                tables.forEach(table => {
                    const subTitleEl = table.previousElementSibling;
                    if (subTitleEl && (subTitleEl.tagName === 'H4' || subTitleEl.tagName === 'H5')) {
                        csvContent += subTitleEl.textContent + '\r\n';
                    }
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cols = row.querySelectorAll('th, td');
                        const rowData = Array.from(cols).map(col => `"${col.innerText}"`).join(';');
                        csvContent += rowData + '\r\n';
                    });
                    const totalEl = table.nextElementSibling;
                    if (totalEl && totalEl.tagName === 'H5') {
                        csvContent += `"${totalEl.textContent}"\r\n`;
                    }
                    csvContent += '\r\n';
                });
                
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `details-${mainTitle.replace(/ /g, '_')}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });

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
    
    const chartColors = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];
    
    // CORRIGÉ: Fonction de rendu des mini-graphiques avec ApexCharts
    function renderMiniChart(element, data) {
        if (!data || data.every(val => val === 0)) {
            element.innerHTML = '<p class="no-chart-data">Pas de données de vente.</p>';
            return;
        }

        element.innerHTML = '';
        
        const labels = Object.values(globalConfig.nomsCaisses);
        const options = {
            chart: {
                type: 'donut',
                height: 150,
                toolbar: { show: false }
            },
            series: data,
            labels: labels,
            colors: chartColors,
            legend: { show: false },
            dataLabels: {
                enabled: false,
            },
            tooltip: {
                y: {
                    formatter: function (value, { seriesIndex, dataPointIndex, w }) {
                        return formatEuros(value);
                    }
                }
            }
        };

        const chart = new ApexCharts(element, options);
        chart.render();
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

        globalChart = new ApexCharts(globalChartContainer, options);
        globalChart.render();
    }

    // CORRIGÉ: Fonction de rendu des cartes pour éviter le problème d'innerHTML
    function renderHistoriqueCards(historique) {
        historyGrid.innerHTML = '';
        if (historique.length === 0) {
            historyGrid.innerHTML = '<p>Aucun enregistrement trouvé pour ces critères.</p>';
            return;
        }
        historique.forEach(comptage => {
            const calculated = calculateResults(comptage);
            const caisseVentesData = Object.entries(globalConfig.nomsCaisses).map(([num, nom]) => {
                return calculated.caisses[num]?.ventes || 0;
            });

            // Crée un conteneur pour la carte
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('history-card');
            cardDiv.dataset.comptage = JSON.stringify(comptage);

            // Génère le HTML pour le contenu de la carte
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
                    ${Object.entries(globalConfig.nomsCaisses).map(([num, nom]) => `
                        <button class="action-btn-small details-btn" data-caisse-id="${num}" data-caisse-nom="${nom}">
                            <i class="fa-solid fa-list-ul"></i> ${nom}
                        </button>
                    `).join('')}
                    <div style="flex-grow: 1;"></div>
                    <a href="index.php?page=calculateur&load=${comptage.id}" class="action-btn-small save-btn"><i class="fa-solid fa-pen-to-square"></i></a>
                    <button type="button" class="action-btn-small delete-btn delete-comptage-btn" data-id-to-delete="${comptage.id}"><i class="fa-solid fa-trash-can"></i></button>
                </div>`;
            
            // Ajoute la nouvelle carte à la grille
            historyGrid.appendChild(cardDiv);
            
            // Trouve le conteneur du graphique dans la carte nouvellement ajoutée et rend le graphique
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

    function calculateResults(data_row) {
        const results = { caisses: {}, combines: { total_compté: 0, recette_reelle: 0, ecart: 0, recette_theorique: 0 }};
        const noms_caisses = globalConfig.nomsCaisses;
        const denominations = globalConfig.denominations;
        
        for (const i in noms_caisses) {
            let total_compte = 0;
            if (denominations) {
                for (const list in denominations) {
                    for (const name in denominations[list]) {
                        total_compte += (parseFloat(data_row[`c${i}_${name}`]) || 0) * denominations[list][name];
                    }
                }
            }
            
            const fond_de_caisse = parseFloat(data_row[`c${i}_fond_de_caisse`]) || 0;
            const ventes = parseFloat(data_row[`c${i}_ventes`]) || 0;
            const retrocession = parseFloat(data_row[`c${i}_retrocession`]) || 0;
            const recette_theorique = ventes + retrocession;
            const recette_reelle = total_compte - fond_de_caisse;
            const ecart = recette_reelle - recette_theorique;

            results.caisses[i] = { total_compte, fond_de_caisse, ventes, retrocession, recette_theorique, recette_reelle, ecart };
            results.combines.total_compté += total_compte;
            results.combines.recette_reelle += recette_reelle;
            results.combines.recette_theorique += recette_theorique;
            results.combines.ecart += ecart;
        }

        return results;
    }

    function loadHistoriqueData(params) {
        const query = new URLSearchParams(params).toString();
        fetch(`index.php?action=get_historique_data&${query}`)
            .then(response => response.json())
            .then(data => {
                renderHistoriqueCards(data.historique);
                renderPagination(data.page_courante, data.pages_totales);
                renderGlobalChart(data.historique_complet);
            })
            .catch(error => {
                console.error("Erreur de chargement de l'historique:", error);
                historyGrid.innerHTML = '<p>Erreur lors du chargement des données. Veuillez réessayer.</p>';
            });
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
                const days = parseInt(this.dataset.days);
                const today = new Date();
                const startDate = new Date();
                startDate.setDate(today.getDate() - days);

                const formatDate = (date) => date.toISOString().split('T')[0];

                const form = document.getElementById('history-filter-form');
                form.querySelector('#date_debut').value = formatDate(startDate);
                form.querySelector('#date_fin').value = formatDate(today);
                
                const params = {
                    page: 'historique',
                    date_debut: formatDate(startDate),
                    date_fin: formatDate(today)
                };
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

});
