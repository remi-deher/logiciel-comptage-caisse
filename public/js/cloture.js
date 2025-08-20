/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 */
document.addEventListener('DOMContentLoaded', function() {
    let clotureModal, cancelClotureBtn, startClotureBtn, confirmFinalClotureBtn, clotureBtn;
    let isClotureMode = sessionStorage.getItem('isClotureMode') === 'true';

    // Récupère les éléments du DOM
    clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;
    
    clotureModal = document.getElementById('cloture-modal');
    cancelClotureBtn = document.getElementById('cancel-cloture-btn');
    startClotureBtn = document.getElementById('start-cloture-btn');
    confirmFinalClotureBtn = document.getElementById('confirm-final-cloture-btn');

    const statusIndicator = document.getElementById('websocket-status-indicator');
    const caisseForm = document.getElementById('caisse-form');
    
    let currentLockedCaisseId = null;
    let currentLockerId = null;

    // Fonction pour gérer le verrouillage de l'interface
    function handleInterfaceLock(caisseId, lockedBy) {
        const activeTab = document.querySelector('.tab-link.active');
        const activeCaisseId = activeTab ? activeTab.dataset.tab.replace('caisse', '') : null;
        const currentWsId = window.wsConnection?.resourceId;
        
        // Met à jour l'état de verrouillage global
        currentLockedCaisseId = caisseId;
        currentLockerId = lockedBy;
        
        const isCaisseLockedByAnother = (caisseId && lockedBy !== currentWsId);

        document.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => {
            el.disabled = false;
        });
        
        if (isCaisseLockedByAnother) {
             // Désactive tous les champs si une caisse est verrouillée par un autre utilisateur
             document.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => {
                 el.disabled = true;
             });
        }
    
        // Gère le bouton de clôture
        if (isCaisseLockedByAnother) {
            clotureBtn.disabled = true;
            clotureBtn.textContent = "Caisse verrouillée par un autre utilisateur";
        } else if (caisseId && lockedBy === currentWsId) {
             clotureBtn.disabled = false;
             clotureBtn.textContent = "Finaliser la clôture";
        } else {
            clotureBtn.disabled = false;
            clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
        }
    }
    window.handleInterfaceLock = handleInterfaceLock;
    
    // --- NOUVEAU: Logique du bouton de clôture ---
    clotureBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('.tab-link.active');
        if (!activeTab) {
            alert("Veuillez sélectionner une caisse d'abord.");
            return;
        }
        const activeCaisseId = activeTab.dataset.tab.replace('caisse', '');
        const currentWsId = window.wsConnection?.resourceId;

        // Vérifie si la caisse est déjà verrouillée par un autre
        if (currentLockedCaisseId && currentLockerId !== currentWsId) {
            alert("Cette caisse est déjà en mode clôture sur un autre poste.");
            return;
        }

        // Si la caisse est verrouillée par nous-mêmes, on passe à l'étape finale
        if (currentLockedCaisseId === activeCaisseId && currentLockerId === currentWsId) {
             // 2ème clic: Confirmation finale
             document.querySelector('#cloture-modal h3').textContent = "Confirmer la clôture finale";
             document.querySelector('#cloture-modal p').textContent = "Souhaitez-vous valider la clôture des caisses et les réinitialiser ?";
             startClotureBtn.style.display = 'none';
             confirmFinalClotureBtn.style.display = 'block';
             clotureModal.classList.add('visible');
        } else {
            // Sinon, on envoie la requête de verrouillage
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_lock', caisse_id: activeCaisseId }));
            }
            // Affiche la modale de lancement du mode clôture
            document.querySelector('#cloture-modal h3').textContent = "Commencer la clôture";
            document.querySelector('#cloture-modal p').textContent = "Voulez-vous passer en mode clôture pour vérifier le comptage avant de valider ?";
            startClotureBtn.style.display = 'block';
            confirmFinalClotureBtn.style.display = 'none';
            clotureModal.classList.add('visible');
        }
    });

    cancelClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');
        // Si l'utilisateur annule, on envoie une requête de déverrouillage
        if (currentLockerId === window.wsConnection?.resourceId) {
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
            }
        }
    });

    startClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');
        // Ne fait rien ici, la requête de verrouillage a déjà été envoyée
        // On attend la réponse du serveur pour mettre l'interface à jour
    });

    confirmFinalClotureBtn.addEventListener('click', () => {
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
            // Si la clôture échoue, on déverrouille pour permettre à l'utilisateur de corriger
            if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
                window.wsConnection.send(JSON.stringify({ type: 'cloture_unlock' }));
            }
        });
    });
    
});
