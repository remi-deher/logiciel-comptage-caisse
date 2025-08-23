/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 *
 * Ce module gère l'interface utilisateur pour le processus de clôture,
 * la communication avec le serveur WebSocket pour verrouiller les caisses
 * et la mise à jour dynamique de l'interface.
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
    const caisseSelectionModal = document.createElement('div');
    caisseSelectionModal.id = 'caisse-selection-modal';
    caisseSelectionModal.classList.add('modal');
    document.body.appendChild(caisseSelectionModal);

    const clotureConfirmationModal = document.createElement('div');
    clotureConfirmationModal.id = 'cloture-confirmation-modal';
    clotureConfirmationModal.classList.add('modal');
    document.body.appendChild(clotureConfirmationModal);

    const finalConfirmationModal = document.createElement('div');
    finalConfirmationModal.id = 'final-confirmation-modal';
    finalConfirmationModal.classList.add('modal');
    document.body.appendChild(finalConfirmationModal);

    const clotureGeneraleModal = document.createElement('div');
    clotureGeneraleModal.id = 'cloture-generale-modal';
    clotureGeneraleModal.classList.add('modal');
    document.body.appendChild(clotureGeneraleModal);

    // --- Fonctions utilitaires ---

    // MODIFICATION: On attache la fonction à 'window' pour la rendre globale
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
            setTimeout(() => alertModal.remove(), 300);
        };
        closeBtn.addEventListener('click', closeModal);
        alertModal.addEventListener('click', (event) => {
            if (event.target === alertModal) closeModal();
        });
    }

    const isCaisseLockedBy = (caisseId, lockedBy) => Array.isArray(window.lockedCaisses) && lockedBy && window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by.toString() === lockedBy.toString());
    const isCaisseLocked = (caisseId) => Array.isArray(window.lockedCaisses) && window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());

    // ... (le reste du fichier reste inchangé)
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

        caisseSelectionModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header-cloture"><h3>Gestion de la Clôture</h3></div>
                <div class="modal-body-cloture">
                    <p>Sélectionnez une caisse pour commencer ou modifier son état de clôture.</p>
                    <div class="color-key">
                        <div><span class="color-dot color-libre"></span> Libre</div>
                        <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                        <div><span class="color-dot color-en-cours"></span> En cours</div>
                    </div>
                    <div class="caisse-status-list">${caisseListHtml}</div>
                </div>
            </div>`;
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

        clotureGeneraleModal.innerHTML = `
            <div class="modal-content">
                 <span class="modal-close">&times;</span>
                <div class="modal-header"><h3>Toutes les caisses sont clôturées</h3></div>
                <p>Vérifiez les suggestions de retrait une dernière fois avant de lancer la clôture générale.</p>
                ${accordionHtml}
                <div class="modal-actions">
                    <button id="confirm-cloture-generale-btn" class="btn save-btn">Confirmer la Clôture Générale</button>
                </div>
            </div>`;
        clotureGeneraleModal.classList.add('visible');
    }
    
    function showFinalConfirmationModal() {
        finalConfirmationModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header modal-header-danger"><h3>Confirmation Finale</h3></div>
                <p>Validez la clôture de la journée ?<br>Cela remettra les caisses à 0 en gardant le fond de caisse et va créer une sauvegarde des comptages.</p>
                <div class="modal-actions">
                    <button id="cancel-final-cloture-action-btn" class="btn delete-btn">Annuler</button>
                    <button id="confirm-final-cloture-action-btn" class="btn save-btn">Confirmer</button>
                </div>
            </div>`;
        finalConfirmationModal.classList.add('visible');
    }
    
    function showClotureConfirmationModal(caisseId) {
        if (!caisseId) return;
        const config = JSON.parse(calculatorDataElement.dataset.config);
        const caisseNom = config.nomsCaisses[caisseId];
        clotureConfirmationModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header"><h3>Confirmer la clôture de : ${caisseNom}</h3></div>
                <p>Voulez-vous finaliser la clôture de cette caisse ? Cette action est irréversible.</p>
                <div class="modal-body-content-wrapper"></div>
                <div class="modal-actions">
                    <button id="cancel-cloture-btn" class="btn delete-btn" data-caisse-id="${caisseId}">Annuler</button>
                    <button id="confirm-final-cloture-btn" class="btn new-btn" data-caisse-id="${caisseId}">Confirmer la clôture</button>
                </div>
            </div>`;
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
        const modal = target.closest('.modal');

        if (target.classList.contains('modal-close') || target === modal) {
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
