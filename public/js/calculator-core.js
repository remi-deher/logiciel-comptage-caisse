/**
 * Module JavaScript pour la logique du calculateur de caisse.
 * Ce module gère les calculs, l'interface utilisateur et les sauvegardes.
 */
document.addEventListener('DOMContentLoaded', function() {
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
    const minToKeep = config.minToKeep || {}; 

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const ecartDisplays = document.querySelectorAll('.ecart-display');
    const nomComptageInput = document.getElementById('nom_comptage');
    const isLoadedFromHistory = config.isLoadedFromHistory;

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

    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
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
        });
    });

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
            let totalCompte = 0;
            const currentCounts = {};
            for (const type in config.denominations) {
                for (const name in config.denominations[type]) {
                    const count = getVal(name);
                    const totalLigne = count * config.denominations[type][name];
                    updateElementText(`total_${name}_${i}`, formatEuros(totalLigne));
                    totalCompte += totalLigne;
                    currentCounts[name] = count;
                }
            }
            
            const fondDeCaisse = getVal('fond_de_caisse');
            const ventes = getVal('ventes');
            const retrocession = getVal('retrocession');
            const recetteTheorique = ventes;
            const recetteReelle = totalCompte - fondDeCaisse - retrocession;
            const ecart = recetteReelle - recetteTheorique;
            
            caissesData[i] = { ecart, recetteReelle, currentCounts };
            totauxCombines.fdc += fondDeCaisse;
            totauxCombines.total += totalCompte;
            totauxCombines.recette += recetteReelle;
            totauxCombines.theorique += recetteReelle;
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
                if (ecart > 0.001) ecartEl.parentElement.classList.add('ecart-positif');
                if (ecart < -0.001) ecartEl.parentElement.classList.add('ecart-negatif');
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
            if (totauxCombines.ecart > 0.001) ecartTotalEl.parentElement.classList.add('ecart-positif');
            if (totauxCombines.ecart < -0.001) ecartTotalEl.parentElement.classList.add('ecart-negatif');
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
                                suggestionHtml += `<tr><td>${value} €</td><td>${suggestions[name]}</td></tr>`;
                            }
                        }
                        suggestionHtml += `</tbody></table><h4><i class="fa-solid fa-coins"></i> Pièces</h4><table class="withdrawal-table"><thead><tr><th>Dénomination</th><th>Quantité</th></tr></thead><tbody>`;
                        for (const [name, value] of Object.entries(config.denominations.pieces).sort((a, b) => b[1] - a[1])) {
                            if (suggestions[name] && suggestions[name] > 0) {
                                hasSuggestions = true;
                                const label = value >= 1 ? `${value} €` : `${value * 100} cts`;
                                suggestionHtml += `<tr><td>${label}</td><td>${suggestions[name]}</td></tr>`;
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

    // --- Logique de Sauvegarde ---
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
    
    function performAutosaveOnExit() {
        const formData = new FormData(caisseForm);
        let nom = formData.get('nom_comptage');
        if (!nom || nom.startsWith('Sauvegarde auto')) {
            nom = `Sauvegarde auto du ${formatDateTimeFr().replace(', ', ' à ')}`;
            formData.set('nom_comptage', nom);
        }
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon('index.php?action=autosave', new URLSearchParams(formData));
        }
    }

    // Exposez la fonction de calcul pour qu'elle puisse être appelée par le module de temps réel
    window.calculateAllFull = calculateAllFull;

    // --- Écouteurs d'événements ---
    if (!isLoadedFromHistory) {
        caisseForm.addEventListener('input', (event) => {
            calculateAllFull();
            window.sendWsMessage(event.target.id, event.target.value);
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

    // --- Initialisation ---
    calculateAllFull();
    initialState = getFormStateAsString();
    initAccordion();
});
