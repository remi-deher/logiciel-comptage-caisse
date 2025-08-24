/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 */
document.addEventListener('DOMContentLoaded', function() {
    // --- Sélecteurs des éléments du DOM ---
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    const calculatorDataElement = document.getElementById('calculator-data');
    if (!calculatorDataElement) return;

    // --- Variables d'état globales ---
    window.lockedCaisses = [];
    window.closedCaisses = [];

    // --- Création des modales ---
    const caisseSelectionModal = document.getElementById('caisse-selection-modal');
    const clotureConfirmationModal = document.getElementById('cloture-confirmation-modal');
    const finalConfirmationModal = document.getElementById('final-confirmation-modal');
    const clotureGeneraleModal = document.getElementById('cloture-generale-modal');

    // --- Fonctions utilitaires ---

    window.showCustomAlert = function(message, type = 'success') {
        const existingAlert = document.getElementById('custom-alert-modal');
        if (existingAlert) existingAlert.remove();

        const alertModal = document.createElement('div');
        alertModal.id = 'custom-alert-modal';
        alertModal.className = `modal custom-alert ${type}`;
        const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-times-circle';

        alertModal.innerHTML = `
            <div class="modal-content">
                <div class="alert-icon"><i class="fa-solid ${iconClass}"></i></div>
                <p>${message}</p>
                <button class="btn close-alert-btn">OK</button>
            </div>
        `;
        document.body.appendChild(alertModal);

        setTimeout(() => alertModal.classList.add('visible'), 10);

        const closeBtn = alertModal.querySelector('.close-alert-btn');
        const closeModal = () => {
            alertModal.classList.remove('visible');
            setTimeout(() => {
                alertModal.remove();
            }, 300);
        };
        closeBtn.addEventListener('click', closeModal);
        alertModal.addEventListener('click', (event) => {
            if (event.target === alertModal) closeModal();
        });
    }

    // CORRECTION: La fonction ne vide plus le fond de caisse et force le recalcul
    window.resetAllCaisseFields = function() {
        document.querySelectorAll('#caisse-form input[type="text"], #caisse-form input[type="number"], #caisse-form textarea').forEach(input => {
            // On ne vide pas le fond de caisse
            if (!input.id.includes('fond_de_caisse')) {
                input.value = '';
            }
        });
        document.getElementById('nom_comptage').value = '';
        document.getElementById('explication').value = '';

        window.lockedCaisses = [];
        window.closedCaisses = [];

        // Appel du calcul complet pour mettre à jour les écarts à zéro
        if (typeof window.calculateAllFull === 'function') {
            window.calculateAllFull();
        }
        handleInterfaceLock([], []);
        
        if (typeof window.updateWebsocketStatusIndicator === 'function') {
            window.updateWebsocketStatusIndicator([], []);
        }
    };


    const isCaisseLockedBy = (caisseId, lockedBy) => Array.isArray(window.lockedCaisses) && lockedBy && window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by.toString() === lockedBy.toString());
    const isCaisseLocked = (caisseId) => Array.isArray(window.lockedCaisses) && window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());

    // --- Fonctions de mise à jour de l'interface ---

    const updateCaisseTabs = (nomsCaisses) => {
        for (const caisseId in nomsCaisses) {
            const tabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
            if (!tabLink) continue;
            const isClosed = window.closedCaisses.includes(caisseId);
            const isLocked = isCaisseLocked(caisseId);
            tabLink.classList.toggle('cloture-en-cours', isLocked && !isClosed);
            tabLink.classList.toggle('cloturee', isClosed);
        }
    };

    const updateFormFields = (nomsCaisses, currentWsId) => {
        document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
            const elCaisseId = el.id.split('_').pop();
            if (nomsCaisses.hasOwnProperty(elCaisseId)) {
                const isClosed = window.closedCaisses.includes(elCaisseId);
                const isLockedByAnother = isCaisseLocked(elCaisseId) && !isCaisseLockedBy(elCaisseId, currentWsId);
                el.disabled = isClosed || isLockedByAnother;
                el.readOnly = isClosed;
            }
        });
    };

    // CORRECTION: La fonction n'efface plus le message d'écart nul
    const updateEcartDisplayForCloture = (nomsCaisses) => {
        for (const caisseId in nomsCaisses) {
            const display = document.getElementById(`ecart-display-caisse${caisseId}`);
            if (display) {
                const isClosed = window.closedCaisses.includes(caisseId);
                display.classList.toggle('ecart-cloturee', isClosed);
                const explanationP = display.querySelector('.ecart-explanation');
                if (isClosed && explanationP) {
                    explanationP.textContent = "Cette caisse est clôturée.";
                }
            }
        }
    };

    window.handleInterfaceLock = function(lockedCaisses, closedCaisses) {
        const nomsCaisses = JSON.parse(calculatorDataElement.dataset.config)?.nomsCaisses || {};
        const allCaissesPreviouslyClosed = Object.keys(nomsCaisses).length > 0 && Object.keys(nomsCaisses).every(id => window.closedCaisses.includes(id));

        window.lockedCaisses = lockedCaisses || [];
        window.closedCaisses = (closedCaisses || []).map(String);

        updateCaisseTabs(nomsCaisses);
        updateFormFields(nomsCaisses, window.wsConnection?.resourceId);
        updateEcartDisplayForCloture(nomsCaisses);

        const allCaissesNowClosed = Object.keys(nomsCaisses).length > 0 && Object.keys(nomsCaisses).every(id => window.closedCaisses.includes(id));
        if (allCaissesNowClosed && !allCaissesPreviouslyClosed) {
            window.showCustomAlert("La dernière caisse a été clôturée. Allez dans le menu Clôture pour confirmer la clôture générale.", 'success');
        }
    };

    // --- Logique des modales ---

    async function showCaisseSelectionModal() {
        const config = JSON.parse(calculatorDataElement.dataset.config);
        const { nomsCaisses } = config;
        const currentWsId = window.wsConnection?.resourceId;

        try {
            const response = await fetch('index.php?action=get_cloture_state');
            const data = await response.json();
            if (data.success) {
                window.lockedCaisses = (data.locked_caisses || []).map(c => ({ caisse_id: c.caisse_id.toString(), locked_by: c.locked_by ? c.locked_by.toString() : null }));
                window.closedCaisses = (data.closed_caisses || []).map(String);
            }
        } catch (e) {
            console.error('Erreur de récupération de l\'état de clôture:', e);
        }

        if (Object.keys(nomsCaisses).every(id => window.closedCaisses.includes(id))) {
            showClotureGeneraleModal();
            return;
        }

        let caisseListHtml = '';
        for (const id in nomsCaisses) {
            let statusClass = 'libre';
            let actionHtml = `<button class="lock-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-lock"></i> Verrouiller</button>`;

            if (window.closedCaisses.includes(id)) {
                statusClass = 'cloturee';
                actionHtml = `<button class="reopen-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Réouvrir</button>`;
            } else if (isCaisseLocked(id)) {
                statusClass = 'en-cours';
                if (isCaisseLockedBy(id, currentWsId)) {
                    actionHtml = `<button class="confirm-cloture-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-check-circle"></i> Confirmer</button>`;
                } else {
                    actionHtml = `<button class="force-unlock-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-user-lock"></i> Forcer</button>`;
                }
            }

            caisseListHtml += `
                <div class="caisse-status-item caisse-status-${statusClass}" data-caisse-id="${id}">
                    <div class="status-info"><i class="fa-solid fa-cash-register"></i><strong>${nomsCaisses[id]}</strong></div>
                    <div class="status-actions">${actionHtml}</div>
                </div>`;
        }
        
        const modalBody = caisseSelectionModal.querySelector('.caisse-status-list');
        if (modalBody) modalBody.innerHTML = caisseListHtml;
        caisseSelectionModal.classList.add('visible');
    }

    function showClotureGeneraleModal() {
        const config = JSON.parse(calculatorDataElement.dataset.config);
        const { nomsCaisses, denominations, currencySymbol } = config;
        let accordionHtml = '<div class="accordion-container">';
        for (const caisseId in nomsCaisses) {
            const { suggestions } = calculateCaisseData(caisseId, config);
            accordionHtml += `
                <div class="accordion-card">
                    <div class="accordion-header">
                        <i class="fa-solid fa-cash-register"></i>
                        <h3>${nomsCaisses[caisseId]} : Suggestion de retrait</h3>
                        <button class="reopen-caisse-btn action-btn-small" data-caisse-id="${caisseId}"><i class="fa-solid fa-lock-open"></i> Réouvrir</button>
                        <i class="fa-solid fa-chevron-down accordion-toggle-icon"></i>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-content-inner">
                            <table class="withdrawal-suggestion-table">
                                <thead><tr><th>Dénomination</th><th>Quantité à retirer</th></tr></thead>
                                <tbody>`;
            const allDenominationsSorted = [...Object.entries(denominations.billets), ...Object.entries(denominations.pieces)].sort((a, b) => b[1] - a[1]);
            allDenominationsSorted.forEach(([name, value]) => {
                if (suggestions[name] > 0) {
                    const label = value >= 1 ? `${value} ${currencySymbol}` : `${value * 100} cts`;
                    accordionHtml += `<tr><td>${label}</td><td>${suggestions[name]}</td></tr>`;
                }
            });
            accordionHtml += `</tbody></table></div></div></div>`;
        }
        accordionHtml += '</div>';
        
        clotureGeneraleModal.querySelector('.modal-content .accordion-container').innerHTML = accordionHtml;
        clotureGeneraleModal.classList.add('visible');
    }
    
    function showFinalConfirmationModal() {
        finalConfirmationModal.classList.add('visible');
    }
    
    function showClotureConfirmationModal(caisseId) {
        if (!caisseId) return;
        const config = JSON.parse(calculatorDataElement.dataset.config);
        const caisseNom = config.nomsCaisses[caisseId];
    
        const confirmCaisseNameEl = document.getElementById('confirm-caisse-name');
        if (confirmCaisseNameEl) {
            confirmCaisseNameEl.textContent = caisseNom;
        }
    
        const summaryContainer = document.getElementById('confirm-caisse-summary');
        if (summaryContainer) {
            const { recetteReelle, ecart } = calculateCaisseDataForSummary(caisseId, config);
            const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
            
            summaryContainer.innerHTML = `
                <div class="caisse-summary-box">
                    <div><span>Recette réelle :</span> <strong>${formatCurrency(recetteReelle)}</strong></div>
                    <div><span>Écart constaté :</span> <strong class="${ecart > 0.01 ? 'ecart-positif' : ecart < -0.01 ? 'ecart-negatif' : ''}">${formatCurrency(ecart)}</strong></div>
                </div>
            `;
        }
    
        clotureConfirmationModal.querySelector('#cancel-cloture-btn').dataset.caisseId = caisseId;
        clotureConfirmationModal.querySelector('#confirm-final-cloture-btn').dataset.caisseId = caisseId;
        clotureConfirmationModal.classList.add('visible');
    }

    // --- Gestionnaire d'événements centralisé ---

    clotureBtn.addEventListener('click', () => {
        if (calculatorDataElement.dataset.config.includes('"isLoadedFromHistory":true')) {
            window.showCustomAlert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.", 'error');
            return;
        }
        showCaisseSelectionModal();
    });

    document.body.addEventListener('click', function(event) {
        let target = event.target;
        // On ne gère plus la fermeture par le bouton, juste le clic en dehors
        const modal = target.closest('.modal');
        if (target === modal) {
            modal?.classList.remove('visible');
        }

        const caisseItem = target.closest('.caisse-status-item');
        if (caisseItem && !target.closest('button')) {
            target = caisseItem.querySelector('button');
        }

        const button = target.closest('button');
        if (!button) return;

        // Logique pour la modale de sélection et de clôture générale
        if (button.closest('#caisse-selection-modal, #cloture-generale-modal')) {
            const caisseId = button.dataset.caisseId;
            if (caisseId) {
                if (button.classList.contains('lock-caisse-btn')) {
                    window.wsConnection?.send(JSON.stringify({ type: 'cloture_lock', caisse_id: caisseId }));
                    document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`)?.click();
                    caisseSelectionModal.classList.remove('visible');
                } else if (button.classList.contains('confirm-cloture-caisse-btn')) {
                    caisseSelectionModal.classList.remove('visible');
                    showClotureConfirmationModal(caisseId);
                } else if (button.classList.contains('force-unlock-btn') && confirm("Forcer le déverrouillage de cette caisse ?")) {
                    window.wsConnection?.send(JSON.stringify({ type: 'force_unlock', caisse_id: caisseId }));
                    caisseSelectionModal.classList.remove('visible');
                } else if (button.classList.contains('reopen-caisse-btn') && confirm("Vraiment réouvrir cette caisse ?")) {
                    window.wsConnection?.send(JSON.stringify({ type: 'cloture_reopen', caisse_id: caisseId }));
                    caisseSelectionModal.classList.remove('visible');
                    clotureGeneraleModal.classList.remove('visible');
                }
            } else if (button.id === 'confirm-cloture-generale-btn') {
                clotureGeneraleModal.classList.remove('visible');
                showFinalConfirmationModal();
            }
        }

        // Logique pour la modale de confirmation d'une caisse
        if (button.closest('#cloture-confirmation-modal')) {
            const caisseId = button.dataset.caisseId;
            if (button.id === 'cancel-cloture-btn') {
                window.wsConnection?.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: caisseId }));
                clotureConfirmationModal.classList.remove('visible');
            } else if (button.id === 'confirm-final-cloture-btn') {
                clotureConfirmationModal.classList.remove('visible');
                const formData = new FormData(document.getElementById('caisse-form'));
                formData.append('caisse_id_a_cloturer', caisseId);
                fetch('index.php?action=cloture', { method: 'POST', body: formData })
                    .then(res => res.json()).then(data => {
                        if (data.success) {
                            window.showCustomAlert(data.message, 'success');
                            window.wsConnection?.send(JSON.stringify({ type: 'cloture_caisse_confirmed', caisse_id: caisseId }));
                        } else { throw new Error(data.message); }
                    }).catch(err => {
                        window.showCustomAlert("Erreur: " + err.message, 'error');
                        window.wsConnection?.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: caisseId }));
                    });
            }
        }
        
        // Logique pour la modale de confirmation finale
        if (button.closest('#final-confirmation-modal')) {
            if (button.id === 'confirm-final-cloture-action-btn') {
                window.wsConnection?.send(JSON.stringify({ type: 'cloture_generale' }));
                finalConfirmationModal.classList.remove('visible');
            } else if (button.id === 'cancel-final-cloture-action-btn') {
                finalConfirmationModal.classList.remove('visible');
            }
        }
    });

    // --- Fonctions de calcul ---
    function calculateCaisseData(caisseId, config) {
        const { denominations, minToKeep } = config;
        const getVal = (id) => parseFloat(document.getElementById(`${id}_${caisseId}`)?.value.replace(',', '.') || 0) || 0;
        const getInt = (id) => parseInt(document.getElementById(`${id}_${caisseId}`)?.value || 0) || 0;
        let totalCompte = 0;
        const currentCounts = {};
        for (const type in denominations) {
            for (const name in denominations[type]) {
                const count = getInt(name);
                totalCompte += count * denominations[type][name];
                currentCounts[name] = count;
            }
        }
        const fondDeCaisse = getVal('fond_de_caisse');
        const recetteReelle = totalCompte - fondDeCaisse;
        const suggestions = generateWithdrawalSuggestion(recetteReelle, currentCounts, denominations, minToKeep);
        return { recetteReelle, suggestions };
    }
    
    function calculateCaisseDataForSummary(caisseId, config) {
        const { denominations } = config;
        const getVal = (id) => parseFloat(document.getElementById(`${id}_${caisseId}`)?.value.replace(',', '.') || 0) || 0;
        const getInt = (id) => parseInt(document.getElementById(`${id}_${caisseId}`)?.value || 0) || 0;

        let totalCompte = 0;
        for (const type in denominations) {
            for (const name in denominations[type]) {
                totalCompte += getInt(name) * denominations[type][name];
            }
        }

        const fondDeCaisse = getVal('fond_de_caisse');
        const ventes = getVal('ventes');
        const retrocession = getVal('retrocession');
        const recetteTheorique = ventes + retrocession;
        const recetteReelle = totalCompte - fondDeCaisse;
        const ecart = recetteReelle - recetteTheorique;

        return { recetteReelle, ecart };
    }

    function generateWithdrawalSuggestion(amountToWithdraw, currentCounts, denominations, minToKeep) {
        let remainingAmount = amountToWithdraw;
        const suggestions = {};
        const allDenominations = [...Object.entries(denominations.billets), ...Object.entries(denominations.pieces)].sort((a, b) => b[1] - a[1]);
        for (const [name, value] of allDenominations) {
            const countInCaisse = currentCounts[name] || 0;
            const toKeep = minToKeep[name] || 0;
            const availableToRemove = Math.max(0, countInCaisse - toKeep);
            const numToRemove = Math.min(Math.floor(remainingAmount / value), availableToRemove);
            if (numToRemove > 0) {
                suggestions[name] = numToRemove;
                remainingAmount -= numToRemove * value;
                remainingAmount = parseFloat(remainingAmount.toFixed(2));
            }
        }
        return suggestions;
    }
});
