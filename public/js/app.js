/**
 * Fichier principal JavaScript pour la page du calculateur de caisse.
 * Gère les calculs, les onglets, la synchro WebSocket et la sauvegarde intelligente.
 */
document.addEventListener('DOMContentLoaded', function() {
    
    // --- Logique pour la page de l'historique ---
    const printBtn = document.getElementById('print-btn');
    const pdfBtn = document.getElementById('pdf-btn');
    const excelBtn = document.getElementById('excel-btn');
    const exportTable = document.getElementById('history-table-export');

    if (printBtn && exportTable) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    if (pdfBtn && exportTable) {
        pdfBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape'
            });
            
            doc.autoTable({ 
                html: '#history-table-export',
                headStyles: { fillColor: [44, 62, 80] }, // Couleur de l'en-tête
                margin: { top: 15 },
                didDrawPage: function (data) {
                    doc.text("Historique des Comptages", 15, 10);
                }
            });

            const date = new Date();
            const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            const vueCaisseSelect = document.querySelector('select[name="vue_caisse"]');
            const vueCaisse = vueCaisseSelect ? vueCaisseSelect.options[vueCaisseSelect.selectedIndex].text : 'global';
            const filename = `export-historique-${vueCaisse.toLowerCase().replace(/\s/g, '-')}-${dateString}.pdf`;

            doc.save(filename);
        });
    }

    if (excelBtn && exportTable) {
        excelBtn.addEventListener('click', () => {
            let csv = [];
            const rows = exportTable.querySelectorAll("tr");
            
            for (const row of rows) {
                let row_data = [];
                const cols = row.querySelectorAll("td, th");
                
                for (const col of cols) {
                    if (!col.classList.contains('no-export')) {
                        let data = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/(\s\s)/gm, " ");
                        data = data.replace(/"/g, '""');
                        row_data.push('"' + data + '"');
                    }
                }
                csv.push(row_data.join(","));
            }

            const csv_file = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
            const download_link = document.createElement("a");
            
            const date = new Date();
            const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            const vueCaisseSelect = document.querySelector('select[name="vue_caisse"]');
            const vueCaisse = vueCaisseSelect ? vueCaisseSelect.options[vueCaisseSelect.selectedIndex].text : 'global';
            const filename = `export-historique-${vueCaisse.toLowerCase().replace(/\s/g, '-')}-${dateString}.csv`;

            download_link.href = URL.createObjectURL(csv_file);
            download_link.download = filename;
            document.body.appendChild(download_link);
            download_link.click();
            document.body.removeChild(download_link);
        });
    }

    // --- Logique pour la page du calculateur ---
    const caisseForm = document.getElementById('caisse-form');
    if (!caisseForm) {
        return;
    }

    const denominations = {
        billets: { b500: 500, b200: 200, b100: 100, b50: 50, b20: 20, b10: 10, b5: 5 },
        pieces: { p200: 2, p100: 1, p050: 0.50, p020: 0.20, p010: 0.10, p005: 0.05, p002: 0.02, p001: 0.01 }
    };
    const nombreCaisses = 2;
    const nomsCaisses = {
        1: "Caisse centre ville",
        2: "Caisse officine"
    };

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const nomComptageInput = document.getElementById('nom_comptage');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    let isSubmitting = false;

    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    const calculateAllFull = () => {
        let totauxCombines = { fdc: 0, total: 0, recette: 0, theorique: 0, ecart: 0 };
        let allCaissesReady = true;

        for (let i = 1; i <= nombreCaisses; i++) {
            const getVal = (id) => parseFloat(document.getElementById(id + '_' + i).value.replace(',', '.')) || 0;
            let totalCompte = 0;
            for (const type in denominations) for (const name in denominations[type]) totalCompte += getVal(name) * denominations[type][name];
            const fondDeCaisse = getVal('fond_de_caisse'), ventes = getVal('ventes'), retrocession = getVal('retrocession');
            
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
            ecartEl.className = 'ecart-ok';
            if (ecart > 0.001) { ecartEl.className = 'ecart-positif'; }
            if (ecart < -0.001) { ecartEl.className = 'ecart-negatif'; }

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
        ecartTotalEl.className = totauxCombines.ecart > 0.001 ? 'ecart-positif' : (totauxCombines.ecart < -0.001 ? 'ecart-negatif' : '');
        
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
        const nomActuel = nomComptageInput.value.trim();
        if (nomActuel !== '') {
            const formData = new FormData(caisseForm);
            const nouveauNom = `Sauvegarde auto du ${formatDateTimeFr().replace(', ', ' à ')}`;
            formData.set('nom_comptage', nouveauNom);
            navigator.sendBeacon('index.php?page=calculateur&action=autosave', formData);
        }
    });

    // --- Gestion de la mise à jour ---
    const versionInfo = document.getElementById('version-info');
    const updateButton = document.getElementById('update-button');

    if (versionInfo && updateButton) {
        let releaseNotes = ''; // Variable pour stocker les notes de version

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
                    releaseNotes = data.release_notes; // On stocke les notes
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
