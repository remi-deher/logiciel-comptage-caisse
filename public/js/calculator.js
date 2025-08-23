/**
 * Module JavaScript pour la logique de la page du calculateur.
 * Ce script gère les calculs en temps réel, les onglets, les accordéons,
 * la sauvegarde intelligente en quittant la page et l'interaction avec le formulaire principal.
 */
document.addEventListener('DOMContentLoaded', function() {
    const calculatorDataElement = document.getElementById('calculator-data');
    if (!calculatorDataElement) return;

    // --- Configuration et état global ---
    const config = JSON.parse(calculatorDataElement.dataset.config || '{}');
    const loadedData = JSON.parse(calculatorDataElement.dataset.loadedData || '{}');
    const { nomsCaisses, denominations, minToKeep, isLoadedFromHistory, currencySymbol } = config;
    
    // NOUVEAU : Variable pour suivre les modifications non enregistrées
    let hasUnsavedChanges = false;

    // --- Fonctions utilitaires ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    /**
     * Calcule tous les totaux pour toutes les caisses et met à jour l'affichage.
     */
    window.calculateAllFull = function() {
        let totalGlobalCompte = 0;
        let totalGlobalRecetteReelle = 0;
        let totalGlobalRecetteTheorique = 0;
        let totalGlobalEcart = 0;
        let totalGlobalFdc = 0;

        for (const caisseId in nomsCaisses) {
            let totalCaisseCompte = 0;
            const currentCounts = {};

            // Calcule le total compté pour la caisse
            for (const type in denominations) {
                for (const name in denominations[type]) {
                    const input = document.getElementById(`${name}_${caisseId}`);
                    const quantite = parseInt(input.value, 10) || 0;
                    const valeur = parseFloat(denominations[type][name]);
                    const totalLigne = quantite * valeur;
                    totalCaisseCompte += totalLigne;
                    currentCounts[name] = quantite;

                    const totalLigneElement = document.getElementById(`total_${name}_${caisseId}`);
                    if (totalLigneElement) {
                        totalLigneElement.textContent = formatCurrency(totalLigne);
                    }
                }
            }

            // Récupère les autres valeurs
            const fondDeCaisse = parseFloat(document.getElementById(`fond_de_caisse_${caisseId}`).value.replace(',', '.')) || 0;
            const ventes = parseFloat(document.getElementById(`ventes_${caisseId}`).value.replace(',', '.')) || 0;
            const retrocession = parseFloat(document.getElementById(`retrocession_${caisseId}`).value.replace(',', '.')) || 0;

            // Calcule les résultats
            const recetteTheorique = ventes + retrocession;
            const recetteReelle = totalCaisseCompte - fondDeCaisse;
            const ecart = recetteReelle - recetteTheorique;

            // Met à jour les totaux globaux
            totalGlobalCompte += totalCaisseCompte;
            totalGlobalRecetteReelle += recetteReelle;
            totalGlobalRecetteTheorique += recetteTheorique;
            totalGlobalEcart += ecart;
            totalGlobalFdc += fondDeCaisse;

            // Met à jour l'affichage des résultats de la caisse
            updateResultsDisplay(caisseId, { fondDeCaisse, totalCaisseCompte, recetteTheorique, recetteReelle, ecart });
            updateEcartDisplay(caisseId, ecart);
        }

        // Met à jour l'affichage des résultats combinés
        updateCombinedResultsDisplay({ totalGlobalFdc, totalGlobalCompte, totalGlobalRecetteTheorique, totalGlobalRecetteReelle, totalGlobalEcart });
    };

    /**
     * Met à jour la section des résultats pour une caisse spécifique.
     */
    function updateResultsDisplay(caisseId, results) {
        document.getElementById(`res-c${caisseId}-fdc`).textContent = formatCurrency(results.fondDeCaisse);
        document.getElementById(`res-c${caisseId}-total`).textContent = formatCurrency(results.totalCaisseCompte);
        document.getElementById(`res-c${caisseId}-theorique`).textContent = formatCurrency(results.recetteTheorique);
        document.getElementById(`res-c${caisseId}-recette`).textContent = formatCurrency(results.recetteReelle);
        const ecartElement = document.getElementById(`res-c${caisseId}-ecart`);
        ecartElement.textContent = formatCurrency(results.ecart);
        ecartElement.className = results.ecart > 0.01 ? 'ecart-positif' : (results.ecart < -0.01 ? 'ecart-negatif' : '');
    }

    /**
     * Met à jour la section des résultats combinés.
     */
    function updateCombinedResultsDisplay(totals) {
        document.getElementById('res-total-fdc').textContent = formatCurrency(totals.totalGlobalFdc);
        document.getElementById('res-total-total').textContent = formatCurrency(totals.totalGlobalCompte);
        document.getElementById('res-total-theorique').textContent = formatCurrency(totals.totalGlobalRecetteTheorique);
        document.getElementById('res-total-recette').textContent = formatCurrency(totals.totalGlobalRecetteReelle);
        const ecartElement = document.getElementById('res-total-ecart');
        ecartElement.textContent = formatCurrency(totals.totalGlobalEcart);
        ecartElement.className = totals.totalGlobalEcart > 0.01 ? 'ecart-positif' : (totals.totalGlobalEcart < -0.01 ? 'ecart-negatif' : '');
    }

    /**
     * Met à jour l'indicateur d'écart principal pour une caisse.
     */
    function updateEcartDisplay(caisseId, ecart) {
        const display = document.getElementById(`ecart-display-caisse${caisseId}`);
        if (!display) return;
        const valueSpan = display.querySelector('.ecart-value');
        const explanationP = display.querySelector('.ecart-explanation');

        valueSpan.textContent = formatCurrency(ecart);
        display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');

        if (Math.abs(ecart) < 0.01) {
            display.classList.add('ecart-ok');
            explanationP.textContent = "L'écart est nul. La caisse est juste.";
        } else if (ecart > 0) {
            display.classList.add('ecart-positif');
            explanationP.textContent = "Il y a un surplus dans la caisse.";
        } else {
            display.classList.add('ecart-negatif');
            explanationP.textContent = "Il manque de l'argent dans la caisse.";
        }
    }

    /**
     * Met en place tous les écouteurs d'événements pour la page.
     */
    function setupEventListeners() {
        const form = document.getElementById('caisse-form');

        // Onglets
        document.querySelector('.tab-selector').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                const tabId = e.target.dataset.tab;
                document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.querySelectorAll('.ecart-display').forEach(display => display.classList.remove('active'));

                e.target.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                document.getElementById(`ecart-display-${tabId}`).classList.add('active');
            }
        });

        // Accordéons
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.accordion-header');
            if (header) {
                if (e.target.closest('button')) return;
                header.classList.toggle('active');
                const content = header.nextElementSibling;
                content.classList.toggle('open');
            }
        });

        // Champs de saisie
        form.addEventListener('input', (e) => {
            if (e.target.matches('input[type="number"], input[type="text"], textarea')) {
                hasUnsavedChanges = true; // NOUVEAU : Marque qu'il y a des modifications
                calculateAllFull();
                if (!isLoadedFromHistory && window.sendWsMessage) {
                    window.sendWsMessage(e.target.id, e.target.value);
                }
            }
        });

        // NOUVEAU : Réinitialise le suivi des modifications lors d'une sauvegarde manuelle
        form.addEventListener('submit', () => {
            hasUnsavedChanges = false;
        });
    }

    /**
     * Charge les données (depuis l'historique ou la sauvegarde) dans le formulaire.
     */
    window.loadAndInitFormData = function(data) {
        if (!data) return;

        document.getElementById('nom_comptage').value = data.nom_comptage || '';
        document.getElementById('explication').value = data.explication || '';

        for (const caisseId in data) {
            if (!nomsCaisses.hasOwnProperty(caisseId)) continue;
            
            const caisseData = data[caisseId];
            document.getElementById(`fond_de_caisse_${caisseId}`).value = caisseData.fond_de_caisse || '';
            document.getElementById(`ventes_${caisseId}`).value = caisseData.ventes || '';
            document.getElementById(`retrocession_${caisseId}`).value = caisseData.retrocession || '';
            
            if (caisseData.denominations) {
                for (const name in caisseData.denominations) {
                    const input = document.getElementById(`${name}_${caisseId}`);
                    if (input) {
                        input.value = caisseData.denominations[name];
                    }
                }
            }
        }
        calculateAllFull();
    };

    /**
     * Met à jour le formulaire avec les données reçues via WebSocket.
     */
    window.loadFormDataFromWebSocket = function(formState) {
        for (const id in formState) {
            const input = document.getElementById(id);
            if (input && input.value !== formState[id]) {
                input.value = formState[id];
            }
        }
        calculateAllFull();
    };
    
    /**
     * Envoie l'état complet du formulaire via WebSocket.
     */
    window.sendFullFormState = function() {
        if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
            const formState = {};
            document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
                if (el.id) {
                    formState[el.id] = el.value;
                }
            });
            window.wsConnection.send(JSON.stringify({ type: 'broadcast_state', form_state: formState }));
        }
    };

    /**
     * NOUVEAU : Gère la sauvegarde de sécurité lorsque l'utilisateur quitte la page.
     */
    function initUnloadAutosave() {
        if (isLoadedFromHistory) return;

        window.addEventListener('beforeunload', (event) => {
            if (hasUnsavedChanges) {
                // Utilise navigator.sendBeacon pour une sauvegarde fiable en arrière-plan
                const formData = new FormData(document.getElementById('caisse-form'));
                navigator.sendBeacon('index.php?action=autosave', formData);
            }
        });
    }

    // --- Initialisation de la page ---
    setupEventListeners();
    if (Object.keys(loadedData).length > 0) {
        loadAndInitFormData(loadedData);
    } else {
        calculateAllFull();
    }
    // NOUVEAU : Appelle la nouvelle fonction de sauvegarde à la fermeture
    initUnloadAutosave();
});
