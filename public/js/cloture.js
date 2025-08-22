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
    if (!clotureBtn) {
        console.log("[CLOTURE] Bouton de clôture non trouvé. Fin de l'initialisation.");
        return;
    }
    
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
    window.lockedCaisses = [];
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
        // Correction : S'assure que la comparaison se fait entre des chaînes de caractères
        const result = window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by === lockedBy.toString());
        console.log(`[CLOTURE] isCaisseLockedBy(${caisseId}, ${lockedBy}) -> ${result}`);
        return result;
    }

    /**
     * Vérifie si une caisse est verrouillée par n'importe quel utilisateur.
     * @param {string} caisseId
     * @returns {boolean}
     */
    function isCaisseLocked(caisseId) {
        if (!Array.isArray(window.lockedCaisses)) return false;
        const result = window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());
        console.log(`[CLOTURE] isCaisseLocked(${caisseId}) -> ${result}`);
        return result;
    }
    
    // Fonction pour gérer le verrouillage de l'interface
    window.handleInterfaceLock = function (lockedCaisses, closedCaisses) {
        console.log("[CLOTURE] Début de handleInterfaceLock avec :", { lockedCaisses, closedCaisses });
        
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;

        window.lockedCaisses = lockedCaisses || [];
        window.closedCaisses = closedCaisses || [];
        
        // Mettre à jour l'affichage des onglets
        const nomsCaisses = JSON.parse(document.getElementById('calculator-data')?.dataset.config)?.nomsCaisses || {};
        for (const caisseId in nomsCaisses) {
            const tabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
            const badge = document.getElementById(`caisse-status-${caisseId}`);

            const isClosed = window.closedCaisses.includes(caisseId);
            const isLocked = isCaisseLocked(caisseId);
            const isLockedByMe = isCaisseLockedBy(caisseId, currentWsId);

            // Mise à jour de l'affichage du badge
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

            // Mise à jour de l'état "disabled" pour les onglets
            if (tabLink) {
                if (isClosed || (isLocked && !isLockedByMe)) {
                    tabLink.disabled = true;
                } else {
                    tabLink.disabled = false;
                }
            }
        }
        
        // Gère les champs de saisie du formulaire
        document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
            const elId = el.id.split('_');
            const elCaisseId = elId[elId.length - 1];

            const isClosed = window.closedCaisses.includes(elCaisseId);
            const isLockedByMe = isCaisseLockedBy(elCaisseId, currentWsId);
            const isLockedByAnother = isCaisseLocked(elCaisseId) && !isLockedByMe;

            if (isClosed || isLockedByAnother) {
                el.disabled = true;
                // Si la caisse est clôturée, on s'assure qu'elle ne peut pas être vidée
                if (isClosed) {
                     el.readOnly = true;
                }
            } else {
                el.disabled = false;
                el.readOnly = false;
            }
        });
        
        // Gère le bouton de clôture
        if (clotureBtn) {
            const isCaisseActiveClosed = window.closedCaisses.includes(activeCaisseId);
            const isCaisseActiveLockedByMe = isCaisseLockedBy(activeCaisseId, currentWsId);
            const isCaisseActiveLocked = isCaisseLocked(activeCaisseId);
            const formSaveButton = document.querySelector('.save-section .save-btn');
            
            if(formSaveButton) {
                formSaveButton.disabled = isCaisseActiveClosed || (isCaisseActiveLocked && !isCaisseActiveLockedByMe);
            }

            // Correction de la logique ici
            if (isCaisseActiveClosed) {
                 console.log("[CLOTURE] La caisse active est clôturée. Affichage de 'Clôture' mais désactivé.");
                 clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
                 clotureBtn.disabled = true; // Désactive le bouton de clôture pour une caisse déjà clôturée
                 if (confirmClotureBtnContainer) confirmClotureBtnContainer.style.display = 'none';
            } else if (isCaisseActiveLockedByMe) {
                console.log("[CLOTURE] La caisse active est verrouillée par moi. Affichage de 'Déverrouiller'.");
                clotureBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Déverrouiller';
                clotureBtn.onclick = () => {
                    console.log("[CLOTURE] Tentative de déverrouillage de la caisse:", activeCaisseId);
                    if (window.confirm("Êtes-vous sûr de vouloir déverrouiller cette caisse ?")) {
                        window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeCaisseId }));
                    }
                };
                if (confirmClotureBtnContainer) confirmClotureBtnContainer.style.display = 'block';
            } else if (isCaisseActiveLocked && !isCaisseActiveLockedByMe) {
                console.log("[CLOTURE] La caisse active est verrouillée par un autre utilisateur. Affichage de 'Forcer le déverrouillage'.");
                clotureBtn.innerHTML = '<i class="fa-solid fa-user-lock"></i> Forcer le déverrouillage';
                clotureBtn.onclick = () => {
                    console.log("[CLOTURE] Tentative de déverrouillage forcé de la caisse:", activeCaisseId);
                    if (window.confirm("Cette caisse est verrouillée par un autre utilisateur. Voulez-vous forcer le déverrouillage ?")) {
                        window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: activeCaisseId }));
                    }
                };
                if (confirmClotureBtnContainer) confirmClotureBtnContainer.style.display = 'none';
            } else {
                console.log("[CLOTURE] La caisse active est libre. Affichage de 'Clôture'.");
                clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
                clotureBtn.disabled = false;
                clotureBtn.onclick = () => {
                    const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');
                    if (isLoadedFromHistory) {
                        alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                        return;
                    }
                    showCaisseSelectionModal();
                };
                if (confirmClotureBtnContainer) confirmClotureBtnContainer.style.display = 'none';
            }
        }
        console.log("[CLOTURE] Fin de handleInterfaceLock.");
    };
    
    cancelClotureBtn.addEventListener('click', () => {
        console.log("[CLOTURE] Bouton 'Annuler' cliqué.");
        clotureModal.classList.remove('visible');
    });

    if (confirmClotureBtn) {
        confirmClotureBtn.addEventListener('click', () => {
            console.log("[CLOTURE] Bouton 'Confirmer la clôture' cliqué.");
            
            const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
            
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
        console.log("[CLOTURE] Bouton 'Confirmer la clôture' final cliqué.");
        clotureModal.classList.remove('visible');
        
        if (!caisseForm) {
            alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
            return;
        }

        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');
        
        console.log(`[CLOTURE] ID de caisse à clôturer : ${activeTabCaisseId}`);
        console.log(`[CLOTURE] IDs de caisses déjà clôturées : ${window.closedCaisses}`);
        
        if (!activeTabCaisseId || window.closedCaisses.includes(activeTabCaisseId)) {
            console.log("[CLOTURE] Erreur: ID de caisse invalide ou caisse déjà clôturée.");
            alert("Erreur : ID de caisse invalide ou caisse déjà clôturée.");
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                 window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeTabCaisseId }));
            }
            return;
        }
        
        const formData = new FormData(caisseForm);
        formData.append('caisse_id_a_cloturer', activeTabCaisseId);
        
        console.log("[CLOTURE] Envoi de la requête de clôture à l'API PHP.");
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
                console.log("[CLOTURE] Réponse de l'API de clôture réussie:", data);
                alert(data.message);
                sessionStorage.removeItem('isClotureMode');
                if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                    console.log("[CLOTURE] Envoi du message de confirmation de clôture via WebSocket.");
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_caisse_confirmed', caisse_id: activeTabCaisseId }));
                }
            } else {
                console.error("[CLOTURE] Erreur de l'API de clôture:", data.message);
                throw new Error(data.message || 'Erreur inconnue');
            }
        })
        .catch(error => {
            console.error("[CLOTURE] Erreur lors de la requête de clôture:", error);
            alert("Une erreur est survenue lors de la clôture: " + error.message);
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: activeTabCaisseId }));
            }
        });
    });

    function showCaisseSelectionModal() {
        console.log("[CLOTURE] Affichage de la modale de sélection de caisse.");
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

            const isClosed = window.closedCaisses.includes(id);
            const isLocked = isCaisseLocked(id);
            const isLockedByMe = isCaisseLockedBy(id, currentWsId);
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
            } else {
                // Cas où la caisse est libre
                status = 'Libre';
                statusClass = 'caisse-status-libre';
                actionHtml = '';
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
                console.log("[CLOTURE] Clic en dehors de la modale. Fermeture.");
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
                    
                    console.log(`[CLOTURE] Envoi du message 'cloture_lock' pour la caisse ${caisseId}.`);
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
                     console.log(`[CLOTURE] Envoi du message 'force_unlock' pour la caisse ${caisseId}.`);
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
});
