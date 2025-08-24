/**
 * Module JavaScript pour la logique de la page du calculateur.
 * Ce script gère les calculs en temps réel, les onglets, les accordéons,
 * la sauvegarde et la reprise de comptage.
 */
document.addEventListener('DOMContentLoaded', function() {
    const calculatorDataElement = document.getElementById('calculator-data');
    if (!calculatorDataElement) {
        console.error("Élément #calculator-data introuvable. Le script ne peut pas continuer.");
        return;
    }

    // --- Configuration et état global ---
    const config = JSON.parse(calculatorDataElement.dataset.config || '{}');
    const loadedData = JSON.parse(calculatorDataElement.dataset.loadedData || '{}');
    const { nomsCaisses, denominations, isLoadedFromHistory } = config;
    const comptageId = calculatorDataElement.dataset.comptageId;

    let hasUnsavedChanges = false;
    const synthesisModal = document.getElementById('synthesis-modal');

    // --- Fonctions utilitaires ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const handleStickyEcart = () => {
        const ecartContainer = document.querySelector('.ecart-display-container');
        if (!ecartContainer) return;
        const offset = 100;
        if (window.scrollY > offset) {
            ecartContainer.classList.add('compact-sticky');
        } else {
            ecartContainer.classList.remove('compact-sticky');
        }
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

            if (denominations) {
                for (const type in denominations) {
                    for (const name in denominations[type]) {
                        const input = document.getElementById(`${name}_${caisseId}`);
                        const quantite = input ? (parseInt(input.value, 10) || 0) : 0;
                        const valeur = parseFloat(denominations[type][name]);
                        const totalLigne = quantite * valeur;
                        totalCaisseCompte += totalLigne;

                        const totalLigneElement = document.getElementById(`total_${name}_${caisseId}`);
                        if (totalLigneElement) {
                            totalLigneElement.textContent = formatCurrency(totalLigne);
                        }
                    }
                }
            }

            const fondDeCaisse = parseFloat(document.getElementById(`fond_de_caisse_${caisseId}`).value.replace(',', '.')) || 0;
            const ventes = parseFloat(document.getElementById(`ventes_${caisseId}`).value.replace(',', '.')) || 0;
            const retrocession = parseFloat(document.getElementById(`retrocession_${caisseId}`).value.replace(',', '.')) || 0;

            const recetteTheorique = ventes + retrocession;
            const recetteReelle = totalCaisseCompte - fondDeCaisse;
            const ecart = recetteReelle - recetteTheorique;

            totalGlobalCompte += totalCaisseCompte;
            totalGlobalRecetteReelle += recetteReelle;
            totalGlobalRecetteTheorique += recetteTheorique;
            totalGlobalEcart += ecart;
            totalGlobalFdc += fondDeCaisse;

            updateResultsDisplay(caisseId, { fondDeCaisse, totalCaisseCompte, recetteTheorique, recetteReelle, ecart });
            updateEcartDisplay(caisseId, ecart);
        }

        updateCombinedResultsDisplay({ totalGlobalFdc, totalGlobalCompte, totalGlobalRecetteTheorique, totalGlobalRecetteReelle, totalGlobalEcart });
    };

    function updateResultsDisplay(caisseId, results) {
        const fdcElement = document.getElementById(`res-c${caisseId}-fdc`);
        if (fdcElement) fdcElement.textContent = formatCurrency(results.fondDeCaisse);
        const totalElement = document.getElementById(`res-c${caisseId}-total`);
        if (totalElement) totalElement.textContent = formatCurrency(results.totalCaisseCompte);
        const theoriqueElement = document.getElementById(`res-c${caisseId}-theorique`);
        if (theoriqueElement) theoriqueElement.textContent = formatCurrency(results.recetteTheorique);
        const recetteElement = document.getElementById(`res-c${caisseId}-recette`);
        if (recetteElement) recetteElement.textContent = formatCurrency(results.recetteReelle);
        const ecartElement = document.getElementById(`res-c${caisseId}-ecart`);
        if (ecartElement) {
            ecartElement.textContent = formatCurrency(results.ecart);
            ecartElement.className = results.ecart > 0.01 ? 'ecart-positif' : (results.ecart < -0.01 ? 'ecart-negatif' : '');
        }
    }

    function updateCombinedResultsDisplay(totals) {
        const totalFdcElement = document.getElementById('res-total-fdc');
        if (totalFdcElement) totalFdcElement.textContent = formatCurrency(totals.totalGlobalFdc);
        const totalTotalElement = document.getElementById('res-total-total');
        if (totalTotalElement) totalTotalElement.textContent = formatCurrency(totals.totalGlobalCompte);
        const totalTheoriqueElement = document.getElementById('res-total-theorique');
        if (totalTheoriqueElement) totalTheoriqueElement.textContent = formatCurrency(totals.totalGlobalRecetteTheorique);
        const totalRecetteElement = document.getElementById('res-total-recette');
        if (totalRecetteElement) totalRecetteElement.textContent = formatCurrency(totals.totalGlobalRecetteReelle);
        const totalEcartElement = document.getElementById('res-total-ecart');
        if (totalEcartElement) {
            totalEcartElement.textContent = formatCurrency(totals.totalGlobalEcart);
            totalEcartElement.className = totals.totalGlobalEcart > 0.01 ? 'ecart-positif' : (totals.totalGlobalEcart < -0.01 ? 'ecart-negatif' : '');
        }
    }

    function updateEcartDisplay(caisseId, ecart) {
        const display = document.getElementById(`ecart-display-caisse${caisseId}`);
        if (!display) return;
        const valueSpan = display.querySelector('.ecart-value');
        const explanationP = display.querySelector('.ecart-explanation');
        if(valueSpan) valueSpan.textContent = formatCurrency(ecart);
        display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
        if (Math.abs(ecart) < 0.01) {
            display.classList.add('ecart-ok');
            if(explanationP) explanationP.textContent = "L'écart est nul. La caisse est juste.";
        } else if (ecart > 0) {
            display.classList.add('ecart-positif');
            if(explanationP) explanationP.textContent = "Il y a un surplus dans la caisse.";
        } else {
            display.classList.add('ecart-negatif');
            if(explanationP) explanationP.textContent = "Il manque de l'argent dans la caisse.";
        }
    }

    function setupEventListeners() {
        const form = document.getElementById('caisse-form');
        window.addEventListener('scroll', handleStickyEcart);
        handleStickyEcart();

        // Écouteur pour les onglets de CAISSE
        document.querySelector('.tab-selector').addEventListener('click', (e) => {
            const button = e.target.closest('.tab-link');
            if (button) {
                const tabId = button.dataset.tab;
                document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.caisse-tab-content').forEach(content => content.classList.remove('active'));
                document.querySelectorAll('.ecart-display').forEach(display => display.classList.remove('active'));

                button.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                document.getElementById(`ecart-display-${tabId}`).classList.add('active');
            }
        });

        // Écouteur pour les onglets de MODE DE PAIEMENT
        document.querySelectorAll('.payment-method-selector').forEach(selector => {
            selector.addEventListener('click', (e) => {
                const button = e.target.closest('.payment-tab-link');
                if (button) {
                    const tabId = button.dataset.paymentTab;
                    const parentContainer = button.closest('.payment-method-tabs');
                    parentContainer.querySelectorAll('.payment-tab-link').forEach(tab => tab.classList.remove('active'));
                    parentContainer.querySelectorAll('.payment-tab-content').forEach(content => content.classList.remove('active'));

                    button.classList.add('active');
                    document.getElementById(tabId).classList.add('active');
                }
            });
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
                hasUnsavedChanges = true;
                calculateAllFull();
                if (!isLoadedFromHistory && window.sendWsMessage) {
                    window.sendWsMessage(e.target.id, e.target.value);
                }
            }
        });
        
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                e.preventDefault();
                const formElements = Array.from(form.querySelectorAll('input, textarea, button, a[href]'));
                const index = formElements.indexOf(e.target);
                if (index > -1) {
                    let nextElement = formElements[index + 1];
                    while (nextElement && (nextElement.disabled || nextElement.readOnly || nextElement.offsetParent === null)) {
                        index++;
                        nextElement = formElements[index + 1];
                    }
                    if (nextElement) {
                        nextElement.focus();
                    } else {
                        formElements[0].focus();
                    }
                }
            }
        });

        form.addEventListener('submit', () => {
            hasUnsavedChanges = false;
        });

        const openSynthesisBtn = document.querySelectorAll('.open-synthesis-modal-btn');
        if (openSynthesisBtn) {
            openSynthesisBtn.forEach(btn => {
                btn.addEventListener('click', () => {
                    calculateAllFull();
                    if(synthesisModal) synthesisModal.classList.add('visible');
                });
            });
        }
        
        if (synthesisModal) {
            synthesisModal.addEventListener('click', (event) => {
                if (event.target === synthesisModal) {
                    synthesisModal.classList.remove('visible');
                }
            });
        }
        
        const resumeChoiceModal = document.getElementById('resume-choice-modal');
        const resumeConfirmModal = document.getElementById('resume-confirm-modal');
        const resumeCountingBtn = document.getElementById('resume-counting-btn');
        const loadFromHistoryBtn = document.getElementById('load-from-history-btn');
        const confirmResumeBtn = document.getElementById('confirm-resume-btn');
        const cancelResumeBtn = document.getElementById('cancel-resume-btn');

        if (resumeCountingBtn) {
            resumeCountingBtn.addEventListener('click', () => {
                if(resumeChoiceModal) resumeChoiceModal.classList.add('visible');
            });
        }

        if (loadFromHistoryBtn) {
            loadFromHistoryBtn.addEventListener('click', () => {
                if(resumeChoiceModal) resumeChoiceModal.classList.remove('visible');
                if(resumeConfirmModal) resumeConfirmModal.classList.add('visible');
            });
        }
        
        if (confirmResumeBtn && comptageId) {
            confirmResumeBtn.href = `index.php?page=calculateur&resume_from=${comptageId}`;
        }

        if(cancelResumeBtn) {
            cancelResumeBtn.addEventListener('click', () => {
                if(resumeConfirmModal) resumeConfirmModal.classList.remove('visible');
            });
        }
    }
    
    function resetAllFormFields() {
        const form = document.getElementById('caisse-form');
        if(form) form.reset();
        document.querySelectorAll('.total-line').forEach(el => el.textContent = formatCurrency(0));
    }

    window.loadAndInitFormData = function(data) {
        if (!data) return;
        
        resetAllFormFields();

        document.getElementById('nom_comptage').value = data.nom_comptage || '';
        document.getElementById('explication').value = data.explication || '';

        for (const caisseId in nomsCaisses) {
             const caisseData = data[caisseId] || {};
            document.getElementById(`fond_de_caisse_${caisseId}`).value = caisseData.fond_de_caisse || '';
            document.getElementById(`ventes_${caisseId}`).value = caisseData.ventes || '';
            document.getElementById(`retrocession_${caisseId}`).value = caisseData.retrocession || '';

            if (caisseData.denominations) {
                for (const name in denominations.billets) {
                    const input = document.getElementById(`${name}_${caisseId}`);
                    if (input) input.value = caisseData.denominations[name] || '';
                }
                for (const name in denominations.pieces) {
                     const input = document.getElementById(`${name}_${caisseId}`);
                    if (input) input.value = caisseData.denominations[name] || '';
                }
            }
        }
        calculateAllFull();
    };

    window.loadFormDataFromWebSocket = function(formState) {
        for (const id in formState) {
            const input = document.getElementById(id);
            if (input && input.value !== formState[id]) {
                input.value = formState[id];
            }
        }
        calculateAllFull();
    };

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

    function initUnloadAutosave() {
        if (isLoadedFromHistory) return;

        window.addEventListener('beforeunload', (event) => {
            if (hasUnsavedChanges) {
                const formData = new FormData(document.getElementById('caisse-form'));
                navigator.sendBeacon('index.php?action=autosave', formData);
            }
        });
    }

    setupEventListeners();
    if (Object.keys(loadedData).length > 0) {
        loadAndInitFormData(loadedData);
    } else {
        calculateAllFull();
    }
    initUnloadAutosave();
});
