/**
 * Module JavaScript pour la logique de la page du calculateur.
 * Ce script gère les calculs en temps réel, les onglets, les accordéons,
 * et la sauvegarde du comptage.
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
    const form = document.getElementById('caisse-form');

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
    
    // MODIFIÉ : Calcule le total pour chaque terminal individuellement, puis le total pour la caisse
    function calculateCBTotals(caisseId) {
        let totalCaisseConstate = 0;

        document.querySelectorAll(`#caisse${caisseId} .tpe-card`).forEach(card => {
            const terminalId = card.id.split('-').pop();
            let totalTerminal = 0;
            card.querySelectorAll(`.cb-input[data-terminal-id="${terminalId}"]`).forEach(input => {
                totalTerminal += parseLocaleFloat(input.value);
            });
            
            const totalTerminalElement = card.querySelector(`#tpe-total-${terminalId}`);
            if (totalTerminalElement) {
                totalTerminalElement.textContent = formatCurrency(totalTerminal);
            }
            totalCaisseConstate += totalTerminal;
        });

        const attenduInput = document.getElementById(`cb_attendu_${caisseId}`);
        const totalAttendu = parseLocaleFloat(attenduInput.value);
        const ecart = totalCaisseConstate - totalAttendu;

        document.getElementById(`cb_constate_${caisseId}`).value = formatCurrency(totalCaisseConstate);
        
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

            updateEcartDisplay(caisseId, ecart);
            calculateCBTotals(caisseId);
        }
    };

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
        window.addEventListener('scroll', handleStickyEcart);
        handleStickyEcart();

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

        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.accordion-header');
            if (header) {
                if (e.target.closest('button')) return;
                header.classList.toggle('active');
                const content = header.nextElementSibling;
                content.classList.toggle('open');
            }

            // NOUVEAU : Gère l'ajout et la suppression de relevés CB
            const addBtn = e.target.closest('.btn-add-tpe');
            if (addBtn) {
                const caisseId = addBtn.dataset.caisseId;
                const terminalId = addBtn.dataset.terminalId;
                const container = document.getElementById(`tpe-releves-container-${terminalId}`);
                const releveCount = container.querySelectorAll('.form-group-tpe').length + 1;
                const newReleveHtml = `
                    <div class="form-group-tpe">
                        <label>Relevé #${releveCount}</label>
                        <input type="text" name="caisse[${caisseId}][cb][${terminalId}][]" class="cb-input" data-terminal-id="${terminalId}" placeholder="0,00">
                        <button type="button" class="btn-remove-tpe" title="Supprimer ce relevé"><i class="fa-solid fa-trash-can"></i></button>
                    </div>`;
                container.insertAdjacentHTML('beforeend', newReleveHtml);
            }

            const removeBtn = e.target.closest('.btn-remove-tpe');
            if (removeBtn) {
                const groupToRemove = removeBtn.closest('.form-group-tpe');
                const container = groupToRemove.parentElement;
                if (container.querySelectorAll('.form-group-tpe').length > 1) {
                    groupToRemove.remove();
                } else {
                    // S'il ne reste qu'un champ, on le vide
                    groupToRemove.querySelector('input').value = '';
                }
                // Recalculer les totaux après suppression
                calculateAllFull();
                // Renuméroter les labels
                container.querySelectorAll('label').forEach((label, index) => {
                    label.textContent = `Relevé #${index + 1}`;
                });
            }
        });

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

        // CORRECTION : La soumission du formulaire est maintenant gérée par fetch pour éviter le rechargement.
        form.addEventListener('submit', (e) => {
            e.preventDefault(); 
            hasUnsavedChanges = false;

            const saveButton = form.querySelector('button[type="submit"]');
            const originalButtonText = saveButton.innerHTML;
            saveButton.disabled = true;
            saveButton.innerHTML = 'Enregistrement...';

            const formData = new FormData(form);

            fetch('index.php?page=calculateur', {
                method: 'POST',
                body: formData,
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert(data.message, 'success');
                    } else {
                        alert(data.message);
                    }
                } else {
                    throw new Error(data.message || 'Une erreur inconnue est survenue.');
                }
            })
            .catch(err => {
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('Erreur lors de la sauvegarde : ' + err.message, 'error');
                } else {
                    alert('Erreur lors de la sauvegarde : ' + err.message);
                }
                hasUnsavedChanges = true; 
            })
            .finally(() => {
                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonText;
            });
        });

        const resumeCountingBtn = document.getElementById('resume-counting-btn');
        if (resumeCountingBtn && comptageId) {
            resumeCountingBtn.addEventListener('click', () => {
                window.location.href = `index.php?page=calculateur&resume_from=${comptageId}`;
            });
        }
    }
    
    function resetAllFormFields() {
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
            if (input && !input.name.includes('[cheques]')) {
                 if (input.value !== formState[id]) {
                    input.value = formState[id];
                }
            }
        }
        
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

            chequesContainer.innerHTML = ''; 
            
            const valuesToRender = chequeValuesInState.length > 0 ? chequeValuesInState : [''];
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

    window.sendFullFormState = function() {
        if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
            const formState = {};
            document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach((el, index) => {
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

        setInterval(() => {
            if (hasUnsavedChanges) {
                const formData = new FormData(form);
                fetch('index.php?action=autosave', {
                    method: 'POST',
                    body: formData,
                }).then(res => res.json()).then(data => {
                    if (data.success) {
                        console.log('Autosave successful at ' + new Date().toLocaleTimeString());
                        hasUnsavedChanges = false;
                    }
                });
            }
        }, 30000);

        window.addEventListener('beforeunload', (event) => {
            if (hasUnsavedChanges) {
                const formData = new FormData(form);
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
