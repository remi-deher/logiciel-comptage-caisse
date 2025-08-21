/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 *
 * Nouvelle logique de clôture :
 * 1. Clic sur le bouton "Clôture" affiche une modale de sélection de caisse.
 * 2. La modale affiche le statut de chaque caisse (libre, verrouillée, fermée).
 * 3. L'utilisateur choisit une caisse, ce qui verrouille son interface sur cet onglet.
 * 4. Le bouton "Confirmer la clôture" apparaît pour lancer la validation.
 */
document.addEventListener('DOMContentLoaded', function() {
    let clotureModal, cancelClotureBtn, confirmFinalClotureBtn, clotureBtn, confirmClotureBtnContainer, confirmClotureBtn;
    let caisseSelectionModal;

    // Récupère les éléments du DOM
    clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    
    clotureModal = document.getElementById('cloture-modal');
    cancelClotureBtn = document.getElementById('cancel-cloture-btn');
    confirmFinalClotureBtn = document.getElementById('confirm-final-cloture-btn');
    
    // Création d'un conteneur pour le nouveau bouton de confirmation
    confirmClotureBtnContainer = document.createElement('div');
    confirmClotureBtnContainer.id = 'confirm-cloture-btn-container';
    confirmClotureBtnContainer.style.display = 'none';
    confirmClotureBtnContainer.innerHTML = '<button id="confirm-cloture-btn" class="cloture-btn"><i class="fa-solid fa-check-circle"></i> Confirmer la clôture</button>';
    clotureBtn.parentNode.insertBefore(confirmClotureBtnContainer, clotureBtn.nextSibling);
    confirmClotureBtn = document.getElementById('confirm-cloture-btn');

    const statusIndicator = document.getElementById('websocket-status-indicator');
    const caisseForm = document.getElementById('caisse-form');

    // Les variables d'état sont maintenant globales
    window.currentLockedCaisses = [];
    window.closedCaisses = [];
    
    // NOUVELLE MODALE de sélection de caisse
    caisseSelectionModal = document.createElement('div');
    caisseSelectionModal.id = 'caisse-selection-modal';
    caisseSelectionModal.classList.add('modal');
    document.body.appendChild(caisseSelectionModal);

    /**
     * Vérifie si une caisse est verrouillée par un utilisateur spécifique.
     * @param {string} caisseId
     * @param {string} lockedBy
     * @returns {boolean}
     */
    function isCaisseLockedBy(caisseId, lockedBy) {
        if (!Array.isArray(window.lockedCaisses)) return false;
        return window.lockedCaisses.some(c => c.caisse_id === caisseId && c.locked_by === lockedBy);
    }

    /**
     * Vérifie si une caisse est verrouillée par n'importe quel utilisateur.
     * @param {string} caisseId
     * @returns {boolean}
     */
    function isCaisseLocked(caisseId) {
        if (!Array.isArray(window.lockedCaisses)) return false;
        return window.lockedCaisses.some(c => c.caisse_id === caisseId);
    }
    
    // Fonction pour gérer le verrouillage de l'interface
    function handleInterfaceLock(lockedCaisses, closedCaisses) {
        console.log("handleInterfaceLock called with:", { lockedCaisses, closedCaisses });
        console.log("Mon WebSocket ID:", window.wsConnection?.resourceId);
        
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;
        
        window.lockedCaisses = lockedCaisses || [];
        window.closedCaisses = closedCaisses || [];
        
        // Gère les inputs et les boutons
        document.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => {
            const elId = el.id.split('_');
            const elCaisseId = elId[elId.length - 1];
            
            const isClosed = window.closedCaisses.includes(elCaisseId);
            const isLockedByMe = isCaisseLockedBy(elCaisseId, currentWsId);
            const isLockedByAnother = isCaisseLocked(elCaisseId) && !isLockedByMe;

            if (isClosed || isLockedByAnother) {
                el.disabled = true;
            } else if (isLockedByMe) {
                el.disabled = false;
            } else {
                el.disabled = false;
            }

            // Cas particulier des onglets
            if (el.classList.contains('tab-link')) {
                const tabCaisseId = el.dataset.tab.replace('caisse', '');
                const isTabLockedByMe = isCaisseLockedBy(tabCaisseId, currentWsId);
                const isTabLockedByAnother = isCaisseLocked(tabCaisseId) && !isTabLockedByMe;
                const isTabClosed = window.closedCaisses.includes(tabCaisseId);

                if (isTabClosed || isTabLockedByAnother || (isCaisseLocked(activeCaisseId) && !isTabLockedByMe)) {
                    el.disabled = true;
                } else {
                    el.disabled = false;
                }
            }
        });
    
        // Gère les boutons de clôture
        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
        const isCaisseActiveLockedByMe = isCaisseLockedBy(activeTabCaisseId, currentWsId);
        const isCaisseActiveLocked = isCaisseLocked(activeTabCaisseId);
        const isCaisseActiveClosed = window.closedCaisses.includes(activeCaisseId);
    
        if (isCaisseActiveLockedByMe) {
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Déverrouiller';
            clotureBtn.onclick = () => {
                console.log("Tentative de déverrouillage de la caisse:", activeCaisseId);
                if (window.confirm("Êtes-vous sûr de vouloir déverrouiller cette caisse ?")) {
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeCaisseId }));
                }
            }
            confirmClotureBtnContainer.style.display = 'block';
        } else if (isCaisseActiveLocked) {
            clotureBtn.innerHTML = '<i class="fa-solid fa-user-lock"></i> Forcer le déverrouillage';
            clotureBtn.onclick = () => {
                console.log("Tentative de déverrouillage forcé de la caisse:", activeCaisseId);
                if (window.confirm("Cette caisse est verrouillée par un autre utilisateur. Voulez-vous forcer le déverrouillage ?")) {
                    window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: activeCaisseId }));
                }
            }
            confirmClotureBtnContainer.style.display = 'none';
        } else {
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
            clotureBtn.onclick = () => {
                console.log("Bouton Clôture cliqué. Affichage de la modale de sélection.");
                const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');
                if (isLoadedFromHistory) {
                    alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                    return;
                }
                showCaisseSelectionModal();
            };
            confirmClotureBtnContainer.style.display = 'none';
        }
    
        // Le bouton de clôture reste actif même si la caisse est clôturée
        clotureBtn.disabled = false;
    }
    window.handleInterfaceLock = handleInterfaceLock;
    
    // Événement pour le bouton "Annuler" de la modale
    cancelClotureBtn.addEventListener('click', () => {
        console.log("Cancel button clicked.");
        clotureModal.classList.remove('visible');
    });

    // ÉVÉNEMENT pour le bouton "Confirmer la clôture" de l'interface
    if (confirmClotureBtn) {
        confirmClotureBtn.addEventListener('click', () => {
            console.log("Confirm Cloture button clicked.");
            
            const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
            
            // Affiche la modale de confirmation
            document.querySelector('#cloture-modal h3').textContent = "Confirmation de la clôture";
            document.querySelector('#cloture-modal p').textContent = "Voulez-vous finaliser la clôture de la caisse ? Cette action est irréversible.";
            // On s'assure que les boutons sont dans le bon état
            cancelClotureBtn.style.display = 'block';
            confirmFinalClotureBtn.style.display = 'block';
            
            // Affiche la suggestion de retrait dans la modale
            showWithdrawalSuggestion();

            // Affiche les caisses en attente de clôture
            showOpenCaisses();

            clotureModal.classList.add('visible');
        });
    }

    // Événement pour le bouton "Confirmer la clôture" de la modale
    confirmFinalClotureBtn.addEventListener('click', () => {
        console.log("Confirm Final Cloture button clicked.");
        clotureModal.classList.remove('visible');
        
        if (!caisseForm) {
            alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
            return;
        }

        const activeTabCaisseId = window.lockedCaisses.find(c => c.locked_by === window.wsConnection?.resourceId)?.caisse_id;
        
        // CORRECTION: Vérifier si l'ID de la caisse est valide avant de continuer
        if (!activeTabCaisseId || window.closedCaisses.includes(activeTabCaisseId)) {
            alert("Erreur : ID de caisse invalide ou caisse déjà clôturée.");
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                 window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeTabCaisseId }));
            }
            return;
        }
        
        const formData = new FormData(caisseForm);
        formData.append('caisse_id_a_cloturer', activeTabCaisseId);
        
        // Débogage : Affiche le contenu de FormData dans la console
        for (let pair of formData.entries()) {
            console.log(pair[0]+ ': ' + pair[1]); 
        }

        fetch('index.php?action=cloture', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau lors de la clôture');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(data.message);
                sessionStorage.removeItem('isClotureMode');
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

    /**
     * Affiche la modale de sélection de caisse.
     */
    function showCaisseSelectionModal() {
        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
        const nomsCaisses = config.nomsCaisses || {};
        const currentWsId = window.wsConnection?.resourceId;

        let caisseListHtml = '';
        for (const id in nomsCaisses) {
            const nom = nomsCaisses[id];
            let status = 'Libre';
            let statusClass = 'caisse-status-libre';
            let actionHtml = '';

            const isLockedByMe = isCaisseLockedBy(id, currentWsId);
            const isLockedByAnother = isCaisseLocked(id) && !isLockedByMe;
            const isClosed = window.closedCaisses.includes(id);

            if (isClosed) {
                status = 'Clôturée';
                statusClass = 'caisse-status-cloturee';
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

        // Gère la fermeture de la modale en cliquant en dehors
        window.onclick = function(event) {
            if (event.target == caisseSelectionModal) {
                caisseSelectionModal.classList.remove('visible');
            }
        };

        // Gère la sélection d'une caisse
        caisseSelectionModal.querySelectorAll('.caisse-status-item').forEach(item => {
            item.addEventListener('click', (event) => {
                const caisseId = event.currentTarget.dataset.caisseId;
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
                    
                    // Bascule vers l'onglet de la caisse sélectionnée
                    const targetTabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
                    if (targetTabLink) {
                         targetTabLink.click();
                    }

                    caisseSelectionModal.classList.remove('visible');
                }
            });
        });
        
        // Gère le bouton de déverrouillage forcé dans la modale
        caisseSelectionModal.querySelectorAll('.force-unlock-btn').forEach(btn => {
             btn.addEventListener('click', (event) => {
                 event.stopPropagation(); // Empêche l'événement de se propager au parent
                 const caisseId = btn.dataset.caisse-id;
                 if (window.confirm("Voulez-vous forcer le déverrouillage de cette caisse ?")) {
                     window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: caisseId }));
                     caisseSelectionModal.classList.remove('visible');
                 }
             });
        });
    }

    /**
     * Affiche la suggestion de retrait calculée dans la modale de clôture.
     */
    function showWithdrawalSuggestion() {
        // La logique de calcul est déjà dans calculator-core.js, on la réutilise.
        if (typeof window.calculateAllFull !== 'function') return;

        // On déclenche un calcul pour s'assurer que les données sont à jour
        window.calculateAllFull();

        const activeTab = document.querySelector('.tab-link.active')?.dataset.tab;
        const activeCaisseId = activeTab ? activeTab.replace('caisse', '') : null;
        
        if (!activeCaisseId) return;

        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
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
        const recetteTheorique = ventes + retrocession;
        const recetteReelle = totalCompte - fondDeCaisse;
        const ecart = recetteReelle - recetteTheorique;
        
        const suggestionContainer = document.createElement('div');
        suggestionContainer.innerHTML = `
            <div class="modal-body-content">
                <h4 style="margin-top: 15px;">Détails de la clôture pour la caisse ${config.nomsCaisses[activeCaisseId]}</h4>
                <p><strong>Recette théorique :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(recetteReelle)}</span></p>
                <p><strong>Recette réelle à retirer :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(recetteReelle)}</span></p>
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
        
        // Insère le contenu dans la modale
        const modalBody = document.querySelector('#cloture-modal .modal-content');
        let existingContent = modalBody.querySelector('.modal-body-content');
        if (existingContent) {
             existingContent.remove();
        }
        modalBody.insertAdjacentHTML('beforeend', `<div class="modal-body-content">${suggestionContainer.innerHTML}</div>`);
    }
    
    /**
     * Affiche la liste des caisses qui n'ont pas encore confirmé leur clôture.
     */
    function showOpenCaisses() {
        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
        const caissesOuvertes = Object.keys(config.nomsCaisses).filter(id => !window.closedCaisses.includes(id));
        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
        
        const openCaissesHtml = caissesOuvertes
            .filter(id => id !== activeTabCaisseId)
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

    /**
     * Génère la suggestion de retrait. La fonction a été déplacée ici pour être utilisée
     * par la modale, et non plus par le calculateur-core.js
     */
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
});
