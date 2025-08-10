/**
 * Fichier principal JavaScript.
 * Gère la navigation responsive, le calculateur et la page d'historique.
 */
document.addEventListener('DOMContentLoaded', function() {

    // --- Fonctions utilitaires globales ---
    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);

    // --- Logique pour la barre de navigation responsive (s'applique à toutes les pages) ---
    const navbarToggler = document.getElementById('navbar-toggler');
    const navbarCollapse = document.getElementById('navbar-collapse');

    if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener('click', function() {
            navbarCollapse.classList.toggle('show');
        });
    }

    // --- Logique pour la page d'historique ---
    const historyPage = document.querySelector('.history-grid, .history-table');
    if (historyPage) {
        // Logique de la fenêtre modale
        const modal = document.getElementById('details-modal');
        if(modal) {
            const modalContent = document.getElementById('modal-details-content');
            const closeModalBtn = document.querySelector('.modal-close');

            historyPage.addEventListener('click', function(event) {
                const detailsButton = event.target.closest('.details-btn');
                const allDetailsButton = event.target.closest('.details-all-btn');

                // --- Gère le clic sur le bouton de détail d'une seule caisse ---
                if (detailsButton) {
                    const card = detailsButton.closest('.history-card');
                    if (!card || !card.dataset.comptage) return;

                    const comptageData = JSON.parse(card.dataset.comptage);
                    const caisseId = detailsButton.dataset.caisseId;
                    const caisseNom = detailsButton.dataset.caisseNom;
                    
                    let html = `<div class="modal-header">
                                    <h3>Détails pour : ${caisseNom}</h3>
                                    <div class="modal-actions">
                                        <button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                                        <button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button>
                                    </div>
                                </div>`;
                    html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                    html += '<table class="modal-details-table">';
                    html += '<thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead>';
                    html += '<tbody>';

                    let totalCaisse = 0;
                    if (typeof denominations !== 'undefined') {
                        for (const [name, value] of Object.entries(denominations.billets)) {
                            const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                            const totalLigne = quantite * value;
                            totalCaisse += totalLigne;
                            html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                        }
                        for (const [name, value] of Object.entries(denominations.pieces)) {
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

                // --- Gère le clic sur le bouton "Ensemble" ---
                if (allDetailsButton) {
                    const card = allDetailsButton.closest('.history-card');
                    if (!card || !card.dataset.comptage) return;

                    const comptageData = JSON.parse(card.dataset.comptage);
                    
                    let html = `<div class="modal-header">
                                    <h3>Détails Complets du Comptage</h3>
                                    <div class="modal-actions">
                                        <button class="action-btn modal-export-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                                        <button class="action-btn modal-export-excel"><i class="fa-solid fa-file-csv"></i> Excel</button>
                                    </div>
                                </div>`;
                    html += `<p><strong>Nom du comptage :</strong> ${comptageData.nom_comptage}</p>`;
                    
                    const summaryQuantities = {};
                    let summaryTotal = 0;

                    if (typeof nomsCaisses !== 'undefined') {
                        for (const caisseId in nomsCaisses) {
                            const caisseNom = nomsCaisses[caisseId];
                            html += `<h4 class="modal-table-title">${caisseNom}</h4>`;
                            html += '<table class="modal-details-table">';
                            html += '<thead><tr><th>Dénomination</th><th>Quantité</th><th>Total</th></tr></thead>';
                            html += '<tbody>';

                            let totalCaisse = 0;
                            if (typeof denominations !== 'undefined') {
                                for (const [name, value] of Object.entries(denominations.billets)) {
                                    const quantite = comptageData[`c${caisseId}_${name}`] || 0;
                                    summaryQuantities[name] = (summaryQuantities[name] || 0) + quantite;
                                    const totalLigne = quantite * value;
                                    totalCaisse += totalLigne;
                                    html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                                }
                                for (const [name, value] of Object.entries(denominations.pieces)) {
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
                        html += '<table class="modal-details-table">';
                        html += '<thead><tr><th>Dénomination</th><th>Quantité Totale</th><th>Total</th></tr></thead>';
                        html += '<tbody>';

                        if (typeof denominations !== 'undefined') {
                            for (const [name, value] of Object.entries(denominations.billets)) {
                                const quantite = summaryQuantities[name] || 0;
                                const totalLigne = quantite * value;
                                summaryTotal += totalLigne;
                                html += `<tr><td>Billet de ${value} €</td><td>${quantite}</td><td>${formatEuros(totalLigne)}</td></tr>`;
                            }
                            for (const [name, value] of Object.entries(denominations.pieces)) {
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

            // --- Gère les clics sur les boutons d'export DANS la modale ---
            modalContent.addEventListener('click', function(event) {
                const mainTitle = modalContent.querySelector('h3').textContent;
                const tables = modalContent.querySelectorAll('.modal-details-table');
                
                if (event.target.closest('.modal-export-pdf')) {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.text(mainTitle, 14, 16);
                    let startY = 25;

                    tables.forEach((table, index) => {
                        const subTitleEl = table.previousElementSibling;
                        if (subTitleEl && (subTitleEl.tagName === 'H4' || subTitleEl.tagName === 'H5')) {
                            doc.text(subTitleEl.textContent, 14, startY);
                            startY += 8;
                        }
                        doc.autoTable({
                            html: table,
                            startY: startY,
                        });
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
                if (event.target == modal) { modal.style.display = 'none'; }
            }
        }

        // --- Logique des boutons d'export principaux ---
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
                
                document.querySelectorAll('.history-card, .history-table tbody tr').forEach(item => {
                    let date, nom, ecart;
                    if(item.classList.contains('history-card')) {
                        date = item.querySelector('.date')?.textContent.trim();
                        nom = item.querySelector('h4')?.textContent.trim();
                        ecart = item.querySelector('.summary-line .ecart-positif, .summary-line .ecart-negatif')?.textContent.trim() || '0,00 €';
                    } else { // C'est une ligne de tableau
                        date = item.cells[1]?.textContent.trim();
                        nom = item.cells[0]?.querySelector('strong')?.textContent.trim();
                        ecart = item.cells[item.cells.length - 2]?.textContent.trim();
                    }
                    if(date && nom && ecart) {
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
                
                document.querySelectorAll('.history-card, .history-table tbody tr').forEach(item => {
                    let date, nom, explication, ecart;
                     if(item.classList.contains('history-card')) {
                        date = `"${item.querySelector('.date')?.textContent.trim()}"`;
                        nom = `"${item.querySelector('h4')?.textContent.trim()}"`;
                        const explicationEl = item.querySelector('.explication');
                        explication = explicationEl ? `"${explicationEl.textContent.trim()}"` : '""';
                        const ecartEl = item.querySelector('.summary-line .ecart-positif, .summary-line .ecart-negatif');
                        ecart = ecartEl ? `"${ecartEl.textContent.trim().replace('.', ',')}"` : '"0,00 €"';
                    } else { // C'est une ligne de tableau
                        date = `"${item.cells[1]?.textContent.trim()}"`;
                        nom = `"${item.cells[0]?.querySelector('strong')?.textContent.trim()}"`;
                        const explicationEl = item.cells[0]?.querySelector('.explication-text');
                        explication = explicationEl ? `"${explicationEl.textContent.trim()}"` : '""';
                        ecart = `"${item.cells[item.cells.length - 2]?.textContent.trim().replace('.', ',')}"`;
                    }
                    if(date && nom && ecart) {
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
    }


    // --- Logique spécifique à la page du calculateur ---
    const caisseForm = document.getElementById('caisse-form');
    if (!caisseForm) {
        return; // On n'est pas sur la page du calculateur, on arrête le script ici.
    }

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const nomComptageInput = document.getElementById('nom_comptage');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    let isSubmitting = false;

    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    const calculateAllFull = () => {
        if (typeof nomsCaisses === 'undefined' || typeof denominations === 'undefined') { return; }

        let totauxCombines = { fdc: 0, total: 0, recette: 0, theorique: 0, ecart: 0 };
        let allCaissesReady = true;

        for (const i of Object.keys(nomsCaisses)) {
            const getVal = (id) => {
                const element = document.getElementById(id + '_' + i);
                return element ? parseFloat(element.value.replace(',', '.')) || 0 : 0;
            };

            let totalCompte = 0;
            for (const type in denominations) {
                for (const name in denominations[type]) {
                    totalCompte += getVal(name) * denominations[type][name];
                }
            }
            
            const fondDeCaisse = getVal('fond_de_caisse');
            const ventes = getVal('ventes');
            const retrocession = getVal('retrocession');
            const recetteTheorique = ventes + retrocession;
            const recetteReelle = totalCompte - fondDeCaisse;
            const ecart = recetteTheorique > 0 ? recetteReelle - recetteTheorique : 0;
            
            totauxCombines.fdc += fondDeCaisse;
            totauxCombines.total += totalCompte;
            totauxCombines.recette += recetteReelle;
            totauxCombines.theorique += recetteTheorique;
            totauxCombines.ecart += ecart;
            
            document.getElementById(`res-c${i}-fdc`).textContent = formatEuros(fondDeCaisse);
            document.getElementById(`res-c${i}-total`).textContent = formatEuros(totalCompte);
            document.getElementById(`res-c${i}-theorique`).textContent = formatEuros(recetteTheorique);
            document.getElementById(`res-c${i}-recette`).textContent = formatEuros(recetteReelle);
            const ecartEl = document.getElementById(`res-c${i}-ecart`);
            ecartEl.textContent = formatEuros(ecart);
            ecartEl.className = 'total';
            if (ecart > 0.001) { ecartEl.classList.add('ecart-positif'); }
            if (ecart < -0.001) { ecartEl.classList.add('ecart-negatif'); }

            const topEcartDisplay = document.querySelector(`#ecart-display-caisse${i}`);
            if (topEcartDisplay) {
                const topEcartDisplayValue = topEcartDisplay.querySelector('.ecart-value');
                const topEcartExplanation = topEcartDisplay.querySelector('.ecart-explanation');
                const topEcartExplanationTotal = topEcartDisplay.querySelector('.ecart-explanation-total');
                
                topEcartDisplay.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
                topEcartExplanationTotal.style.display = 'none';

                if (ventes === 0 && retrocession === 0) {
                    allCaissesReady = false;
                    const diffFondDeCaisse = totalCompte - fondDeCaisse;
                    topEcartDisplayValue.textContent = formatEuros(diffFondDeCaisse);
                    topEcartExplanation.innerHTML = "Renseignez la valeurs des ventes ou des rétrocession pour commencer le comptage";
                    
                    topEcartExplanationTotal.style.display = 'block';
                    if (Math.abs(diffFondDeCaisse) < 0.01) {
                        topEcartDisplay.classList.add('ecart-ok');
                        topEcartExplanationTotal.innerHTML = `Le fond de caisse pour la <strong>${nomsCaisses[i]}</strong> est juste.`;
                    } else if (diffFondDeCaisse > 0) {
                        topEcartDisplay.classList.add('ecart-positif');
                        topEcartExplanationTotal.innerHTML = `Pour la <strong>${nomsCaisses[i]}</strong>, il y a <strong>${formatEuros(diffFondDeCaisse)}</strong> en trop par rapport au fond de caisse.`;
                    } else {
                        topEcartDisplay.classList.add('ecart-negatif');
                        topEcartExplanationTotal.innerHTML = `Pour la <strong>${nomsCaisses[i]}</strong>, il manque <strong>${formatEuros(Math.abs(diffFondDeCaisse))}</strong> par rapport au fond de caisse.`;
                    }
                } else {
                    topEcartDisplayValue.textContent = formatEuros(ecart);
                    
                    if (Math.abs(ecart) < 0.01) {
                        topEcartDisplay.classList.add('ecart-ok');
                        topEcartExplanation.innerHTML = `Montant à retirer sur celle ci à la cloture : <strong>${formatEuros(recetteReelle)}</strong>`;
                    } else if (ecart > 0) {
                        topEcartDisplay.classList.add('ecart-positif');
                        topEcartExplanation.textContent = "Il y a trop dans la caisse, recomptez la et vérifiez les valeurs saisie";
                    } else {
                        topEcartDisplay.classList.add('ecart-negatif');
                        topEcartExplanation.textContent = "Il manque de l'argent dans la caisse, recomptez la, vérifiez les valeurs saisie et si nécessaire faire un ajustement de caisse";
                    }
                }
            }
        }
        
        document.getElementById('res-total-theorique').textContent = formatEuros(totauxCombines.theorique);
        document.getElementById('res-total-total').textContent = formatEuros(totauxCombines.total);
        document.getElementById('res-total-recette').textContent = formatEuros(totauxCombines.recette);
        const ecartTotalEl = document.getElementById('res-total-ecart');
        ecartTotalEl.textContent = formatEuros(totauxCombines.ecart);
        ecartTotalEl.className = 'total';
        if (totauxCombines.ecart > 0.001) { ecartTotalEl.classList.add('ecart-positif'); }
        if (totauxCombines.ecart < -0.001) { ecartTotalEl.classList.add('ecart-negatif'); }
        
        if (allCaissesReady) {
            ecartDisplays.forEach(display => {
                const totalExplanationEl = display.querySelector('.ecart-explanation-total');
                if (totalExplanationEl) {
                    if (Math.abs(totauxCombines.ecart) < 0.01) {
                        totalExplanationEl.innerHTML = `Montant total à retirer (toutes caisses) : <strong>${formatEuros(totauxCombines.recette)}</strong>`;
                        totalExplanationEl.style.display = 'block';
                    } else {
                        totalExplanationEl.style.display = 'none';
                    }
                }
            });
        }
    };

    // --- Logique WebSocket ---
    let conn;
    try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/`;
        conn = new WebSocket(wsUrl);

        conn.onopen = (e) => {
            if(statusIndicator) {
                statusIndicator.classList.remove('disconnected');
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connecté en temps réel';
            }
        };
        conn.onerror = (e) => {
            if(statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
        };
        conn.onclose = (e) => {
             if(statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
        };

        conn.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.id && typeof data.value !== 'undefined') {
                    const input = document.getElementById(data.id);
                    if (input && input.value !== data.value) {
                        input.value = data.value;
                    }
                } else {
                    for (const fieldId in data) {
                        const input = document.getElementById(fieldId);
                        if (input) {
                            input.value = data[fieldId];
                        }
                    }
                }
                calculateAllFull();
                initialDenominationState = getDenominationStateAsString();
            } catch (error) {
                console.error("Erreur de parsing JSON WebSocket:", error);
            }
        };

        caisseForm.addEventListener('input', (event) => {
            calculateAllFull();
            if (conn.readyState === WebSocket.OPEN) {
                conn.send(JSON.stringify({ id: event.target.id, value: event.target.value }));
            }
        });
    } catch (e) {
        console.error("Impossible d'initialiser la connexion WebSocket:", e);
        if(statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Erreur de connexion';
        }
    }
    
    // --- Écouteurs d'événements ---
    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            event.currentTarget.classList.add('active');
            const activeContent = document.getElementById(event.currentTarget.dataset.tab);
            if (activeContent) {
                activeContent.classList.add('active');
            }
            ecartDisplays.forEach(display => display.classList.remove('active'));
            const activeEcartDisplay = document.getElementById(`ecart-display-${event.currentTarget.dataset.tab}`);
            if (activeEcartDisplay) {
                activeEcartDisplay.classList.add('active');
            }
        });
    });

    caisseForm.addEventListener('submit', function() {
        isSubmitting = true;
    });

    // --- Initialisation ---
    calculateAllFull();

    // --- Logique de sauvegarde intelligente ---
    let initialDenominationState = '';
    
    function getDenominationStateAsString() {
        const state = {};
        const inputs = caisseForm.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            state[input.id] = input.value;
        });
        return JSON.stringify(state);
    }

    initialDenominationState = getDenominationStateAsString();

    window.addEventListener('beforeunload', function(e) {
        if (isSubmitting) {
            return;
        }
        
        const currentDenominationState = getDenominationStateAsString();
        if (initialDenominationState === currentDenominationState) {
            return;
        }

        const formData = new FormData(caisseForm);
        const nouveauNom = `Sauvegarde auto du ${formatDateTimeFr().replace(', ', ' à ')}`;
        formData.set('nom_comptage', nouveauNom);
        
        navigator.sendBeacon('index.php?page=calculateur&action=autosave', formData);
    });

    // --- Gestion de la mise à jour ---
    const versionInfo = document.getElementById('version-info');
    const updateButton = document.getElementById('update-button');

    if (versionInfo && updateButton) {
        let releaseNotes = '';

        fetch('index.php?action=git_release_check')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    versionInfo.textContent = "Erreur de vérification de version.";
                    console.error("Détails de l'erreur de l'API:", data);
                    return;
                }

                if (data.update_available) {
                    versionInfo.innerHTML = `Version <strong>${data.local_version}</strong>. 
                        <span style="color: #e67e22;">Mise à jour vers ${data.remote_version} disponible.</span>`;
                    updateButton.style.display = 'inline-block';
                    releaseNotes = data.release_notes;
                } else {
                    versionInfo.innerHTML = `Version <strong>${data.local_version}</strong>. Vous êtes à jour.`;
                }
            })
            .catch(error => {
                versionInfo.textContent = "Impossible de vérifier la version.";
                console.error('Erreur lors de la vérification de la version:', error);
            });

        updateButton.addEventListener('click', function() {
            const confirmationMessage = `
Une nouvelle version est disponible !

--- NOTES DE VERSION ---
${releaseNotes}
-------------------------

Voulez-vous mettre à jour l'application maintenant ?`;

            if (confirm(confirmationMessage)) {
                versionInfo.textContent = "Mise à jour en cours...";
                updateButton.disabled = true;

                fetch('index.php?action=git_pull')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            versionInfo.innerHTML = `<strong>${data.message}</strong>`;
                            if (data.message.includes("terminée")) {
                                versionInfo.innerHTML += " Veuillez rafraîchir la page.";
                            }
                            updateButton.style.display = 'none';
                        } else {
                            versionInfo.textContent = "Erreur lors de la mise à jour.";
                            alert(`Échec de la mise à jour : ${data.message}\n\nDétails techniques dans la console (F12).`);
                            console.error("Détails de l'erreur de mise à jour:", data.output);
                            updateButton.disabled = false;
                        }
                    })
                    .catch(error => {
                        versionInfo.textContent = "Erreur lors de la mise à jour.";
                        updateButton.disabled = false;
                        console.error('Erreur lors de la mise à jour:', error);
                    });
            }
        });
    }
});
