/**
 * Module JavaScript pour la logique du calculateur de caisse.
 * Ce module gère les calculs, l'interface utilisateur et les sauvegardes.
 * Version mise à jour pour le nouveau schéma de la base de données.
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("[C-CORE] Le DOM est chargé.");
    const caisseForm = document.getElementById('caisse-form');
    if (!caisseForm) return;

    // --- Fonctions utilitaires ---
    const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    // --- Configuration et Éléments du DOM ---
    const configElement = document.getElementById('calculator-data');
    const config = configElement ? JSON.parse(configElement.dataset.config) : {};
    const loadedData = configElement ? JSON.parse(configElement.dataset.loadedData) : {};
    const minToKeep = config.minToKeep || {};

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const nomComptageInput = document.getElementById('nom_comptage');
    const isLoadedFromHistory = config.isLoadedFromHistory;

    // Éléments de l'interface
    const mainEcartDisplayContainer = document.querySelector('.ecart-display-container');

    let isSubmitting = false;
    let initialState = '';

    // --- Logique de l'interface (Accordéon, Onglets) ---
    function initAccordion() {
        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            header.removeEventListener('click', toggleAccordion);
            header.addEventListener('click', toggleAccordion);
        });
    }

    function toggleAccordion() {
        this.classList.toggle('active');
        this.nextElementSibling.classList.toggle('open');
    }
    
    // NOUVEAU : Fonction de chargement et d'initialisation des données
    window.loadAndInitFormData = function(data) {
        if (!data) return;
        
        console.log("[C-CORE] Chargement des données dans le formulaire...");
        
        // On réinitialise le formulaire pour éviter les doublons
        caisseForm.reset();
        
        for (const caisseId in data) {
            if (caisseId === 'nom_comptage' || caisseId === 'explication') {
                const input = document.getElementById(caisseId);
                if (input) input.value = data[caisseId];
            } else {
                const caisseData = data[caisseId];
                document.getElementById(`fond_de_caisse_${caisseId}`).value = caisseData.fond_de_caisse || '';
                document.getElementById(`ventes_${caisseId}`).value = caisseData.ventes || '';
                document.getElementById(`retrocession_${caisseId}`).value = caisseData.retrocession || '';
                
                for (const denom in caisseData.denominations) {
                    const input = document.getElementById(`${denom}_${caisseId}`);
                    if (input) input.value = caisseData.denominations[denom];
                }
            }
        }
        
        calculateAllFull();
        initialState = window.getFormStateAsString();
    };
    
    // Initialisation des écouteurs d'événements pour la page du calculateur
    function initCalculator() {
        tabLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                const activeCaisseId = event.currentTarget.dataset.tab.replace('caisse', '');
                const currentWsId = window.wsConnection?.resourceId;

                // NOUVEAU: Permet le changement d'onglet si la caisse n'est pas verrouillée par l'utilisateur actuel
                if (window.currentLockedCaisseId && window.currentLockerId === currentWsId) {
                    alert("Impossible de changer de caisse en mode clôture si la caisse active n'est pas celle verrouillée.");
                    return;
                }

                tabLinks.forEach(l => l.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                event.currentTarget.classList.add('active');
                const targetTab = document.getElementById(event.currentTarget.dataset.tab);
                if (targetTab) {
                    targetTab.classList.add('active');
                }
                ecartDisplays.forEach(display => display.classList.remove('active'));
                document.getElementById(`ecart-display-${event.currentTarget.dataset.tab}`)?.classList.add('active');
                calculateAllFull();
                // NOUVEAU: Réapplique les règles de verrouillage de l'interface
                if (window.handleInterfaceLock) {
                     const activeCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
                     const isLocked = window.lockedCaisses.some(c => c.caisse_id === activeCaisseId);
                     const lockedBy = isLocked ? window.lockedCaisses.find(c => c.caisse_id === activeCaisseId)?.locked_by : null;
                     window.handleInterfaceLock(window.lockedCaisses, window.closedCaisses);
                }
            });
        });

        // Écouteurs pour les champs du formulaire pour le calcul en temps réel
        if (!isLoadedFromHistory) {
            caisseForm.addEventListener('input', (event) => {
                calculateAllFull();
                if (window.sendWsMessage) {
                    window.sendWsMessage(event.target.id, event.target.value);
                }
            });
            window.addEventListener('beforeunload', () => {
                if (isSubmitting || !hasUnsavedChanges()) return;
                performAutosaveOnExit();
            });
        }
    
        caisseForm.addEventListener('submit', () => {
            isSubmitting = true;
            if (nomComptageInput && nomComptageInput.value.trim() === '') {
                nomComptageInput.value = `Comptage du ${formatDateTimeFr().replace(', ', ' à ')}`;
            }
        });

        // NOUVEAU: on ne charge plus la sauvegarde auto au démarrage
        // loadAndInitFormData(loadedData); 
        setTimeout(() => { initialState = getFormStateAsString(); }, 0);
        initAccordion();
        handleScroll();
    }
    
    // --- Fonctions de Calcul ---
    function generateWithdrawalSuggestion(amountToWithdraw, currentCounts, denominations) {
        let remainingAmount = amountToWithdraw;
        const suggestions = {};
        
        const allDenominations = [
            ...Object.entries(denominations.billets),
            ...Object.entries(denominations.pieces)
        ].sort((a, b) => b[1] - a[1]);

        for (const [name, value] of allDenominations) {
            if (remainingAmount <= 0) break;
            const countInCaisse = parseInt(currentCounts[name]) || 0;
            const toKeep = minToKeep[name] || 0;
            const availableToRemove = Math.max(0, countInCaisse - toKeep);
            const numToRemove = Math.min(
                Math.floor(remainingAmount / value),
                availableToRemove
            );
            if (numToRemove > 0) {
                suggestions[name] = numToRemove;
                remainingAmount -= numToRemove * value;
            }
        }
        return suggestions;
    }

    function calculateAllFull() {
        if (!config.nomsCaisses) return;

        const activeTab = document.querySelector('.tab-link.active')?.dataset.tab;
        let totauxCombines = { fdc: 0, total: 0, recette: 0, theorique: 0, ecart: 0 };
        const caissesData = {};
        const caissesAvecEcart = [];
        let combinedRecetteForZeroEcart = 0;

        const updateElementText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        for (const i of Object.keys(config.nomsCaisses)) {
            const getVal = (id) => parseFloat(document.getElementById(`${id}_${i}`)?.value.replace(',', '.') || 0) || 0;
            const getInt = (id) => parseInt(document.getElementById(`${id}_${i}`)?.value || 0) || 0;
            
            let totalCompte = 0;
            const currentCounts = {};

            // Calcul des billets et pièces
            for (const type in config.denominations) {
                for (const name in config.denominations[type]) {
                    const count = getInt(name);
                    const totalLigne = count * config.denominations[type][name];
                    updateElementText(`total_${name}_${i}`, formatEuros(totalLigne));
                    totalCompte += totalLigne;
                    currentCounts[name] = count;
                }
            }
            
            const fondDeCaisse = getVal('fond_de_caisse');
            const ventes = getVal('ventes');
            const retrocession = getVal('retrocession');
            const recetteTheorique = ventes + retrocession;
            const recetteReelle = totalCompte - fondDeCaisse;
            const ecart = recetteReelle - recetteTheorique;

            caissesData[i] = { ecart, recetteReelle, currentCounts };
            totauxCombines.fdc += fondDeCaisse;
            totauxCombines.total += totalCompte;
            totauxCombines.recette += recetteReelle;
            totauxCombines.theorique += recetteReelle; // CORRIGÉ: Utilisez la recette réelle pour le calcul de la clôture
            totauxCombines.ecart += ecart;
            
            if (Math.abs(ecart) < 0.01) {
                combinedRecetteForZeroEcart += recetteReelle;
            } else {
                caissesAvecEcart.push({ nom: config.nomsCaisses[i], ecart: ecart });
            }

            updateElementText(`res-c${i}-fdc`, formatEuros(fondDeCaisse));
            updateElementText(`res-c${i}-total`, formatEuros(totalCompte));
            updateElementText(`res-c${i}-theorique`, formatEuros(recetteTheorique));
            updateElementText(`res-c${i}-recette`, formatEuros(recetteReelle));
            
            const ecartEl = document.getElementById(`res-c${i}-ecart`);
            if (ecartEl) {
                ecartEl.textContent = formatEuros(ecart);
                ecartEl.parentElement.className = 'result-line total';
                if (ecart > 0.01) { // L'écart est-il positif ?
                    ecartEl.parentElement.classList.add('ecart-positif');
                } else if (ecart < -0.01) { // L'écart est-il négatif ?
                    ecartEl.parentElement.classList.add('ecart-negatif');
                }
            }
        }

        updateElementText('res-total-fdc', formatEuros(totauxCombines.fdc));
        updateElementText('res-total-total', formatEuros(totauxCombines.total));
        updateElementText('res-total-theorique', formatEuros(totauxCombines.theorique));
        updateElementText('res-total-recette', formatEuros(totauxCombines.recette));
        const ecartTotalEl = document.getElementById('res-total-ecart');
        if (ecartTotalEl) {
            ecartTotalEl.textContent = formatEuros(totauxCombines.ecart);
            ecartTotalEl.parentElement.className = 'result-line total';
            if (totauxCombines.ecart > 0.01) {
                ecartTotalEl.parentElement.classList.add('ecart-positif');
            } else if (totauxCombines.ecart < -0.01) {
                ecartTotalEl.parentElement.classList.add('ecart-negatif');
            }
        }

        for (const i of Object.keys(config.nomsCaisses)) {
            const topEcartDisplay = document.querySelector(`#ecart-display-caisse${i}`);
            const suggestionAccordionContainer = document.querySelector(`#suggestion-accordion-caisse${i}`);
            if (topEcartDisplay && suggestionAccordionContainer) {
                const topEcartDisplayValue = topEcartDisplay.querySelector('.ecart-value');
                const topEcartExplanation = topEcartDisplay.querySelector('.ecart-explanation');
                const { ecart, recetteReelle, currentCounts } = caissesData[i];
                if (topEcartDisplayValue) topEcartDisplayValue.textContent = formatEuros(ecart);
                const wasActive = topEcartDisplay.classList.contains('active');
                topEcartDisplay.className = 'ecart-display';
                if (wasActive) topEcartDisplay.classList.add('active');
                topEcartExplanation.innerHTML = '';
                suggestionAccordionContainer.innerHTML = '';
                
                if (Math.abs(ecart) < 0.01) {
                    topEcartDisplay.classList.add('ecart-ok');
                    let explanation = `<strong>Montant à retirer pour cette caisse :</strong> <strong>${formatEuros(recetteReelle)}</strong>.<br>`;
                    if (Object.keys(config.nomsCaisses).length > 1) {
                        explanation += `<br>Montant total à retirer (caisses justes) : <strong>${formatEuros(combinedRecetteForZeroEcart)}</strong>`;
                    }
                    topEcartExplanation.innerHTML = explanation;
                    if (`caisse${i}` === activeTab) {
                        const suggestions = generateWithdrawalSuggestion(recetteReelle, currentCounts, config.denominations);
                        let suggestionHtml = `<div class="accordion-card"><div class="accordion-header"><i class="fa-solid fa-sack-dollar"></i><h3>Suggestion de retrait</h3><i class="fa-solid fa-chevron-down accordion-toggle-icon"></i></div><div class="accordion-content"><div class="accordion-content-inner"><p style="text-align: center;">Pour clôturer la caisse, retirez le montant suivant :</p><h4><i class="fa-solid fa-money-bill"></i> Billets</h4><table class="withdrawal-table"><thead><tr><th>Dénomination</th><th>Quantité</th></tr></thead><tbody>`;
                        let hasSuggestions = false;
                        for (const [name, value] of Object.entries(config.denominations.billets).sort((a, b) => b[1] - a[1])) {
                            if (suggestions[name] && suggestions[name] > 0) {
                                hasSuggestions = true;
                                suggestionHtml += `<tr><td>${value} ${config.currencySymbol}</td><td>${suggestions[name]}</td></tr>`;
                            }
                        }
                        suggestionHtml += `</tbody></table><h4><i class="fa-solid fa-coins"></i> Pièces</h4><table class="withdrawal-table"><thead><tr><th>Dénomination</th><th>Quantité</th></tr></thead><tbody>`;
                        for (const [name, value] of Object.entries(config.denominations.pieces).sort((a, b) => b[1] - a[1])) {
                            if (suggestions[name] && suggestions[name] > 0) {
                                hasSuggestions = true;
                                const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
                                suggestionHtml += `<tr><td>${label}</td><td>${suggestions[name]}</li>`;
                            }
                        }
                        suggestionHtml += `</tbody></table></div></div></div>`;
                        if (hasSuggestions) {
                            suggestionAccordionContainer.innerHTML = suggestionHtml;
                            initAccordion();
                        }
                    }
                    if (caissesAvecEcart.length > 0) {
                        topEcartExplanation.innerHTML += `<br><strong>Caisse(s) avec écart :</strong> `;
                        topEcartExplanation.innerHTML += caissesAvecEcart.map(c => `${c.nom} (<span style="color: var(--color-danger);">${formatEuros(c.ecart)}</span>)`).join(', ');
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


    // Exposez la fonction de calcul pour qu'elle puisse être appelée par le module de temps réel
    window.calculateAllFull = calculateAllFull;
    
    // NOUVEAU : Écouteur d'événement de défilement pour la barre compacte
    let isCompact = false;
    function handleScroll() {
        const scrollPosition = window.scrollY;
        const offset = mainEcartDisplayContainer.offsetTop + mainEcartDisplayContainer.offsetHeight;

        if (scrollPosition > offset && !isCompact) {
            mainEcartDisplayContainer.classList.add('compact-sticky');
            isCompact = true;
        } else if (scrollPosition <= offset && isCompact) {
            mainEcartDisplayContainer.classList.remove('compact-sticky');
            isCompact = false;
        }
    }
    window.addEventListener('scroll', handleScroll);


    // --- Écouteurs d'événements ---
    // Les écouteurs d'événements de base sont réintégrés ici pour garantir leur exécution.
    if (!isLoadedFromHistory) {
        caisseForm.addEventListener('input', (event) => {
            calculateAllFull();
            if (window.sendWsMessage) {
                window.sendWsMessage(event.target.id, event.target.value);
            }
        });
        window.addEventListener('beforeunload', () => {
            if (isSubmitting || !hasUnsavedChanges()) return;
            performAutosaveOnExit();
        });
    }

    caisseForm.addEventListener('submit', () => {
        isSubmitting = true;
        if (nomComptageInput && nomComptageInput.value.trim() === '') {
            nomComptageInput.value = `Comptage du ${formatDateTimeFr().replace(', ', ' à ')}`;
        }
    });

    // NOUVEAU : Fonctions de gestion de la sauvegarde auto
    let autosaveTimeout;
    const autosaveStatusEl = document.getElementById('autosave-status');

    // NOUVEAU: Expose les fonctions de gestion de l'état du formulaire
    window.getFormStateAsString = function() {
        const formData = new FormData(caisseForm);
        const params = new URLSearchParams(formData);
        return params.toString();
    };

    window.hasUnsavedChanges = function() {
        const currentState = window.getFormStateAsString();
        return currentState !== initialState;
    };

    function startAutosaveTimer() {
        if (autosaveTimeout) clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(performAutosave, 30000); // 30 secondes
    }

    async function performAutosave() {
        // NOUVEAU: Ne lance la sauvegarde que si des modifications ont été apportées.
        if (!window.hasUnsavedChanges()) {
            if (autosaveStatusEl) {
                autosaveStatusEl.textContent = 'Aucune modification à sauvegarder.';
                autosaveStatusEl.classList.remove('saving', 'success', 'error');
                setTimeout(() => autosaveStatusEl.textContent = '', 5000);
            }
            startAutosaveTimer();
            return;
        }

        if (isSubmitting) {
            startAutosaveTimer();
            return;
        }

        if (autosaveStatusEl) {
            autosaveStatusEl.textContent = 'Sauvegarde auto en cours...';
            autosaveStatusEl.classList.add('saving');
        }

        const formData = new FormData(caisseForm);
        // Ajout de l'action 'autosave' pour le contrôleur PHP
        formData.append('action', 'autosave');
        
        try {
            const response = await fetch('index.php?action=autosave', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                initialState = window.getFormStateAsString(); // Met à jour l'état initial
                if (autosaveStatusEl) {
                    autosaveStatusEl.textContent = data.message;
                    autosaveStatusEl.classList.remove('saving');
                    autosaveStatusEl.classList.add('success');
                    setTimeout(() => autosaveStatusEl.textContent = '', 5000);
                }
            } else {
                if (autosaveStatusEl) {
                    autosaveStatusEl.textContent = data.message;
                    autosaveStatusEl.classList.remove('saving');
                    autosaveStatusEl.classList.add('error');
                }
            }
        } catch (error) {
            console.error('Erreur de sauvegarde automatique:', error);
            if (autosaveStatusEl) {
                autosaveStatusEl.textContent = 'Erreur de sauvegarde automatique.';
                autosaveStatusEl.classList.remove('saving');
                autosaveStatusEl.classList.add('error');
            }
        }
        startAutosaveTimer();
    }
    
    // Fonction de sauvegarde au moment de quitter la page
    function performAutosaveOnExit() {
        const formData = new FormData(caisseForm);
        formData.append('action', 'autosave');
        
        // Utilisation de navigator.sendBeacon pour les requêtes asynchrones en sortie de page
        navigator.sendBeacon('index.php?action=autosave', formData);
    }
    
    // NOUVEAU: Ajout d'un écouteur pour la saisie des montants pour le déclenchement de la sauvegarde
    caisseForm.addEventListener('input', (event) => {
        // Redémarre le compteur à chaque saisie
        clearTimeout(autosaveTimeout);
        startAutosaveTimer();
        
        // CORRECTION : Envoie également la donnée via WebSocket
        if (window.sendWsMessage) {
            window.sendWsMessage(event.target.id, event.target.value);
        }
    });
    
    // NOUVEAU: Expose la fonction pour charger les données par WebSocket
    window.loadFormDataFromWebSocket = function(data) {
        if (!data || Object.keys(data).length === 0) return;
        
        console.log("[C-CORE] Chargement des données du formulaire depuis le WebSocket:", data);
        
        // On réinitialise le formulaire pour éviter les doublons
        caisseForm.reset();

        // On met à jour les champs "nom_comptage" et "explication"
        const nomComptageInput = document.getElementById('nom_comptage');
        if (nomComptageInput) nomComptageInput.value = data['nom_comptage'] || '';
        const explicationInput = document.getElementById('explication');
        if (explicationInput) explicationInput.value = data['explication'] || '';

        // On met à jour les champs par caisse
        for (const key in data) {
            if (key.startsWith('caisse[')) {
                // Extrait l'ID de la caisse, la dénomination et le type de champ
                const parts = key.match(/caisse\[(\d+)\]\[(.+)\]/);
                if (parts) {
                    const caisseId = parts[1];
                    const fieldName = parts[2];
                    const input = document.querySelector(`input[name="caisse[${caisseId}][${fieldName}]"]`);
                    if (input) {
                        input.value = data[key];
                    }
                }
            }
        }
        
        calculateAllFull();
        initialState = window.getFormStateAsString(); // Met à jour l'état initial pour éviter la double sauvegarde
    };
    
    // NOUVEAU: Expose la fonction pour envoyer l'état complet du formulaire
    window.sendFullFormState = function() {
        const formState = {};
        const form = document.getElementById('caisse-form');
        new FormData(form).forEach((value, key) => {
            formState[key] = value;
        });
        window.wsConnection.send(JSON.stringify({ type: 'broadcast_state', form_state: formState }));
    };


    // --- Initialisation du calculateur ---
    initCalculator();
    if (!isLoadedFromHistory) {
        startAutosaveTimer();
    }
});
