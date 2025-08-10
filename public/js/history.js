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
                const card = allDetailsButton.closest('.history-card');
                if (!card || !card.dataset.comptage) return;

                const comptageData = JSON.parse(card.dataset.comptage);
                
                let html = `<div class="modal-header"><h3>Détails Complets du Comptage</h3><div class="modal-actions"><button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button><button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button></div></div>`;
                html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                
                const summaryQuantities = {};
                let summaryTotal = 0;

                if (config.nomsCaisses) {
                    for (const caisseId in config.nomsCaisses) {
                        const caisseNom = config.nomsCaisses[caisseId];
                        html += `<h4 class="modal-table-title">${caisseNom}</h4>`;
                        html += '<table class="modal-details-table"><thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead><tbody>';

                        let totalCaisse = 0;
                        if (config.denominations) {
                            for (const [name, value] of Object.entries(config.denominations.billets)) {
                                const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                                summaryQuantities[name] = (summaryQuantities[name] || 0) + quantite;
                                const totalLigne = quantite * value;
                                totalCaisse += totalLigne;
                                html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                            for (const [name, value] of Object.entries(config.denominations.pieces)) {
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

                    if (config.denominations) {
                        for (const [name, value] of Object.entries(config.denominations.billets)) {
                            const quantite = summaryQuantities[name] || 0;
                            const totalLigne = quantite * value;
                            summaryTotal += totalLigne;
                            html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                        }
                        for (const [name, value] of Object.entries(config.denominations.pieces)) {
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
                modal.style.display = 'block';
            }
        });

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

    // --- LOGIQUE POUR LES BOUTONS D'EXPORT PRINCIPAUX ---
    const printBtn = document.getElementById('print-btn');
    if(printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    const pdfBtn = document.getElementById('pdf-btn');
    if(pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const tableData = [];
            const headers = [['Date', 'Nom du comptage', 'Écart Global']];
            
            document.querySelectorAll('.history-card').forEach(card => {
                const date = card.querySelector('.date')?.textContent.trim();
                const nom = card.querySelector('h4')?.textContent.trim();
                const ecart = card.querySelector('.summary-line .ecart-positif, .summary-line .ecart-negatif')?.textContent.trim() || '0,00 €';
                if(date && nom) {
                   tableData.push([date, nom, ecart]);
                }
            });

            doc.autoTable({ head: headers, body: tableData });
            doc.save('historique-comptages.pdf');
        });
    }

    const excelBtn = document.getElementById('excel-btn');
    if(excelBtn) {
        excelBtn.addEventListener('click', () => {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Date;Nom du comptage;Explication;Ecart Global\r\n";
            
            document.querySelectorAll('.history-card').forEach(card => {
                const date = `"${card.querySelector('.date')?.textContent.trim()}"`;
                const nom = `"${card.querySelector('h4')?.textContent.trim()}"`;
                const explicationEl = card.querySelector('.explication');
                const explication = explicationEl ? `"${explicationEl.textContent.trim()}"` : '""';
                const ecartEl = card.querySelector('.summary-line .ecart-positif, .summary-line .ecart-negatif');
                const ecart = ecartEl ? `"${ecartEl.textContent.trim().replace('.', ',')}"` : '"0,00 €"';
                
                if(date && nom) {
                    let row = [date, nom, explication, ecart].join(';');
                    csvContent += row + "\r\n";
                }
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "historique-comptages.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
