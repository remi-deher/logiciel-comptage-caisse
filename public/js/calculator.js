/**
 * Module JavaScript pour la page Calculateur.
 */
document.addEventListener('DOMContentLoaded', function() {
    const caisseForm = document.getElementById('caisse-form');
    if (!caisseForm) return; // Ne s'exécute que sur la page du calculateur

    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    const configElement = document.getElementById('calculator-data');
    const config = configElement ? JSON.parse(configElement.dataset.config) : {};
    
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const autosaveStatus = document.getElementById('autosave-status');
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    const nomComptageInput = document.getElementById('nom_comptage');

    let autosaveTimeout;
    let isSubmitting = false;
    let initialState = '';
    let conn; // Déclarer la connexion ici

    function getFormStateAsString() {
        const state = {};
        caisseForm.querySelectorAll('input[type="number"], input[type="text"], textarea').forEach(input => {
            if (input.id) state[input.id] = input.value;
        });
        return JSON.stringify(state);
    }

    function hasUnsavedChanges() {
        return initialState !== getFormStateAsString();
    }

    function performAutosave(isFinal = false) {
        if (!hasUnsavedChanges() && !isFinal) return;
        
        if (autosaveStatus && !isFinal) {
            autosaveStatus.textContent = 'Sauvegarde en cours...';
            autosaveStatus.className = 'autosave-status saving';
        }

        const formData = new FormData(caisseForm);
        let nom = formData.get('nom_comptage');
        if (!nom || nom.startsWith('Sauvegarde auto')) {
            nom = `Sauvegarde auto du ${formatDateTimeFr().replace(', ', ' à ')}`;
            formData.set('nom_comptage', nom);
        }
        
        if (isFinal && navigator.sendBeacon) {
            navigator.sendBeacon('index.php?action=autosave', new URLSearchParams(formData));
        } else {
            fetch('index.php?action=autosave', { method: 'POST', body: formData })
                .then(response => response.ok ? response.json() : Promise.reject('Server error'))
                .then(data => {
                    if (data.success) {
                        if (autosaveStatus) {
                            autosaveStatus.textContent = data.message;
                            autosaveStatus.className = 'autosave-status success';
                        }
                        initialState = getFormStateAsString();
                    }
                })
                .catch(() => {
                    if (autosaveStatus) {
                        autosaveStatus.textContent = 'Erreur de sauvegarde.';
                        autosaveStatus.className = 'autosave-status error';
                    }
                });
        }
    }

    function calculateAllFull() {
        if (!config.nomsCaisses) return;
        let totauxCombines = { fdc: 0, total: 0, recette: 0, theorique: 0, ecart: 0 };
        const caissesData = {};

        for (const i of Object.keys(config.nomsCaisses)) {
            const getVal = (id) => parseFloat(document.getElementById(`${id}_${i}`)?.value.replace(',', '.') || 0) || 0;
            
            let totalCompte = 0;
            for (const type in config.denominations) {
                for (const name in config.denominations[type]) {
                    totalCompte += getVal(name) * config.denominations[type][name];
                }
            }
            
            const fondDeCaisse = getVal('fond_de_caisse');
            const ventes = getVal('ventes');
            const retrocession = getVal('retrocession');
            const recetteTheorique = ventes;
            const recetteReelle = totalCompte - fondDeCaisse - retrocession;
            const ecart = recetteReelle - recetteTheorique;
            
            caissesData[i] = { ecart, recetteReelle };

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
            ecartEl.parentElement.className = 'result-line total';
            if (ecart > 0.001) ecartEl.parentElement.classList.add('ecart-positif');
            if (ecart < -0.001) ecartEl.parentElement.classList.add('ecart-negatif');
        }
        
        document.getElementById('res-total-fdc').textContent = formatEuros(totauxCombines.fdc);
        document.getElementById('res-total-total').textContent = formatEuros(totauxCombines.total);
        document.getElementById('res-total-theorique').textContent = formatEuros(totauxCombines.theorique);
        document.getElementById('res-total-recette').textContent = formatEuros(totauxCombines.recette);
        const ecartTotalEl = document.getElementById('res-total-ecart');
        ecartTotalEl.textContent = formatEuros(totauxCombines.ecart);
        ecartTotalEl.parentElement.className = 'result-line total';
        if (totauxCombines.ecart > 0.001) ecartTotalEl.parentElement.classList.add('ecart-positif');
        if (totauxCombines.ecart < -0.001) ecartTotalEl.parentElement.classList.add('ecart-negatif');

        for (const i of Object.keys(config.nomsCaisses)) {
            const topEcartDisplay = document.querySelector(`#ecart-display-caisse${i}`);
            if (topEcartDisplay) {
                const topEcartDisplayValue = topEcartDisplay.querySelector('.ecart-value');
                const topEcartExplanation = topEcartDisplay.querySelector('.ecart-explanation');
                const { ecart, recetteReelle } = caissesData[i];
                
                topEcartDisplayValue.textContent = formatEuros(ecart);
                
                const wasActive = topEcartDisplay.classList.contains('active');
                topEcartDisplay.className = 'ecart-display';
                if (wasActive) topEcartDisplay.classList.add('active');
                
                if (Math.abs(ecart) < 0.01) {
                    topEcartDisplay.classList.add('ecart-ok');
                    if (Math.abs(totauxCombines.ecart) < 0.01) {
                        topEcartExplanation.innerHTML = `Montant total à retirer (toutes caisses) : <strong>${formatEuros(totauxCombines.recette)}</strong>`;
                    } else {
                        topEcartExplanation.textContent = `La caisse est juste. Montant à retirer : ${formatEuros(recetteReelle)}`;
                    }
                } else if (ecart > 0) {
                    topEcartDisplay.classList.add('ecart-positif');
                    topEcartExplanation.textContent = "Il y a un surplus dans la caisse. Vérifiez vos saisies.";
                } else {
                    topEcartDisplay.classList.add('ecart-negatif');
                    topEcartExplanation.textContent = "Il manque de l'argent. Recomptez la caisse.";
                }
            }
        }
    }

    // On n'initialise le WebSocket et la sauvegarde auto que si on n'est pas en mode consultation
    if (!config.isLoadedFromHistory) {
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
                    for (const fieldId in data) {
                        const input = document.getElementById(fieldId);
                        if (input) {
                            input.value = data[fieldId];
                        }
                    }
                    calculateAllFull();
                    initialState = getFormStateAsString();
                } catch (error) {
                    console.error("Erreur de parsing JSON WebSocket:", error);
                }
            };
        } catch (e) {
            console.error("Impossible d'initialiser la connexion WebSocket:", e);
            if(statusIndicator) {
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Erreur de connexion';
            }
        }

        caisseForm.addEventListener('input', (event) => {
            calculateAllFull();
            clearTimeout(autosaveTimeout);
            if (autosaveStatus) {
                autosaveStatus.textContent = 'Modifications non enregistrées...';
                autosaveStatus.className = 'autosave-status';
            }
            autosaveTimeout = setTimeout(() => performAutosave(false), 2500);

            if (conn && conn.readyState === WebSocket.OPEN) {
                conn.send(JSON.stringify({ id: event.target.id, value: event.target.value }));
            }
        });

        window.addEventListener('beforeunload', () => {
            if (isSubmitting || !hasUnsavedChanges()) return;
            performAutosave(true);
        });

    } else {
        // Si on est en mode consultation, on met à jour l'indicateur et on désactive les champs
        if(statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Consultation';
        }
        if(autosaveStatus) {
            autosaveStatus.textContent = 'Sauvegarde auto désactivée';
        }
        // On désactive tous les champs de saisie
        caisseForm.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
        // On cache le bouton de sauvegarde
        const saveBtn = caisseForm.querySelector('.save-btn');
        if (saveBtn) saveBtn.style.display = 'none';
    }

    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            event.currentTarget.classList.add('active');
            document.getElementById(event.currentTarget.dataset.tab)?.classList.add('active');
            
            ecartDisplays.forEach(display => display.classList.remove('active'));
            document.getElementById(`ecart-display-${event.currentTarget.dataset.tab}`)?.classList.add('active');
        });
    });
    
    caisseForm.addEventListener('submit', () => {
        clearTimeout(autosaveTimeout);
        isSubmitting = true;
    });

    calculateAllFull();
    initialState = getFormStateAsString();
});
