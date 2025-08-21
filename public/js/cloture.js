/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 *
 * Logique de clôture mise à jour :
 * 1. Clic sur le bouton "Clôture" active le mode clôture (verrouillage).
 * 2. Un bouton "Confirmer la clôture" apparaît.
 * 3. Clic sur "Confirmer la clôture" ouvre une modale avec la suggestion de retrait.
 * 4. Après confirmation, les données sont envoyées au serveur et les caisses sont remises à zéro.
 */
document.addEventListener('DOMContentLoaded', function() {
    let clotureModal, cancelClotureBtn, confirmFinalClotureBtn, clotureBtn, confirmClotureBtnContainer, confirmClotureBtn;

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
    window.currentLockedCaisseId = null;
    window.currentLockerId = null;

    // Fonction pour gérer le verrouillage de l'interface
    function handleInterfaceLock(caisseId, lockedBy) {
        console.log("handleInterfaceLock called with:", { caisseId, lockedBy });
        console.log("Mon WebSocket ID:", window.wsConnection?.resourceId);
        
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;
        
        // Met à jour l'état de verrouillage global
        window.currentLockedCaisseId = caisseId;
        window.currentLockerId = lockedBy;
        
        const isCaisseLockedByAnother = (caisseId && lockedBy !== currentWsId);
        
        // Gère les inputs et les boutons
        document.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => {
            const elId = el.id.split('_');
            const elCaisseId = elId[elId.length - 1];
            
            // Si une caisse est verrouillée
            if (caisseId) {
                // Si l'utilisateur est l'initiateur du verrouillage
                if (lockedBy === currentWsId) {
                    // Les champs de la caisse verrouillée sont actifs
                    if (elCaisseId === caisseId) {
                        el.disabled = false;
                    } else {
                        // Les autres caisses ne sont pas modifiables
                        el.disabled = true;
                    }
                } else {
                    // C'est un autre utilisateur qui a verrouillé
                    if (elCaisseId === caisseId) {
                        // La caisse verrouillée est en lecture seule
                        el.disabled = true;
                    } else {
                        // Les autres caisses restent modifiables
                        el.disabled = false;
                    }
                }
            } else {
                // Aucune caisse n'est verrouillée, tout est actif
                el.disabled = false;
            }

            // Cas particulier des onglets
            if (el.classList.contains('tab-link')) {
                // Le PC qui a verrouillé la caisse ne peut pas changer d'onglet
                if (caisseId && lockedBy === currentWsId && el.dataset.tab.replace('caisse', '') !== caisseId) {
                    el.disabled = true;
                } else {
                    el.disabled = false;
                }
            }
        });
    
        // Gère le bouton de clôture
        const activeTabCaisseId = document.querySelector('.tab-link.active')?.dataset.tab.replace('caisse', '');

        // Crée les boutons
        const defaultBtn = '<i class="fa-solid fa-lock"></i> Clôture';
        const unlockBtn = '<i class="fa-solid fa-lock-open"></i> Déverrouiller';
        const forceUnlockBtn = '<i class="fa-solid fa-user-lock"></i> Forcer le déverrouillage';

        // Gère les boutons en bas de la page
        if (window.currentLockedCaisseId === activeTabCaisseId) {
             if (window.currentLockerId === currentWsId) {
                 clotureBtn.innerHTML = unlockBtn;
                 clotureBtn.onclick = () => {
                      if (window.confirm("Êtes-vous sûr de vouloir déverrouiller cette caisse ?")) {
                         window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
                      }
                 }
                 // Affiche le bouton "Confirmer la clôture" et le met à jour
                 confirmClotureBtnContainer.style.display = 'block';
                 confirmClotureBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirmer la clôture';
             } else {
                clotureBtn.innerHTML = forceUnlockBtn;
                clotureBtn.onclick = () => {
                    if (window.confirm("Cette caisse est verrouillée par un autre utilisateur. Voulez-vous forcer le déverrouillage ?")) {
                         window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: activeTabCaisseId }));
                    }
                }
                // Cache le bouton "Confirmer la clôture" pour les non-initiateurs
                confirmClotureBtnContainer.style.display = 'none';
             }
        } else {
             clotureBtn.innerHTML = defaultBtn;
             clotureBtn.onclick = () => {
                const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');
                if (isLoadedFromHistory) {
                    alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                    return;
                }
                if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_lock', caisse_id: activeTabCaisseId }));
                }
             };
             // Cache le bouton "Confirmer la clôture" par défaut
             confirmClotureBtnContainer.style.display = 'none';
        }
    }
    window.handleInterfaceLock = handleInterfaceLock;
    
    // Événement pour le bouton "Annuler" de la modale
    cancelClotureBtn.addEventListener('click', () => {
        console.log("Cancel button clicked. currentLockedCaisseId:", window.currentLockedCaisseId);
        clotureModal.classList.remove('visible');
    });

    // NOUVEL ÉVÉNEMENT pour le bouton "Confirmer la clôture" de l'interface
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

            clotureModal.classList.add('visible');
        });
    }

    // Événement pour le bouton "Confirmer la clôture" de la modale
    confirmFinalClotureBtn.addEventListener('click', () => {
        console.log("Confirm Final Cloture button clicked.");
        clotureModal.classList.remove('visible');
        
        if (statusIndicator) {
            statusIndicator.classList.remove('cloture');
            statusIndicator.classList.add('connected');
            statusIndicator.querySelector('.status-text').textContent = 'Clôture en cours...';
        }
        
        if (!caisseForm) {
            alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
            return;
        }
        const formData = new FormData(caisseForm);
        
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
                    window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
                }
                window.location.reload();
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        })
        .catch(error => {
            alert("Une erreur est survenue lors de la clôture: " + error.message);
            if (statusIndicator) {
                statusIndicator.classList.remove('cloture');
                statusIndicator.classList.add('connected');
                statusIndicator.querySelector('.status-text').textContent = 'Connecté en temps réel';
            }
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
            }
        });
    });

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
        const modalBody = document.querySelector('#cloture-modal .modal-content .modal-body-content');
        if (modalBody) {
             modalBody.remove(); // Retire l'ancienne suggestion
        }
        clotureModal.querySelector('.modal-content').insertAdjacentHTML('beforeend', `<div class="modal-body-content">${suggestionContainer.innerHTML}</div>`);
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
