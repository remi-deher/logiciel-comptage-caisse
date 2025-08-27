// Fichier JavaScript pour la page d'historique.
// Mise à jour pour le mode comparaison multiple, la modale analytique et l'affichage des retraits.

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
    const resetBtn = document.querySelector('a[href*="historique&vue=tout"]');
    const viewTabs = document.querySelector('.view-tabs');
    const comptagesView = document.getElementById('comptages-view');
    const retraitsView = document.getElementById('retraits-view');
    const withdrawalsSummaryTable = document.getElementById('withdrawals-summary-table');

    // Éléments pour la comparaison
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
    
    // --- LOGIQUE D'EXPORT ET D'IMPRESSION ---
    const printBtn = document.getElementById('print-btn');
    const excelBtn = document.getElementById('excel-btn');
    const pdfBtn = document.getElementById('pdf-btn');

    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    if (excelBtn) {
        excelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.delete('page');
            window.location.href = `index.php?action=export_csv&${urlParams.toString()}`;
        });
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', function() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const tableData = [];
            const headers = ['ID', 'Nom', 'Date', 'Total Global', 'Ecart Global'];

            tableData.push(headers);

            const allComptages = JSON.parse(historyGrid.dataset.allComptages || '[]');

            allComptages.forEach(comptage => {
                const calculated = calculateResults(comptage);
                const row = [
                    comptage.id,
                    comptage.nom_comptage,
                    formatDateFr(comptage.date_comptage),
                    formatEuros(calculated.combines.total_compté),
                    formatEuros(calculated.combines.ecart)
                ];
                tableData.push(row);
            });

            doc.autoTable({
                head: [tableData[0]],
                body: tableData.slice(1),
            });

            doc.save('historique_comptages.pdf');
        });
    }
    
    async function generateComptagePdf(comptageData) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const calculated = calculateResults(comptageData);
        let y = 15;

        // Titre principal
        doc.setFontSize(18);
        doc.text(comptageData.nom_comptage, 14, y);
        y += 8;
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(formatDateFr(comptageData.date_comptage), 14, y);
        y += 15;

        // Fonction pour dessiner une caisse
        const drawCaisseSection = (caisseId, isGlobal = false) => {
            const caisseNom = isGlobal ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];
            const caisseCalculated = isGlobal ? calculated.combines : calculated.caisses[caisseId];
            const caisseDetails = isGlobal ? null : comptageData.caisses_data[caisseId];
            const retraitsDetails = isGlobal ? calculated.combines.retraits : caisseDetails?.retraits;

            doc.setFontSize(14);
            doc.setTextColor(44, 62, 80);
            doc.text(`Résumé pour : ${caisseNom}`, 14, y);
            y += 8;

            // Tableau de résumé financier
            const summaryData = [
                ['Fond de caisse', formatEuros(caisseCalculated.fond_de_caisse)],
                ['Ventes Théoriques', formatEuros(caisseCalculated.ventes)],
                ['Rétrocessions', formatEuros(caisseCalculated.retrocession)],
                ['Total Compté', formatEuros(caisseCalculated.total_compte)],
                ['Recette Réelle', formatEuros(caisseCalculated.recette_reelle)],
                ['Écart Final', formatEuros(caisseCalculated.ecart)]
            ];

            doc.autoTable({
                startY: y,
                body: summaryData,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 2 },
                columnStyles: { 0: { fontStyle: 'bold' } }
            });
            y = doc.autoTable.previous.finalY + 10;

            // Tableau des retraits si présents
            if (retraitsDetails && Object.keys(retraitsDetails).length > 0) {
                doc.setFontSize(14);
                doc.setTextColor(44, 62, 80);
                doc.text(`Retraits effectués pour : ${caisseNom}`, 14, y);
                y += 8;
                const retraitsData = [];
                Object.entries(retraitsDetails).forEach(([name, quantite]) => {
                    let valeur = 0;
                    if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                    if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                    const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
                    retraitsData.push([`${globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce'} de ${label}`, quantite, formatEuros(quantite * valeur)]);
                });
                doc.autoTable({
                    startY: y,
                    head: [['Dénomination', 'Quantité Retirée', 'Total Retiré']],
                    body: retraitsData,
                    theme: 'striped',
                    styles: { fontSize: 10, cellPadding: 2 },
                    headStyles: { fillColor: [231, 76, 60] } // Rouge pour les retraits
                });
                y = doc.autoTable.previous.finalY + 10;
            }


            // Tableau de détail des espèces
            doc.setFontSize(14);
            doc.setTextColor(44, 62, 80);
            doc.text(`Détail des espèces pour : ${caisseNom}`, 14, y);
            y += 8;
            
            const denominationsData = [];
            const denominationsSource = isGlobal ? calculated.combines.denominations : (caisseDetails ? caisseDetails.denominations : {});
            if (globalConfig.denominations && denominationsSource) {
                for (const type in globalConfig.denominations) {
                    for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                        const quantite = denominationsSource[name] || 0;
                        if (quantite > 0) {
                            const label = value >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                            denominationsData.push([
                                `${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}`,
                                quantite,
                                formatEuros(quantite * value)
                            ]);
                        }
                    }
                }
            }
            
            if(denominationsData.length > 0){
                doc.autoTable({
                    startY: y,
                    head: [['Dénomination', 'Quantité', 'Total']],
                    body: denominationsData,
                    theme: 'striped',
                    styles: { fontSize: 10, cellPadding: 2 },
                    headStyles: { fillColor: [52, 152, 219] }
                });
                y = doc.autoTable.previous.finalY + 15;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text('Aucune dénomination en espèces pour cette caisse.', 14, y);
                y += 15;
            }
        };
        
        if (comptageData.isGlobal) {
            drawCaisseSection(null, true);
        } else {
            for (const caisseId in comptageData.caisses_data) {
                drawCaisseSection(caisseId, false);
            }
        }

        doc.save(`comptage_${comptageData.nom_comptage.replace(/ /g, '_')}.pdf`);
    }
    
    function generateComptageCsv(comptageData) {
        const calculated = calculateResults(comptageData);
        let csvContent = "data:text/csv;charset=utf-8,";
        
        csvContent += `Comptage;${comptageData.nom_comptage}\r\n`;
        csvContent += `Date;${formatDateFr(comptageData.date_comptage)}\r\n\r\n`;

        const processCaisse = (caisseId, isGlobal = false) => {
            const caisseNom = isGlobal ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];
            const caisseCalculated = isGlobal ? calculated.combines : calculated.caisses[caisseId];
            const caisseDetails = isGlobal ? null : comptageData.caisses_data[caisseId];
            const retraitsDetails = isGlobal ? calculated.combines.retraits : caisseDetails?.retraits;
            
            csvContent += `Résumé pour;${caisseNom}\r\n`;
            csvContent += "Élément;Valeur\r\n";
            csvContent += `Fond de caisse;${caisseCalculated.fond_de_caisse}\r\n`;
            csvContent += `Ventes Théoriques;${caisseCalculated.ventes}\r\n`;
            csvContent += `Rétrocessions;${caisseCalculated.retrocession}\r\n`;
            csvContent += `Total Compté;${caisseCalculated.total_compte}\r\n`;
            csvContent += `Recette Réelle;${caisseCalculated.recette_reelle}\r\n`;
            csvContent += `Écart Final;${caisseCalculated.ecart}\r\n\r\n`;
            
            if (retraitsDetails && Object.keys(retraitsDetails).length > 0) {
                csvContent += `Retraits effectués pour;${caisseNom}\r\n`;
                csvContent += "Dénomination;Quantité Retirée;Total Retiré\r\n";
                Object.entries(retraitsDetails).forEach(([name, quantite]) => {
                    let valeur = 0;
                    if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                    if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                    const label = valeur >= 1 ? `${valeur} EUR` : `${valeur * 100} cts`;
                    csvContent += `${globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce'} de ${label};${quantite};${quantite * valeur}\r\n`;
                });
                csvContent += "\r\n";
            }
            
            csvContent += `Détail des espèces pour;${caisseNom}\r\n`;
            csvContent += "Dénomination;Quantité;Total\r\n";

            const denominationsToProcess = isGlobal ? calculated.combines.denominations : (caisseDetails ? caisseDetails.denominations : {});
            
            if (globalConfig.denominations && denominationsToProcess) {
                 for (const type in globalConfig.denominations) {
                    for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                        const quantite = denominationsToProcess[name] || 0;
                        if (quantite > 0) {
                            const label = value >= 1 ? `${value} EUR` : `${value * 100} cts`;
                            csvContent += `${type === 'billets' ? 'Billet' : 'Pièce'} de ${label};${quantite};${quantite * value}\r\n`;
                        }
                    }
                }
            }
            csvContent += "\r\n";
        };
        
        if (comptageData.isGlobal) {
            processCaisse(null, true);
        } else {
            for (const caisseId in comptageData.caisses_data) {
                processCaisse(caisseId);
            }
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `comptage_${comptageData.nom_comptage.replace(/ /g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


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
            let isGlobalView = false;

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

            const generateRetraitsTableHtml = (caisseDetails) => {
                if (!caisseDetails.retraits || Object.keys(caisseDetails.retraits).length === 0) {
                    return '';
                }

                let tableHtml = '<h4>Retraits Effectués</h4><table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité Retirée</th><th>Total Retiré</th></tr></thead><tbody>';
                let totalRetire = 0;

                for (const [name, quantite] of Object.entries(caisseDetails.retraits)) {
                    if (quantite > 0) {
                        let valeur = 0;
                        if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                        if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                        
                        const totalLigne = quantite * valeur;
                        totalRetire += totalLigne;
                        const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
                        tableHtml += `<tr><td>${globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce'} de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                    }
                }
                tableHtml += `</tbody></table><p style="text-align: right; font-weight: bold;">Total Retiré : ${formatEuros(totalRetire)}</p>`;
                return tableHtml;
            };

            const generateCombinedRetraitsTableHtml = (comptageData) => {
                const summaryQuantities = {};
                let hasRetraits = false;

                for (const caisseId in comptageData.caisses_data) {
                    const caisseDetails = comptageData.caisses_data[caisseId];
                    if (caisseDetails.retraits && Object.keys(caisseDetails.retraits).length > 0) {
                        hasRetraits = true;
                        for (const name in caisseDetails.retraits) {
                             summaryQuantities[name] = (summaryQuantities[name] || 0) + parseInt(caisseDetails.retraits[name] || 0);
                        }
                    }
                }

                if (!hasRetraits) {
                    return '';
                }

                let tableHtml = '<h4>Retraits Effectués (Global)</h4><table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité Totale Retirée</th><th>Total Retiré</th></tr></thead><tbody>';
                let summaryTotal = 0;

                if (globalConfig.denominations) {
                    for (const type in globalConfig.denominations) {
                        for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                            const quantite = summaryQuantities[name] || 0;
                            if (quantite > 0) {
                                const totalLigne = quantite * value;
                                summaryTotal += totalLigne;
                                const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                                tableHtml += `<tr><td>${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                        }
                    }
                }
                tableHtml += `</tbody></table><p style="text-align: right; font-weight: bold;">Total Global Retiré : ${formatEuros(summaryTotal)}</p>`;
                return tableHtml;
            };

            if (detailsButton.classList.contains('details-btn')) {
                const caisseId = detailsButton.dataset.caisseId;
                caisseIdForExport = caisseId;
                const caisseNom = detailsButton.dataset.caisseNom;

                html = `<div class="modal-header"><h3>Détails pour : ${caisseNom}</h3><span class="modal-close">&times;</span></div>
                        <h4>Résumé Financier</h4>
                        ${generateSummaryHtml(calculatedResults.caisses[caisseId])}
                        ${generateRetraitsTableHtml(comptageData.caisses_data[caisseId])}
                        <div class="modal-details-grid">
                            <div>
                                <h4>Répartition des Espèces</h4>
                                <div id="modal-chart-container"></div>
                            </div>
                            <div>
                                <h4>Détail des Espèces</h4>
                                ${generateDenominationsTableHtml(comptageData.caisses_data[caisseId])}
                            </div>
                         </div>
                         <div class="modal-footer">
                            <button class="action-btn-small" id="print-modal-btn"><i class="fa-solid fa-print"></i> Imprimer</button>
                            <button class="action-btn-small" id="csv-modal-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
                            <button class="action-btn-small" id="pdf-modal-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
                        </div>`;
            }

            if (detailsButton.classList.contains('details-all-btn')) {
                isGlobalView = true;
                html = `<div class="modal-header"><h3>Détails Complets du Comptage</h3><span class="modal-close">&times;</span></div>
                        <h4>Résumé Financier Global</h4>
                        ${generateSummaryHtml(calculatedResults.combines)}
                        ${generateCombinedRetraitsTableHtml(comptageData)}
                        <div class="modal-details-grid">
                            <div>
                                <h4>Répartition Globale des Espèces</h4>
                                <div id="modal-chart-container"></div>
                            </div>
                            <div>
                                <h4>Synthèse Globale des Espèces</h4>
                                ${generateCombinedDenominationsTableHtml(comptageData)}
                            </div>
                         </div>
                         <div class="modal-footer">
                            <button class="action-btn-small" id="print-modal-btn"><i class="fa-solid fa-print"></i> Imprimer</button>
                            <button class="action-btn-small" id="csv-modal-btn"><i class="fa-solid fa-file-csv"></i> Exporter en CSV</button>
                            <button class="action-btn-small" id="pdf-modal-btn"><i class="fa-solid fa-file-pdf"></i> Exporter en PDF</button>
                        </div>`;
            }
            
            if (html && detailsModalContent) {
                detailsModalContent.innerHTML = html;
                detailsModal.classList.add('visible');

                const modalChartContainer = document.getElementById('modal-chart-container');
                renderModalChart(modalChartContainer, comptageData, caisseIdForExport);
                
                document.getElementById('print-modal-btn').addEventListener('click', () => window.print());
                
                const dataForExport = isGlobalView ? { ...comptageData, isGlobal: true } : comptageData;
                document.getElementById('pdf-modal-btn').addEventListener('click', () => generateComptagePdf(dataForExport));
                document.getElementById('csv-modal-btn').addEventListener('click', () => generateComptageCsv(dataForExport));
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

    // --- LOGIQUE DE COMPARAISON (AMÉLIORÉE) ---
    const updateComparisonToolbar = () => {
        const count = selectedForComparison.length;
        comparisonCounter.textContent = `${count} comptage(s) sélectionné(s)`;
        if (count > 0) {
            comparisonToolbar.classList.add('visible');
        } else {
            comparisonToolbar.classList.remove('visible');
        }
        compareBtn.disabled = count < 2;
    };

    const handleSelectionChange = (event) => {
        const checkbox = event.target;
        if (!checkbox.classList.contains('comparison-checkbox')) return;

        const card = checkbox.closest('.history-card');
        const comptageId = card.dataset.id;

        if (checkbox.checked) {
            selectedForComparison.push(comptageId);
            card.classList.add('selected');
        } else {
            selectedForComparison = selectedForComparison.filter(id => id !== comptageId);
            card.classList.remove('selected');
        }
        updateComparisonToolbar();
    };

    const renderComparisonModal = () => {
        if (selectedForComparison.length < 2) return;
        
        const gridClass = selectedForComparison.length > 3 ? 'comparison-grid-dynamic' : `comparison-grid-${selectedForComparison.length}`;
        let html = `<div class="modal-header"><h3>Comparaison de Comptages</h3><span class="modal-close">&times;</span></div><div class="comparison-grid ${gridClass}">`;

        const firstData = JSON.parse(document.querySelector(`.history-card[data-id="${selectedForComparison[0]}"]`).dataset.comptage);
        const firstResults = calculateResults(firstData);

        selectedForComparison.forEach(comptageId => {
            const data = JSON.parse(document.querySelector(`.history-card[data-id="${comptageId}"]`).dataset.comptage);
            const results = calculateResults(data);

            const renderValue = (val1, val2) => {
                if (data.id === firstData.id) {
                    return `<span class="comparison-item-value">${formatEuros(val2)}</span>`;
                }
                const diff = val2 - val1;
                let diffHtml = '';
                if (Math.abs(diff) > 0.001) {
                    const diffClass = diff > 0 ? 'positive' : 'negative';
                    const sign = diff > 0 ? '+' : '';
                    diffHtml = `<span class="value-diff ${diffClass}">(${sign}${formatEuros(diff)})</span>`;
                }
                return `<span class="comparison-item-value">${formatEuros(val2)}</span> ${diffHtml}`;
            };
            
            html += `<div class="comparison-column">
                        <h4>${data.nom_comptage}</h4>
                        <div class="comparison-item"><span class="comparison-item-label">Date</span><span class="comparison-item-value">${formatDateFr(data.date_comptage)}</span></div>
                        <div class="comparison-item"><span class="comparison-item-label">Total Compté</span><span>${renderValue(firstResults.combines.total_compté, results.combines.total_compté)}</span></div>
                        <div class="comparison-item"><span class="comparison-item-label">Recette Réelle</span><span>${renderValue(firstResults.combines.recette_reelle, results.combines.recette_reelle)}</span></div>
                        <div class="comparison-item"><span class="comparison-item-label">Écart Final</span><span>${renderValue(firstResults.combines.ecart, results.combines.ecart)}</span></div>
                    </div>`;
        });
        
        html += `</div>`;
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

    function calculateResults(comptageData) {
        const results = { caisses: {}, combines: { total_compté: 0, recette_reelle: 0, ecart: 0, recette_theorique: 0, fond_de_caisse: 0, ventes: 0, retrocession: 0, denominations: {}, retraits: {} }};
        const denominations = globalConfig.denominations;

        for (const caisseId in comptageData.caisses_data) {
            if (!comptageData.caisses_data.hasOwnProperty(caisseId)) continue;
            const caisseData = comptageData.caisses_data[caisseId];
            let total_compte = 0;

            if (denominations && caisseData.denominations) {
                for (const type in denominations) {
                    for (const name in denominations[type]) {
                        const quantite = (parseFloat(caisseData.denominations[name]) || 0);
                        total_compte += quantite * denominations[type][name];
                        results.combines.denominations[name] = (results.combines.denominations[name] || 0) + quantite;
                    }
                }
            }
            
            if (caisseData.retraits) {
                for (const name in caisseData.retraits) {
                    const quantite = (parseFloat(caisseData.retraits[name]) || 0);
                    results.combines.retraits[name] = (results.combines.retraits[name] || 0) + quantite;
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

    function renderWithdrawalsView(historique) {
        if (!withdrawalsSummaryTable) return;
        const allWithdrawals = [];
        historique.forEach(comptage => {
            for (const caisseId in comptage.caisses_data) {
                const caisseData = comptage.caisses_data[caisseId];
                if (caisseData.retraits && Object.keys(caisseData.retraits).length > 0) {
                    for (const denomination in caisseData.retraits) {
                        allWithdrawals.push({
                            date: comptage.date_comptage,
                            caisse: globalConfig.nomsCaisses[caisseId],
                            denomination: denomination,
                            quantite: caisseData.retraits[denomination]
                        });
                    }
                }
            }
        });

        if (allWithdrawals.length === 0) {
            withdrawalsSummaryTable.innerHTML = '<p>Aucun retrait trouvé pour la période sélectionnée.</p>';
            return;
        }

        let tableHtml = '<table class="modal-details-table"><thead><tr><th>Date</th><th>Caisse</th><th>Dénomination</th><th>Quantité Retirée</th><th>Montant</th></tr></thead><tbody>';
        allWithdrawals.forEach(withdrawal => {
            let valeur = 0;
            if (globalConfig.denominations.billets[withdrawal.denomination]) {
                valeur = globalConfig.denominations.billets[withdrawal.denomination];
            } else if (globalConfig.denominations.pieces[withdrawal.denomination]) {
                valeur = globalConfig.denominations.pieces[withdrawal.denomination];
            }
            const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
            tableHtml += `<tr><td>${formatDateFr(withdrawal.date)}</td><td>${withdrawal.caisse}</td><td>${label}</td><td>${withdrawal.quantite}</td><td>${formatEuros(withdrawal.quantite * valeur)}</td></tr>`;
        });
        tableHtml += '</tbody></table>';
        withdrawalsSummaryTable.innerHTML = tableHtml;
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
                renderWithdrawalsView(data.historique_complet);
                if (historyGrid) {
                    historyGrid.dataset.allComptages = JSON.stringify(data.historique_complet);
                }
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

    viewTabs.addEventListener('click', (e) => {
        e.preventDefault();
        const link = e.target.closest('.tab-link');
        if (!link) return;

        document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
        document.getElementById(`${link.dataset.view}-view`).classList.add('active');
    });

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
