// Fichier JavaScript pour la page d'historique.
// Mise à jour pour le mode comparaison et la modale analytique.

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
    const globalChartContainer = document.getElementById('global-chart-container');
    
    // NOUVEAU : Éléments pour la comparaison
    const comparisonToolbar = document.getElementById('comparison-toolbar');
    const comparisonCounter = document.getElementById('comparison-counter');
    const compareBtn = document.getElementById('compare-btn');
    const comparisonModal = document.getElementById('comparison-modal');
    const comparisonModalContent = document.getElementById('modal-comparison-content');
    let selectedForComparison = [];

    // --- Variables d'état ---
    let globalChart = null;
    let modalChart = null;

    // --- LOGIQUE DE LA MODALE DE DÉTAILS ---
    const detailsModal = document.getElementById('details-modal');
    const detailsModalContent = document.getElementById('modal-details-content');

    const closeDetailsModal = () => {
        if (detailsModal) {
            detailsModal.classList.remove('visible');
            if (modalChart) {
                modalChart.destroy();
                modalChart = null;
            }
        }
    };

    const renderModalChart = (element, comptageData, caisseId = null) => {
        if (!element) return;
        
        let denominationsData = {};
        let totalCaisse = 0;

        const processCaisse = (caisseDetails) => {
            if (caisseDetails && caisseDetails.denominations) {
                for(const name in caisseDetails.denominations) {
                    const quantite = parseInt(caisseDetails.denominations[name] || 0);
                    let valeur = 0;
                    if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                    if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                    
                    const totalLigne = quantite * valeur;
                    if(totalLigne > 0) {
                        const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
                        denominationsData[label] = (denominationsData[label] || 0) + totalLigne;
                        totalCaisse += totalLigne;
                    }
                }
            }
        };

        if (caisseId) {
            processCaisse(comptageData.caisses_data[caisseId]);
        } else {
            for (const id in comptageData.caisses_data) {
                processCaisse(comptageData.caisses_data[id]);
            }
        }
        
        if (Object.keys(denominationsData).length === 0) {
            element.innerHTML = '<p class="no-chart-data">Aucune donnée de dénomination à afficher.</p>';
            return;
        }

        const options = {
            chart: { type: 'donut', height: 300 },
            series: Object.values(denominationsData),
            labels: Object.keys(denominationsData),
            legend: { position: 'bottom' },
            tooltip: { y: { formatter: (val) => formatEuros(val) } },
            plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'Total Espèces', formatter: () => formatEuros(totalCaisse) } } } } }
        };

        modalChart = new ApexCharts(element, options);
        modalChart.render();
    };

    if (historyGrid) {
        historyGrid.addEventListener('click', function(event) {
            const detailsButton = event.target.closest('.details-btn, .details-all-btn');
            if (!detailsButton) return;

            const card = detailsButton.closest('.history-card');
            if (!card || !card.dataset.comptage) return;

            const comptageData = JSON.parse(card.dataset.comptage);
            const calculatedResults = calculateResults(comptageData);
            let html = '';
            let caisseIdForExport = null;

            const generateSummaryHtml = (summaryData) => {
                const ecartClass = summaryData.ecart > 0.01 ? 'ecart-positif' : (summaryData.ecart < -0.01 ? 'ecart-negatif' : 'ecart-ok');
                return `
                    <div class="summary-grid">
                        <div class="summary-box"><span>Fond de Caisse</span><strong>${formatEuros(summaryData.fond_de_caisse)}</strong></div>
                        <div class="summary-box"><span>Ventes Théoriques</span><strong>${formatEuros(summaryData.ventes)}</strong></div>
                        <div class="summary-box"><span>Rétrocessions</span><strong>${formatEuros(summaryData.retrocession)}</strong></div>
                        <div class="summary-box"><span>Total Compté</span><strong>${formatEuros(summaryData.total_compte)}</strong></div>
                        <div class="summary-box"><span>Recette Réelle</span><strong>${formatEuros(summaryData.recette_reelle)}</strong></div>
                        <div class="summary-box ${ecartClass}"><span>Écart Final</span><strong>${formatEuros(summaryData.ecart)}</strong></div>
                    </div>
                `;
            };
            
            const generateDenominationsTableHtml = (caisseDetails) => {
                let tableHtml = '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';
                let totalCaisse = 0;
                 if (globalConfig.denominations && caisseDetails && caisseDetails.denominations) {
                    for (const type in globalConfig.denominations) {
                        for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                            const quantite = caisseDetails.denominations[name] || 0;
                            const totalLigne = quantite * value;
                            totalCaisse += totalLigne;
                            if (quantite > 0) {
                                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                                tableHtml += `<tr><td>${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                        }
                    }
                }
                tableHtml += '</tbody></table>';
                return tableHtml;
            };

            const generateCombinedDenominationsTableHtml = (comptageData) => {
                const summaryQuantities = {};
                let summaryTotal = 0;
                let tableHtml = '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité Totale</th><th>Total</th></tr></thead><tbody>';
                
                for (const caisseId in comptageData.caisses_data) {
                    const caisseDetails = comptageData.caisses_data[caisseId];
                    if (caisseDetails.denominations) {
                        for (const name in caisseDetails.denominations) {
                             summaryQuantities[name] = (summaryQuantities[name] || 0) + parseInt(caisseDetails.denominations[name] || 0);
                        }
                    }
                }

                if (globalConfig.denominations) {
                    for (const type in globalConfig.denominations) {
                        for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                            const quantite = summaryQuantities[name] || 0;
                            const totalLigne = quantite * value;
                            summaryTotal += totalLigne;
                             if (quantite > 0) {
                                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                                tableHtml += `<tr><td>${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                        }
                    }
                }
                tableHtml += '</tbody></table>';
                return tableHtml;
            };

            if (detailsButton.classList.contains('details-btn')) {
                const caisseId = detailsButton.dataset.caisseId;
                caisseIdForExport = caisseId;
                const caisseNom = detailsButton.dataset.caisseNom;
                
                html = `<div class="modal-header"><h3>Détails pour : ${caisseNom}</h3><span class="modal-close">&times;</span></div>
                        <h4>Résumé Financier</h4>
                        ${generateSummaryHtml(calculatedResults.caisses[caisseId])}
                        <div class="modal-details-grid">
                            <div>
                                <h4>Répartition des Espèces</h4>
                                <div id="modal-chart-container"></div>
                            </div>
                            <div>
                                <h4>Détail des Espèces</h4>
                                ${generateDenominationsTableHtml(comptageData.caisses_data[caisseId])}
                            </div>
                         </div>`;
            }
            
            if (detailsButton.classList.contains('details-all-btn')) {
                html = `<div class="modal-header"><h3>Détails Complets du Comptage</h3><span class="modal-close">&times;</span></div>
                        <h4>Résumé Financier Global</h4>
                        ${generateSummaryHtml(calculatedResults.combines)}
                        <div class="modal-details-grid">
                            <div>
                                <h4>Répartition Globale des Espèces</h4>
                                <div id="modal-chart-container"></div>
                            </div>
                            <div>
                                <h4>Synthèse Globale des Espèces</h4>
                                ${generateCombinedDenominationsTableHtml(comptageData)}
                            </div>
                         </div>`;
            }

            if (html && detailsModalContent) {
                detailsModalContent.innerHTML = html;
                detailsModal.classList.add('visible');
                
                const modalChartContainer = document.getElementById('modal-chart-container');
                renderModalChart(modalChartContainer, comptageData, caisseIdForExport);
            }
        });
    }
    
    if (detailsModal) {
        detailsModal.addEventListener('click', (event) => {
            if (event.target === detailsModal || event.target.closest('.modal-close')) {
                closeDetailsModal();
            }
        });
    }

    // --- NOUVEAU : LOGIQUE DE COMPARAISON ---

    const updateComparisonToolbar = () => {
        const count = selectedForComparison.length;
        comparisonCounter.textContent = `${count}/2 comptages sélectionnés`;
        if (count > 0) {
            comparisonToolbar.classList.add('visible');
        } else {
            comparisonToolbar.classList.remove('visible');
        }
        compareBtn.disabled = count !== 2;
    };

    const handleSelectionChange = (event) => {
        const checkbox = event.target;
        if (!checkbox.classList.contains('comparison-checkbox')) return;

        const card = checkbox.closest('.history-card');
        const comptageId = card.dataset.id;
        
        if (checkbox.checked) {
            if (selectedForComparison.length < 2) {
                selectedForComparison.push(comptageId);
                card.classList.add('selected');
            } else {
                checkbox.checked = false;
                alert("Vous ne pouvez comparer que 2 comptages à la fois.");
            }
        } else {
            selectedForComparison = selectedForComparison.filter(id => id !== comptageId);
            card.classList.remove('selected');
        }
        updateComparisonToolbar();
    };

    const renderComparisonModal = () => {
        if (selectedForComparison.length !== 2) return;

        const data1 = JSON.parse(document.querySelector(`.history-card[data-id="${selectedForComparison[0]}"]`).dataset.comptage);
        const data2 = JSON.parse(document.querySelector(`.history-card[data-id="${selectedForComparison[1]}"]`).dataset.comptage);

        const results1 = calculateResults(data1);
        const results2 = calculateResults(data2);

        const renderValue = (val1, val2) => {
            const diff = val2 - val1;
            let diffHtml = '';
            if (Math.abs(diff) > 0.001) {
                const diffClass = diff > 0 ? 'positive' : 'negative';
                const sign = diff > 0 ? '+' : '';
                diffHtml = `<span class="value-diff ${diffClass}">(${sign}${formatEuros(diff)})</span>`;
            }
            return `<span class="comparison-item-value">${formatEuros(val2)}</span> ${diffHtml}`;
        };

        const html = `
            <div class="modal-header">
                <h3>Comparaison de Comptages</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="comparison-grid">
                <div class="comparison-column">
                    <h4>${data1.nom_comptage}</h4>
                    <div class="comparison-item"><span class="comparison-item-label">Date</span><span class="comparison-item-value">${formatDateFr(data1.date_comptage)}</span></div>
                    <div class="comparison-item"><span class="comparison-item-label">Total Compté</span><span class="comparison-item-value">${formatEuros(results1.combines.total_compté)}</span></div>
                    <div class="comparison-item"><span class="comparison-item-label">Recette Réelle</span><span class="comparison-item-value">${formatEuros(results1.combines.recette_reelle)}</span></div>
                    <div class="comparison-item"><span class="comparison-item-label">Écart Final</span><span class="comparison-item-value">${formatEuros(results1.combines.ecart)}</span></div>
                </div>
                <div class="comparison-column">
                    <h4>${data2.nom_comptage}</h4>
                    <div class="comparison-item"><span class="comparison-item-label">Date</span><span class="comparison-item-value">${formatDateFr(data2.date_comptage)}</span></div>
                     <div class="comparison-item"><span class="comparison-item-label">Total Compté</span><span>${renderValue(results1.combines.total_compté, results2.combines.total_compté)}</span></div>
                    <div class="comparison-item"><span class="comparison-item-label">Recette Réelle</span><span>${renderValue(results1.combines.recette_reelle, results2.combines.recette_reelle)}</span></div>
                    <div class="comparison-item"><span class="comparison-item-label">Écart Final</span><span>${renderValue(results1.combines.ecart, results2.combines.ecart)}</span></div>
                </div>
            </div>
        `;
        
        comparisonModalContent.innerHTML = html;
        comparisonModal.classList.add('visible');
    };

    historyGrid.addEventListener('change', handleSelectionChange);
    compareBtn.addEventListener('click', renderComparisonModal);
    comparisonModal.addEventListener('click', (event) => {
        if (event.target === comparisonModal || event.target.closest('.modal-close')) {
            comparisonModal.classList.remove('visible');
        }
    });

    // --- Fonctions de rendu et de chargement (existantes) ---

    function calculateResults(comptageData) {
        const results = { caisses: {}, combines: { total_compté: 0, recette_reelle: 0, ecart: 0, recette_theorique: 0, fond_de_caisse: 0, ventes: 0, retrocession: 0 }};
        const denominations = globalConfig.denominations;
        
        for (const caisseId in comptageData.caisses_data) {
            if (!comptageData.caisses_data.hasOwnProperty(caisseId)) continue;
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
            results.combines.fond_de_caisse += fond_de_caisse;
            results.combines.ventes += ventes;
            results.combines.retrocession += retrocession;
        }
        return results;
    }

    function renderGlobalChart(historique) {
        if (!globalChartContainer) return;
        if (globalChart) { globalChart.destroy(); globalChart = null; }
        if (!historique || historique.length === 0) {
             globalChartContainer.innerHTML = '<p class="no-chart-data">Aucune donnée disponible pour le graphique.</p>';
             return;
        }
        const sortedHistorique = historique.sort((a, b) => new Date(a.date_comptage) - new Date(b.date_comptage));
        const dates = sortedHistorique.map(c => new Date(c.date_comptage).toLocaleDateString('fr-FR'));
        const ventesTotales = sortedHistorique.map(c => calculateResults(c).combines.recette_reelle);
        const ecartsGlobaux = sortedHistorique.map(c => calculateResults(c).combines.ecart);
        const options = {
            chart: { type: 'line', height: 350 },
            series: [{ name: 'Ventes totales', data: ventesTotales }, { name: 'Écart global', data: ecartsGlobaux }],
            xaxis: { categories: dates },
            yaxis: { labels: { formatter: (value) => formatEuros(value) } },
            colors: ['#3498db', '#e74c3c'],
            tooltip: { y: { formatter: (value) => formatEuros(value) } }
        };
        setTimeout(() => {
            globalChart = new ApexCharts(globalChartContainer, options);
            globalChart.render();
        }, 100);
    }

    function renderMiniChart(element, data) {
        const dataIsAllZeros = data.every(val => val === 0);
        if (!data || dataIsAllZeros) {
            element.innerHTML = '<p class="no-chart-data">Pas de données de vente.</p>';
            return;
        }
        element.innerHTML = '';
        const labels = Object.values(globalConfig.nomsCaisses);
        const options = {
            chart: { type: 'bar', height: 150, toolbar: { show: false } },
            series: [{ data: data }],
            labels: labels,
            colors: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'],
            legend: { show: false },
            dataLabels: { enabled: false },
            tooltip: { y: { formatter: (value) => formatEuros(value) } },
            xaxis: {
                categories: labels,
                labels: { style: { colors: getComputedStyle(document.body).getPropertyValue('--color-text-secondary') } }
            }
        };
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
            const caisseVentesData = Object.keys(globalConfig.nomsCaisses).map(caisseId => {
                const caisseData = calculated.caisses[caisseId];
                return caisseData ? parseFloat(caisseData.ventes) : 0;
            });
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('history-card');
            cardDiv.dataset.comptage = JSON.stringify(comptage);
            cardDiv.dataset.id = comptage.id;

            cardDiv.innerHTML = `
                <input type="checkbox" class="comparison-checkbox" title="Sélectionner pour comparer">
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
            renderMiniChart(cardDiv.querySelector('.mini-chart-container'), caisseVentesData);
        });
    }

    function renderPagination(currentPage, totalPages) {
        if (!paginationNav) return;
        paginationNav.innerHTML = '';
        if (totalPages <= 1) return;
        let paginationHtml = '<ul class="pagination">';
        if (currentPage > 1) paginationHtml += `<li><a href="#" data-page="${currentPage - 1}">« Préc.</a></li>`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) paginationHtml += `<li class="active"><span>${i}</span></li>`;
            else paginationHtml += `<li><a href="#" data-page="${i}">${i}</a></li>`;
        }
        if (currentPage < totalPages) paginationHtml += `<li><a href="#" data-page="${currentPage + 1}">Suiv. »</a></li>`;
        paginationHtml += '</ul>';
        paginationNav.innerHTML = paginationHtml;
    }

    function loadHistoriqueData(params) {
        selectedForComparison = [];
        document.querySelectorAll('.history-card.selected').forEach(card => card.classList.remove('selected'));
        updateComparisonToolbar();

        const query = new URLSearchParams(params).toString();
        fetch(`index.php?action=get_historique_data&${query}&_=${new Date().getTime()}`)
            .then(response => response.json())
            .then(data => {
                renderHistoriqueCards(data.historique);
                renderPagination(data.page_courante, data.pages_totales);
                renderGlobalChart(data.historique_complet);
                updateQuickFilterButtons(params);
            })
            .catch(error => console.error("Erreur de chargement de l'historique:", error));
    }

    function updateQuickFilterButtons(params) {
        quickFilterBtns.forEach(btn => btn.classList.remove('active'));
        if (params.date_debut && params.date_fin) {
            const today = new Date();
            const formatDate = (date) => date.toISOString().split('T')[0];
            const start = params.date_debut;
            const end = params.date_fin;
            quickFilterBtns.forEach(btn => {
                const days = parseInt(btn.dataset.days);
                const startDate = new Date();
                startDate.setDate(today.getDate() - days);
                if (start === formatDate(startDate) && end === formatDate(today)) {
                    btn.classList.add('active');
                }
            });
        }
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const params = Object.fromEntries(new FormData(form).entries());
        params.page = 'historique';
        history.pushState(null, '', `?${new URLSearchParams(params).toString()}`);
        loadHistoriqueData(params);
    });
    
    if (paginationNav) {
        paginationNav.addEventListener('click', function(e) {
            e.preventDefault();
            const link = e.target.closest('a');
            if (link) {
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('p', link.dataset.page);
                history.pushState(null, '', `?${urlParams.toString()}`);
                loadHistoriqueData(Object.fromEntries(urlParams.entries()));
            }
        });
    }

    historyGrid.addEventListener('click', function(e) {
        const deleteButton = e.target.closest('.delete-comptage-btn');
        if (deleteButton && confirm('Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT ce comptage ?')) {
            const idToDelete = deleteButton.dataset.idToDelete;
            fetch('index.php?action=delete_historique_data', {
                method: 'POST',
                body: new URLSearchParams({ id_a_supprimer: idToDelete })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    loadHistoriqueData(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
                } else {
                    alert(data.message || 'Erreur lors de la suppression.');
                }
            });
        }
    });

    if (quickFilterBtns) {
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const days = parseInt(this.dataset.days);
                const today = new Date();
                const startDate = new Date();
                if (days > 0) startDate.setDate(today.getDate() - days);
                const formatDate = (date) => date.toISOString().split('T')[0];
                const params = { page: 'historique', date_debut: formatDate(startDate), date_fin: formatDate(today) };
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
            form.reset();
            history.pushState(null, '', `?page=historique`);
            loadHistoriqueData({ page: 'historique' });
        });
    }
    
    document.getElementById('excel-btn')?.addEventListener('click', function(e) {
        e.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete('page');
        window.location.href = `index.php?action=export_csv&${urlParams.toString()}`;
    });

    const initialParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    loadHistoriqueData(initialParams);
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (globalChart && globalChart.resize) globalChart.resize();
            document.querySelectorAll('.mini-chart-container').forEach(element => {
                if (element.chart && element.chart.resize) element.chart.resize();
            });
        }, 200);
    });
});
