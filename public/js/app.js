/**
 * Fichier principal JavaScript pour la page du calculateur de caisse.
 * Gère les calculs, les onglets, la synchro WebSocket et la sauvegarde intelligente.
 */
document.addEventListener('DOMContentLoaded', function() {

   // --- Logique pour la barre de navigation responsive (s'applique à toutes les pages) ---
    const navbarToggler = document.getElementById('navbar-toggler');
    const navbarCollapse = document.getElementById('navbar-collapse');

    if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener('click', function() {
            navbarCollapse.classList.toggle('show');
        });
    }

    const caisseForm = document.getElementById('caisse-form');
    if (!caisseForm) {
        return;
    }

    // --- Définitions et sélection des éléments du DOM ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const nomComptageInput = document.getElementById('nom_comptage');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    let isSubmitting = false;

    // --- Fonctions ---
    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    /**
     * CORRECTION MAJEURE : La fonction calcule maintenant pour chaque caisse
     * présente dans l'objet `nomsCaisses`, quels que soient leurs IDs.
     */
    const calculateAllFull = () => {
        let totauxCombines = { fdc: 0, total: 0, recette: 0, theorique: 0, ecart: 0 };
        let allCaissesReady = true;

        // Boucle sur les clés (IDs) de l'objet nomsCaisses (ex: "1", "3", "4")
        for (const i of Object.keys(nomsCaisses)) {
            const getVal = (id) => {
                const element = document.getElementById(id + '_' + i);
                // On vérifie si l'élément existe avant de lire sa valeur
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
        // Adaptez le port si nécessaire, mais cela devrait fonctionner avec la configuration du VHost
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
        // Sauvegarde seulement si des pièces/billets ont été saisis
        if (currentDenominationState !== '{}' && nomActuel === '') {
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
