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

    // Variables d'état globales (exposées via window pour l'interopérabilité)
    window.lockedCaisses = [];
    window.closedCaisses = [];

    // Crée la modale de sélection de caisse
    const caisseSelectionModal = document.createElement('div');
    caisseSelectionModal.id = 'caisse-selection-modal';
    caisseSelectionModal.classList.add('modal');
    document.body.appendChild(caisseSelectionModal);

    // Crée la modale de confirmation de clôture
    const clotureConfirmationModal = document.createElement('div');
    clotureConfirmationModal.id = 'cloture-confirmation-modal';
    clotureConfirmationModal.classList.add('modal');
    document.body.appendChild(clotureConfirmationModal);

    // --- NOUVEAU: Fonction pour afficher une alerte personnalisée ---
    function showCustomAlert(message, type = 'success') {
        const existingAlert = document.getElementById('custom-alert-modal');
        if (existingAlert) {
            existingAlert.remove();
        }

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

        // Affiche la modale avec une petite temporisation pour l'animation
        setTimeout(() => alertModal.classList.add('visible'), 10);

        const closeBtn = alertModal.querySelector('.close-alert-btn');
        const closeModal = () => {
            alertModal.classList.remove('visible');
            setTimeout(() => alertModal.remove(), 300);
        };
        
        closeBtn.addEventListener('click', closeModal);
        alertModal.addEventListener('click', (event) => {
            if (event.target === alertModal) {
                closeModal();
            }
        });
    }


    // --- Fonctions de vérification d'état ---
    const isCaisseLockedBy = (caisseId, lockedBy) => {
        if (!Array.isArray(window.lockedCaisses) || !lockedBy) return false;
        return window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString() && c.locked_by.toString() === lockedBy.toString());
    };

    const isCaisseLocked = (caisseId) => {
        if (!Array.isArray(window.lockedCaisses)) return false;
        return window.lockedCaisses.some(c => c.caisse_id.toString() === caisseId.toString());
    };

    // --- Fonctions de gestion de l'interface utilisateur ---
    const updateCaisseTabs = (nomsCaisses, currentWsId) => {
        for (const caisseId in nomsCaisses) {
            const tabLink = document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`);
            const badge = document.getElementById(`caisse-status-${caisseId}`);

            const isClosed = window.closedCaisses.includes(caisseId);
            const isLocked = isCaisseLocked(caisseId);

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
                 tabLink.classList.toggle('cloture-en-cours', isLocked);
                 tabLink.disabled = false;
            }
        }
    };

    const updateFormFields = (currentWsId) => {
        document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
            const elIdParts = el.id.split('_');
            const elCaisseId = elIdParts[elIdParts.length - 1];

            const isClosed = window.closedCaisses.includes(elCaisseId);
            const isLockedByMe = isCaisseLockedBy(elCaisseId, currentWsId);
            const isLockedByAnother = isCaisseLocked(elCaisseId) && !isLockedByMe;

            if (isClosed || isLockedByAnother) {
                el.disabled = true;
                el.readOnly = isClosed;
            } else {
                el.disabled = false;
                el.readOnly = false;
            }
        });
    };

    const updateClotureButton = (activeCaisseId, currentWsId) => {
        const formSaveButton = document.querySelector('.save-section .save-btn');
        if (formSaveButton) {
            const isCaisseActiveClosed = window.closedCaisses.includes(activeCaisseId);
            const isCaisseActiveLockedByAnother = isCaisseLocked(activeCaisseId) && !isCaisseLockedBy(activeCaisseId, currentWsId);
            formSaveButton.disabled = isCaisseActiveClosed || isCaisseActiveLockedByAnother;
        }
        clotureBtn.disabled = false;
        clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
    };

    window.handleInterfaceLock = function (lockedCaisses, closedCaisses) {
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;
        const nomsCaisses = JSON.parse(document.getElementById('calculator-data')?.dataset.config)?.nomsCaisses || {};

        window.lockedCaisses = lockedCaisses || [];
        window.closedCaisses = (closedCaisses || []).map(String);

        updateCaisseTabs(nomsCaisses, currentWsId);
        updateFormFields(currentWsId);
        updateClotureButton(activeCaisseId, currentWsId);
    };

    async function showCaisseSelectionModal() {
        console.log("Ouverture de la modale de sélection de caisse...");
        const configElement = document.getElementById('calculator-data');
        const config = configElement ? JSON.parse(configElement.dataset.config) : {};
        const nomsCaisses = config.nomsCaisses || {};
        const currentWsId = window.wsConnection?.resourceId;
        console.log("ID de connexion WebSocket actuel :", currentWsId);

        try {
            console.log("Récupération de l'état de clôture depuis le serveur...");
            const response = await fetch('index.php?action=get_cloture_state');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            if (data.success) {
                window.lockedCaisses = (data.locked_caisses || []).map(c => ({
                    caisse_id: c.caisse_id.toString(),
                    locked_by: c.locked_by ? c.locked_by.toString() : null
                }));
                window.closedCaisses = (data.closed_caisses || []).map(String);
                console.log("État reçu :", { locked: window.lockedCaisses, closed: window.closedCaisses });
            }
        } catch (e) {
            console.error('Erreur lors de la récupération de l\'état de clôture:', e);
        }

        let caisseListHtml = '';
        for (const id in nomsCaisses) {
            const nom = nomsCaisses[id];
            let statusClass = 'caisse-status-libre';
            let actionHtml = '';

            const isLockedByMe = isCaisseLockedBy(id, currentWsId);
            const isClosed = window.closedCaisses.includes(id);
            const isLocked = isCaisseLocked(id);
            const isLockedByAnother = isLocked && !isLockedByMe;

            if (isClosed) {
                statusClass = 'caisse-status-cloturee';
                actionHtml = `<button class="reopen-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-lock-open"></i> Réouvrir</button>`;
            } else if (isLockedByMe) {
                statusClass = 'caisse-status-en-cours';
                actionHtml = `<button class="confirm-cloture-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-check-circle"></i> Confirmer</button>`;
            } else if (isLockedByAnother) {
                statusClass = 'caisse-status-en-cours';
                actionHtml = `<button class="force-unlock-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-user-lock"></i> Forcer</button>`;
            } else {
                actionHtml = `<button class="lock-caisse-btn action-btn-small" data-caisse-id="${id}"><i class="fa-solid fa-lock"></i> Verrouiller</button>`;
            }

            caisseListHtml += `
                <div class="caisse-status-item ${statusClass}" data-caisse-id="${id}">
                    <div class="status-info">
                        <i class="fa-solid fa-cash-register"></i>
                        <strong>${nom}</strong>
                    </div>
                    <div class="status-actions">
                         ${actionHtml}
                    </div>
                </div>`;
        }

        caisseSelectionModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <div class="modal-header-cloture"><h3>Sélectionnez une caisse à clôturer</h3></div>
                <div class="modal-body-cloture">
                    <p>Cliquez sur une caisse pour démarrer la procédure de clôture et en verrouiller l'accès.</p>
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

    caisseSelectionModal.addEventListener('click', function(event) {
        const target = event.target;
        console.log("Clic détecté dans la modale de sélection. Cible :", target);

        if (target.classList.contains('modal-close') || target.id === 'caisse-selection-modal') {
            console.log("Action : Fermeture de la modale de sélection.");
            caisseSelectionModal.classList.remove('visible');
            return;
        }

        const caisseItem = target.closest('.caisse-status-item');
        if (caisseItem) {
            event.stopPropagation();
            const caisseId = caisseItem.dataset.caisseId;
            const button = caisseItem.querySelector('button.action-btn-small');

            if (!button || !caisseId) {
                console.error("Bouton ou ID de caisse manquant pour l'item cliqué.", caisseItem);
                return;
            }

            console.log(`Item de caisse cliqué. Caisse ID: ${caisseId}, Action: ${button.className}`);

            if (button.classList.contains('lock-caisse-btn')) {
                console.log(`Action : Verrouiller la caisse ${caisseId}`);
                if (window.wsConnection?.readyState === WebSocket.OPEN) {
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_lock', caisse_id: caisseId }));
                }
                document.querySelector(`.tab-link[data-tab="caisse${caisseId}"]`)?.click();
                caisseSelectionModal.classList.remove('visible');
            } else if (button.classList.contains('confirm-cloture-caisse-btn')) {
                console.log(`Action : Confirmer la clôture pour la caisse ${caisseId}`);
                caisseSelectionModal.classList.remove('visible');
                showClotureConfirmationModal(caisseId);
            } else if (button.classList.contains('force-unlock-btn')) {
                console.log(`Action : Forcer le déverrouillage pour la caisse ${caisseId}`);
                if (window.confirm("Voulez-vous forcer le déverrouillage de cette caisse ?")) {
                    if (window.wsConnection?.readyState === WebSocket.OPEN) {
                        window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: caisseId }));
                    }
                    caisseSelectionModal.classList.remove('visible');
                }
            } else if (button.classList.contains('reopen-caisse-btn')) {
                console.log(`Action : Réouvrir la caisse ${caisseId}`);
                if (window.confirm("Voulez-vous vraiment réouvrir cette caisse ?")) {
                    if (window.wsConnection?.readyState === WebSocket.OPEN) {
                        window.wsConnection.send(JSON.stringify({ type: 'cloture_reopen', caisse_id: caisseId }));
                    }
                    caisseSelectionModal.classList.remove('visible');
                }
            }
        }
    });

    function showClotureConfirmationModal(caisseId) {
        if (!caisseId) return;
        console.log(`Affichage de la modale de confirmation pour la caisse ${caisseId}`);

        const config = JSON.parse(document.getElementById('calculator-data').dataset.config);
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

        updateConfirmationModalDetails(caisseId);
        clotureConfirmationModal.classList.add('visible');
    }

    clotureConfirmationModal.addEventListener('click', function(event) {
        const target = event.target;
        console.log("Clic détecté dans la modale de confirmation. Cible :", target);

        if (target.classList.contains('modal-close') || target.id === 'cloture-confirmation-modal') {
            console.log("Action : Fermeture de la modale de confirmation.");
            clotureConfirmationModal.classList.remove('visible');
            return;
        }

        const button = target.closest('button.btn');
        if (button) {
            const caisseId = button.dataset.caisseId;
            if (!caisseId) {
                console.error("ID de caisse manquant sur le bouton de la modale de confirmation.");
                return;
            }

            if (button.id === 'cancel-cloture-btn') {
                console.log(`Action : Annuler la clôture pour la caisse ${caisseId}`);
                clotureConfirmationModal.classList.remove('visible');
                if (window.wsConnection?.readyState === WebSocket.OPEN) {
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: caisseId }));
                    console.log(`Message WebSocket 'cloture_unlock' envoyé pour la caisse ${caisseId}.`);
                }
            } else if (button.id === 'confirm-final-cloture-btn') {
                console.log(`Action : Confirmation finale de la clôture pour la caisse ${caisseId}`);
                clotureConfirmationModal.classList.remove('visible');
                const formData = new FormData(document.getElementById('caisse-form'));
                formData.append('caisse_id_a_cloturer', caisseId);

                fetch('index.php?action=cloture', { method: 'POST', body: formData })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showCustomAlert(data.message, 'success');
                            if (window.wsConnection?.readyState === WebSocket.OPEN) {
                                window.wsConnection.send(JSON.stringify({ type: 'cloture_caisse_confirmed', caisse_id: caisseId }));
                                console.log(`Message WebSocket 'cloture_caisse_confirmed' envoyé pour la caisse ${caisseId}.`);
                            }
                        } else {
                            throw new Error(data.message || 'Erreur inconnue');
                        }
                    })
                    .catch(error => {
                        showCustomAlert("Erreur lors de la clôture : " + error.message, 'error');
                        if (window.wsConnection?.readyState === WebSocket.OPEN) {
                            window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock', caisse_id: caisseId }));
                        }
                    });
            }
        }
    });


    function updateConfirmationModalDetails(caisseId) {
        if (typeof window.calculateAllFull !== 'function') return;
        window.calculateAllFull();

        const config = JSON.parse(document.getElementById('calculator-data').dataset.config);
        const { denominations, minToKeep, currencySymbol, nomsCaisses } = config;

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
        const ventes = getVal('ventes');
        const retrocession = getVal('retrocession');
        const recetteReelle = totalCompte - fondDeCaisse;
        const ecart = recetteReelle - (ventes + retrocession);

        let contentHtml = `<div class="modal-body-content">
            <h4>Détails de la clôture</h4>
            <p><strong>Recette théorique :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ventes + retrocession)}</span></p>
            <p><strong>Recette réelle (à retirer) :</strong> <span>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(recetteReelle)}</span></p>
            <p><strong>Écart :</strong> <span style="color: ${ecart > 0.01 ? 'var(--color-warning)' : (ecart < -0.01 ? 'var(--color-danger)' : 'var(--color-success)')};">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ecart)}</span></p>
        </div>`;

        if (Math.abs(ecart) < 0.01) {
            const suggestions = generateWithdrawalSuggestion(recetteReelle, currentCounts, denominations, minToKeep);
            let hasSuggestions = Object.values(suggestions).some(q => q > 0);
            if (hasSuggestions) {
                // MODIFICATION: Utilisation d'un tableau pour un meilleur affichage
                contentHtml += `<div class="modal-body-content"><h4>Composition du retrait</h4><table class="withdrawal-suggestion-table">
                    <thead><tr><th>Dénomination</th><th>Quantité à retirer</th></tr></thead><tbody>`;
                
                const allDenominationsSorted = [
                    ...Object.entries(denominations.billets),
                    ...Object.entries(denominations.pieces)
                ].sort((a, b) => b[1] - a[1]);

                allDenominationsSorted.forEach(([name, value]) => {
                    if (suggestions[name] > 0) {
                        const label = value >= 1 ? `${value} ${currencySymbol}` : `${value * 100} cts`;
                        contentHtml += `<tr><td>${label}</td><td>${suggestions[name]}</td></tr>`;
                    }
                });

                contentHtml += `</tbody></table></div>`;
            }
        }
        
        const caissesOuvertes = Object.keys(nomsCaisses).filter(id => !window.closedCaisses.includes(id) && id.toString() !== caisseId.toString());
        if (caissesOuvertes.length > 0) {
            contentHtml += `<div class="modal-body-content"><h4>Clôture en attente pour :</h4><ul>`;
            contentHtml += caissesOuvertes.map(id => `<li>${nomsCaisses[id]}</li>`).join('');
            contentHtml += `</ul></div>`;
        }

        clotureConfirmationModal.querySelector('.modal-body-content-wrapper').innerHTML = contentHtml;
    }

    function generateWithdrawalSuggestion(amountToWithdraw, currentCounts, denominations, minToKeep) {
        let remainingAmount = amountToWithdraw;
        const suggestions = {};
        const allDenominations = [...Object.entries(denominations.billets), ...Object.entries(denominations.pieces)].sort((a, b) => b[1] - a[1]);

        for (const [name, value] of allDenominations) {
            if (remainingAmount < value) continue;
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

    clotureBtn.addEventListener('click', () => {
        if (document.getElementById('calculator-data')?.dataset.config.includes('"isLoadedFromHistory":true')) {
            showCustomAlert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.", 'error');
            return;
        }
        showCaisseSelectionModal();
    });

}); // FIN: Assurez-vous que cette ligne est bien présente et ferme le addEventListener.
