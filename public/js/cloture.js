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
    
    const clotureModal = document.getElementById('cloture-modal');
    const cancelClotureBtn = document.getElementById('cancel-cloture-btn');
    const confirmFinalClotureBtn = document.getElementById('confirm-final-cloture-btn');
    const caisseForm = document.getElementById('caisse-form');

    // Crée le conteneur du bouton de confirmation de clôture
    const confirmClotureBtnContainer = document.createElement('div');
    confirmClotureBtnContainer.id = 'confirm-cloture-btn-container';
    confirmClotureBtnContainer.style.display = 'none';
    confirmClotureBtnContainer.innerHTML = '<button id="confirm-cloture-btn" class="cloture-btn"><i class="fa-solid fa-check-circle"></i> Confirmer la clôture</button>';
    clotureBtn.parentNode.insertBefore(confirmClotureBtnContainer, clotureBtn.nextSibling);
    const confirmClotureBtn = document.getElementById('confirm-cloture-btn');

    // Crée la modale de sélection de caisse
    const caisseSelectionModal = document.createElement('div');
    caisseSelectionModal.id = 'caisse-selection-modal';
    caisseSelectionModal.classList.add('modal');
    document.body.appendChild(caisseSelectionModal);

    // Variables d'état globales (exposées via window pour l'interopérabilité)
    window.lockedCaisses = [];
    window.closedCaisses = [];

    // --- Fonctions de vérification d'état ---
    const isCaisseLockedBy = (caisseId, lockedBy) => {
        if (!Array.isArray(window.lockedCaisses)) return false;
        return window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by === lockedBy.toString());
    };
    
    const isCaisseLocked = (caisseId) => {
        if (!Array.isArray(window.lockedCaisses)) return false;
        return window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());
    };
    
    const isCaisseLockedOrClosed = (caisseId) => {
        return isCaisseLocked(caisseId) || window.closedCaisses.includes(caisseId);
    };

    // --- Fonctions de gestion de l'interface utilisateur ---
    const updateCaisseTabs = (nomsCaisses, currentWsId, activeCaisseId) => {
        for (const caisseId in nomsCaisses) {
            const tabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
            const badge = document.getElementById(`caisse-status-${caisseId}`);

            const isClosed = window.closedCaisses.includes(caisseId);
            const isLocked = isCaisseLocked(caisseId);
            const isLockedByMe = isCaisseLockedBy(caisseId, currentWsId);

            if (badge) {
                badge.className = 'caisse-status-badge';
                if (isClosed) {
                    badge.textContent = 'Clôturée';
                    badge.classList.add('cloture');
                } else if (isLocked) {
                    badge.textContent = 'En cours';
                    badge.classList.add('en-cours');
                } else {
                    badge.textContent = '';
                }
            }

            if (tabLink) {
                const isLockedByAnother = isLocked && !isLockedByMe;
                if (isClosed || isLockedByAnother) {
                    tabLink.disabled = false;
                } else {
                    tabLink.disabled = false;
                }
            }
        }
    };
    
    const updateFormFields = (nomsCaisses, currentWsId) => {
        document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
            const elId = el.id.split('_');
            const elCaisseId = elId[elId.length - 1];

            const isClosed = window.closedCaisses.includes(elCaisseId);
            const isLockedByMe = isCaisseLockedBy(elCaisseId, currentWsId);
            const isLockedByAnother = isCaisseLocked(elCaisseId) && !isLockedByMe;

            if (isClosed || isLockedByAnother) {
                el.disabled = true;
                if (isClosed) {
                    el.readOnly = true;
                }
            } else {
                el.disabled = false;
                el.readOnly = false;
            }
        });
    };
    
    const updateClotureButton = (activeCaisseId, currentWsId) => {
        const isAnyCaisseLocked = window.lockedCaisses.length > 0;
        const formSaveButton = document.querySelector('.save-section .save-btn');

        if (formSaveButton) {
            const isCaisseActiveLockedByMe = isCaisseLockedBy(activeCaisseId, currentWsId);
            const isCaisseActiveClosed = window.closedCaisses.includes(activeCaisseId);
            formSaveButton.disabled = isCaisseActiveClosed || (isCaisseLocked(activeCaisseId) && !isCaisseActiveLockedByMe);
        }
        
        clotureBtn.disabled = false;
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';

        clotureBtn.onclick = () => {
            const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');
            if (isLoadedFromHistory) {
                alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                return;
            }
            showCaisseSelectionModal();
        };

        const isCaisseActiveLockedByMe = isCaisseLockedBy(activeCaisseId, currentWsId);
        if (confirmClotureBtnContainer) {
             confirmClotureBtnContainer.style.display = isCaisseActiveLockedByMe ? 'block' : 'none';
        }
    };
    
    window.handleInterfaceLock = function (lockedCaisses, closedCaisses) {
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;

        window.lockedCaisses = lockedCaisses || [];
        window.closedCaisses = closedCaisses || [];
        const nomsCaisses = JSON.parse(document.getElementById('calculator-data')?.dataset.config)?.nomsCaisses || {};
        
        updateCaisseTabs(nomsCaisses, currentWsId, activeCaisseId);
        updateFormFields(nomsCaisses, currentWsId);
        updateClotureButton(activeCaisseId, currentWsId);
    };

    async function showCaisseSelectionModal() {
        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
        const nomsCaisses = config.nomsCaisses || {};
        const currentWsId = window.wsConnection?.resourceId;

        let state = { locked_caisses: [], closed_caisses: [] };
        try {
            const response = await fetch('index.php?action=get_cloture_state');
            state = await response.json();
            window.lockedCaisses = state.locked_caisses.map(c => ({
                caisse_id: c.caisse_id.toString(),
                locked_by: c.locked_by.toString()
            }));
            window.closedCaisses = state.closed_caisses.map(String);
        } catch (e) {
            console.error('Erreur lors de la récupération de l\'état de clôture:', e);
        }

        let caisseListHtml = '';
        for (const id in nomsCaisses) {
            const nom = nomsCaisses[id];
            let status = 'Libre';
            let statusClass = 'caisse-status-libre';
            let actionHtml = '';

            // CORRECTION: Définition de isCaisseLockedByMe ici pour éviter l'erreur
            const isLockedByMe = isCaisseLockedBy(id, currentWsId);
            const isClosed = window.closedCaisses.includes(id);
            const isLocked = isCaisseLocked(id);
            const isLockedByAnother = isLocked && !isLockedByMe;

            if (isClosed) {
                status = 'Clôturée';
                statusClass = 'caisse-status-cloturee';
                actionHtml = `<button class="force-unlock-btn" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Déverrouiller</button>`;
            } else if (isLockedByMe) {
                status = 'En cours de clôture';
                statusClass = 'caisse-status-en-cours';
            } else if (isLockedByAnother) {
                status = 'En cours de clôture';
                statusClass = 'caisse-status-en-cours';
                actionHtml = `<button class="force-unlock-btn" data-caisse-id="${id}"><i class="fa-solid fa-user-lock"></i> Forcer</button>`;
            }
            
            caisseListHtml += `
                <div class="caisse-status-item ${isClosed || isLockedByAnother ? 'disabled' : ''} ${statusClass}" data-caisse-id="${id}">
                    <div class="status-info">
                        <i class="fa-solid fa-cash-register"></i>
                        <strong>${nom}</strong>
                    </div>
                    <div class="status-actions">
                         <span>${status}</span>
                         ${actionHtml}
                    </div>
                </div>`;
        }

        const modalContentHtml = `
            <div class="modal-content">
                <div class="modal-header-cloture">
                    <h3>Sélectionnez une caisse à clôturer</h3>
                </div>
                <div class="modal-body-cloture">
                    <p>Cliquez sur une caisse pour démarrer la procédure de clôture et en verrouiller l'accès.</p>
                     <div class="color-key">
                        <div><span class="color-dot color-libre"></span> Libre</div>
                        <div><span class="color-dot color-cloturee"></span> Clôturée</div>
                        <div><span class="color-dot color-en-cours"></span> En cours de clôture</div>
                    </div>
                    <div class="caisse-status-list">
                        ${caisseListHtml}
                    </div>
                </div>
            </div>`;
        
        caisseSelectionModal.innerHTML = modalContentHtml;
        caisseSelectionModal.classList.add('visible');

        window.onclick = function(event) {
            if (event.target == caisseSelectionModal) {
                caisseSelectionModal.classList.remove('visible');
            }
        };

        caisseSelectionModal.querySelectorAll('.caisse-status-item').forEach(item => {
            item.addEventListener('click', (event) => {
                const caisseId = item.dataset.caisseId;
                if (caisseId) {
                    if (window.closedCaisses.includes(caisseId)) {
                        alert("Cette caisse a déjà été clôturée.");
                        return;
                    }
                    if (isCaisseLocked(caisseId) && !isCaisseLockedBy(caisseId, currentWsId)) {
                         alert("Cette caisse est déjà verrouillée par un autre utilisateur.");
                         return;
                    }
                    
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_lock', caisse_id: caisseId }));
                    
                    const targetTabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
                    if (targetTabLink) {
                         targetTabLink.click();
                    }

                    caisseSelectionModal.classList.remove('visible');
                }
            });
        });
        
        caisseSelectionModal.querySelectorAll('.force-unlock-btn').forEach(btn => {
             btn.addEventListener('click', (event) => {
                 event.stopPropagation();
                 const caisseId = btn.dataset.caisseId;
                 if (window.confirm("Voulez-vous forcer le déverrouillage de cette caisse ?")) {
                     window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: caisseId }));
                     caisseSelectionModal.classList.remove('visible');
                 }
             });
        });
    }

    function showWithdrawalSuggestion() {
        if (typeof window.calculateAllFull !== 'function') return;
        window.calculateAllFull();

        const activeTab = document.querySelector('.tab-link.active')?.dataset.tab;
        const activeCaisseId = activeTab ? activeTab.replace('caisse', '') : null;
        if (!activeCaisseId) return;

        const configElement = document.getElementById('calculator-data');
        const config = JSON.parse(configElement.dataset.config);
        const { denominations, minToKeep, currencySymbol } = config;

        const getVal = (id) => parseFloat(document.getElementById(`${id}_${activeCaisseId}`)?.value.replace(',', '.') || 0) || 0;
        const getInt = (id) => parseInt(document.getElementById(`${id}_${activeCaisseId}`)?.value || 0) || 0;

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
        const ventes = getVal('ventes');
        const retrocession = getVal('retrocession');
        const recetteReelle = totalCompte - fondDeCaisse;
        const ecart = recetteReelle - (ventes + retrocession);

        const suggestionContainer = document.createElement('div');
        suggestionContainer.innerHTML = `
            <div class="modal-body-content">
                <h4 style="margin-top: 15px;">Détails de la clôture pour la caisse ${config.nomsCaisses[activeCaisseId]}</h4>
                <p><strong>Recette théorique :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ventes + retrocession)}</span></p>
                <p><strong>Recette réelle (à retirer) :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(recetteReelle)}</span></p>
                <p><strong>Écart :</strong> <span style="color: ${ecart > 0.01 ? 'var(--color-warning)' : (ecart < -0.01 ? 'var(--color-danger)' : 'var(--color-success)')};">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ecart)}</span></p>
            </div>
        `;
        
        if (Math.abs(ecart) < 0.01) {
            const suggestions = generateWithdrawalSuggestion(recetteReelle, currentCounts, denominations, minToKeep);
            let suggestionHtml = `
                <div class="modal-body-content">
                    <h4 style="margin-top: 15px;">Composition du retrait</h4>
                    <p>Pour clôturer la caisse, retirez le montant suivant :</p>
                    <div style="display: flex; justify-content: space-around; gap: 20px;">
                        <div>
                            <h5><i class="fa-solid fa-money-bill"></i> Billets</h5>
                            <ul style="list-style: none; padding: 0;">
            `;
            let hasSuggestions = false;
            for (const [name, value] of Object.entries(denominations.billets).sort((a, b) => b[1] - a[1])) {
                if (suggestions[name] && suggestions[name] > 0) {
                    hasSuggestions = true;
                    suggestionHtml += `<li><strong>${value} ${currencySymbol}:</strong> ${suggestions[name]}</li>`;
                }
            }
            suggestionHtml += `
                            </ul>
                        </div>
                        <div>
                            <h5><i class="fa-solid fa-coins"></i> Pièces</h5>
                            <ul style="list-style: none; padding: 0;">
            `;
            for (const [name, value] of Object.entries(denominations.pieces).sort((a, b) => b[1] - a[1])) {
                if (suggestions[name] && suggestions[name] > 0) {
                    hasSuggestions = true;
                    const label = value >= 1 ? `${value} ${currencySymbol}` : `${value * 100} cts`;
                    suggestionHtml += `<li><strong>${label}:</strong> ${suggestions[name]}</li>`;
                }
            }
            suggestionHtml += `
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            if (hasSuggestions) {
                suggestionContainer.innerHTML += suggestionHtml;
            }
        }
        
        const modalBody = document.querySelector('#cloture-modal .modal-content');
        let existingContent = modalBody.querySelector('.modal-body-content');
        if (existingContent) {
             existingContent.remove();
        }
        modalBody.insertAdjacentHTML('beforeend', `<div class="modal-body-content">${suggestionContainer.innerHTML}</div>`);
    }
    
    function showOpenCaisses() {
        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
        const caissesOuvertes = Object.keys(config.nomsCaisses).filter(id => !window.closedCaisses.includes(id));
        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
        
        const openCaissesHtml = caissesOuvertes
            .filter(id => id.toString() !== activeTabCaisseId.toString())
            .map(id => `<li>${config.nomsCaisses[id]}</li>`)
            .join('');

        const modalBody = document.querySelector('#cloture-modal .modal-content');
        const existingOpenCaisses = modalBody.querySelector('#open-caisses-list-container');
        if (existingOpenCaisses) {
            existingOpenCaisses.remove();
        }

        if (caissesOuvertes.length > 1) {
            const html = `
                <div id="open-caisses-list-container" class="modal-body-content">
                    <h4>Clôture en attente pour les caisses suivantes :</h4>
                    <ul>
                        ${openCaissesHtml}
                    </ul>
                </div>
            `;
            modalBody.insertAdjacentHTML('beforeend', html);
        }
    }

    function generateWithdrawalSuggestion(amountToWithdraw, currentCounts, denominations, minToKeep) {
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
    
    clotureBtn.addEventListener('click', () => {
        const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');
        if (isLoadedFromHistory) {
            alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
            return;
        }
        showCaisseSelectionModal();
    });

    cancelClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');
    });

    if (confirmClotureBtn) {
        confirmClotureBtn.addEventListener('click', () => {
            document.querySelector('#cloture-modal h3').textContent = "Confirmation de la clôture";
            document.querySelector('#cloture-modal p').textContent = "Voulez-vous finaliser la clôture de la caisse ? Cette action est irréversible.";
            cancelClotureBtn.style.display = 'block';
            confirmFinalClotureBtn.style.display = 'block';
            showWithdrawalSuggestion();
            showOpenCaisses();
            clotureModal.classList.add('visible');
        });
    }

    confirmFinalClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');
        if (!caisseForm) {
            alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
            return;
        }

        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
        if (!activeTabCaisseId || window.closedCaisses.includes(activeTabCaisseId)) {
            alert("Erreur : ID de caisse invalide ou caisse déjà clôturée.");
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeTabCaisseId }));
            }
            return;
        }
        
        const formData = new FormData(caisseForm);
        formData.append('caisse_id_a_cloturer', activeTabCaisseId);

        fetch('index.php?action=cloture', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                sessionStorage.removeItem('isClotureMode');
                if (!window.closedCaisses.includes(activeTabCaisseId)) {
                    window.closedCaisses.push(activeTabCaisseId);
                }
                window.handleInterfaceLock(window.lockedCaisses, window.closedCaisses);
                if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_caisse_confirmed', caisse_id: activeTabCaisseId }));
                }
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        })
        .catch(error => {
            alert("Une erreur est survenue lors de la clôture: " + error.message);
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeTabCaisseId }));
            }
        });
    });
});
