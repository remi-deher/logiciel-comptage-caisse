/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 */
document.addEventListener('DOMContentLoaded', function() {
    let clotureModal, cancelClotureBtn, startClotureBtn, confirmFinalClotureBtn, clotureBtn;
    
    // Récupère les éléments du DOM
    clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    
    clotureModal = document.getElementById('cloture-modal');
    cancelClotureBtn = document.getElementById('cancel-cloture-btn');
    startClotureBtn = document.getElementById('start-cloture-btn');
    confirmFinalClotureBtn = document.getElementById('confirm-final-cloture-btn');

    const statusIndicator = document.getElementById('websocket-status-indicator');
    const caisseForm = document.getElementById('caisse-form');
    
    // NOUVEAU: Les variables d'état sont maintenant globales
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
             } else {
                clotureBtn.innerHTML = forceUnlockBtn;
                clotureBtn.onclick = () => {
                    if (window.confirm("Cette caisse est verrouillée par un autre utilisateur. Voulez-vous forcer le déverrouillage ?")) {
                         window.wsConnection.send(JSON.stringify({ type: 'force_unlock', caisse_id: activeTabCaisseId }));
                    }
                }
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
                // Affiche la modale de lancement du mode clôture
                document.querySelector('#cloture-modal h3').textContent = "Commencer la clôture";
                document.querySelector('#cloture-modal p').textContent = "Voulez-vous passer en mode clôture pour vérifier le comptage avant de valider ?";
                startClotureBtn.style.display = 'block';
                confirmFinalClotureBtn.style.display = 'none';
                clotureModal.classList.add('visible');
             };
        }
    }
    window.handleInterfaceLock = handleInterfaceLock;
    
    // NOUVEAU: Logique du bouton de clôture
    
    // Événement pour le bouton "Annuler" de la modale
    cancelClotureBtn.addEventListener('click', () => {
        console.log("Cancel button clicked. currentLockedCaisseId:", window.currentLockedCaisseId);
        clotureModal.classList.remove('visible');
        if (window.currentLockedCaisseId && window.currentLockerId === window.wsConnection?.resourceId) {
            window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
        }
    });

    // Événement pour le bouton "Commencer la clôture" de la modale
    startClotureBtn.addEventListener('click', () => {
        console.log("Start Cloture button clicked.");
        clotureModal.classList.remove('visible');
        // Ne fait rien ici, la requête de verrouillage a déjà été envoyée
    });

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
    
});
