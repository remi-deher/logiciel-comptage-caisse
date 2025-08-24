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

    const parseLocaleFloat = (str) => {
        if (typeof str !== 'string') return 0;
        return parseFloat(str.replace(',', '.')) || 0;
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
    
    // MISE À JOUR : La fonction gère maintenant les messages d'aide
    function calculateCBTotals(caisseId) {
        let totalConstate = 0;
        document.querySelectorAll(`.cb-input[data-caisse-id="${caisseId}"]`).forEach(input => {
            totalConstate += parseLocaleFloat(input.value);
        });

        const attenduInput = document.getElementById(`cb_attendu_${caisseId}`);
        const totalAttendu = parseLocaleFloat(attenduInput.value);
        const ecart = totalConstate - totalAttendu;

        document.getElementById(`cb_constate_${caisseId}`).value = formatCurrency(totalConstate);
        
        const ecartInput = document.getElementById(`cb_ecart_${caisseId}`);
        ecartInput.value = formatCurrency(ecart);
        
        const messageSpan = document.getElementById(`cb_ecart_message_${caisseId}`);
        
        ecartInput.classList.remove('ecart-ok', 'ecart-positif-alt', 'ecart-negatif');
        messageSpan.classList.remove('ecart-ok', 'ecart-positif-alt', 'ecart-negatif');
        
        if (Math.abs(ecart) < 0.01) {
            ecartInput.classList.add('ecart-ok');
            messageSpan.classList.add('ecart-ok');
            messageSpan.textContent = "La valeur attendue correspond.";
        } else if (ecart > 0) {
            ecartInput.classList.add('ecart-positif-alt');
            messageSpan.classList.add('ecart-positif-alt');
            messageSpan.textContent = "Il y a trop d'argent dans les TPE, vérifier s'il ne vous manque pas des encaissements.";
        } else {
            ecartInput.classList.add('ecart-negatif');
            messageSpan.classList.add('ecart-negatif');
            messageSpan.textContent = "Il manque de l'argent dans le TPE, vérifier si vous n'avez pas des encaissements en trop.";
        }
    }


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

            const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${caisseId}`).value);
            const ventes = parseLocaleFloat(document.getElementById(`ventes_${caisseId}`).value);
            const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${caisseId}`).value);

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
            calculateCBTotals(caisseId);
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
        
        // AJOUT : Écouteur pour l'ajout/suppression de chèques
        document.body.addEventListener('click', function(event) {
            const addButton = event.target.closest('.add-cheque-btn');
            const removeButton = event.target.closest('.remove-cheque-btn');

            if (addButton || removeButton) {
                hasUnsavedChanges = true;
                // Après une modification de la structure, on envoie l'état complet du formulaire
                if (!isLoadedFromHistory && typeof window.sendFullFormState === 'function') {
                    // On attend que le DOM se mette à jour avant d'envoyer
                    setTimeout(window.sendFullFormState, 100);
                }
            }
        });
        
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
        // Gérer les champs fixes (tout sauf les chèques)
        for (const id in formState) {
            const input = document.getElementById(id);
            // On s'assure de ne pas traiter les chèques ici
            if (input && !input.name.includes('[cheques]')) {
                 if (input.value !== formState[id]) {
                    input.value = formState[id];
                }
            }
        }
        
        // Gérer les champs de chèques dynamiques
        for (const caisseId in config.nomsCaisses) {
            const chequesContainer = document.querySelector(`#cheques-container-${caisseId} .cheques-grid`);
            if (!chequesContainer) continue;

            const chequeValuesInState = [];
            for (const id in formState) {
                const el = document.getElementById(id);
                if (el && el.name === `caisse[${caisseId}][cheques][]`) {
                    chequeValuesInState.push(formState[id]);
                }
            }

            chequesContainer.innerHTML = ''; // Vider les champs existants
            
            // Reconstruire les champs
            const valuesToRender = chequeValuesInState.length > 0 ? chequeValuesInState : ['']; // Toujours afficher au moins un champ
            valuesToRender.forEach((value, index) => {
                 const isFirst = index === 0;
                const newChequeHtml = `
                    <div class="form-group cheque-item">
                        <label>Chèque N°${index + 1} (${config.currencySymbol})</label>
                         <div style="display: flex; gap: 5px;">
                            <input type="text" id="cheque_${caisseId}_${index}" name="caisse[${caisseId}][cheques][]" placeholder="0,00" value="${value || ''}">
                            ${!isFirst ? '<button type="button" class="action-btn-small delete-btn remove-cheque-btn"><i class="fa-solid fa-trash-can"></i></button>' : ''}
                        </div>
                    </div>`;
                chequesContainer.insertAdjacentHTML('beforeend', newChequeHtml);
            });
        }

        calculateAllFull();
    };

    // MISE À JOUR : La fonction génère un ID unique pour chaque champ, y compris les chèques
    window.sendFullFormState = function() {
        if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
            const formState = {};
            document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach((el, index) => {
                // Assurer un ID unique pour chaque champ, surtout les chèques
                if (!el.id) {
                    const name = el.name.replace(/\[|\]/g, '_');
                    el.id = `${name}_${index}`;
                }
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
