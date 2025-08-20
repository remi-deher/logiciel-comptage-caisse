/**
 * Module JavaScript pour la gestion de la communication WebSocket en temps réel.
 * Ce module est responsable de la connexion et de la diffusion des données.
 */
document.addEventListener('DOMContentLoaded', function() {
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    const isLoadedFromHistory = JSON.parse(document.getElementById('calculator-data')?.dataset.config)?.isLoadedFromHistory;

    // Si on est en mode consultation, on ne se connecte pas au temps réel
    if (isLoadedFromHistory) {
        if(statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Consultation';
        }
        return;
    }

    try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/`;
        window.wsConnection = new WebSocket(wsUrl);

        window.wsConnection.onopen = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('disconnected');
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connecté en temps réel';
            }
            // NOUVEAU: Attribue un ID unique à la connexion
            window.wsConnection.resourceId = Math.random().toString(36).substring(2, 15);
        };

        window.wsConnection.onerror = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
        };

        window.wsConnection.onclose = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
        };

        window.wsConnection.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                
                // NOUVEAU: Gère l'état de verrouillage de la clôture
                if (data.type === 'lock_status') {
                    if (window.handleInterfaceLock) {
                        window.handleInterfaceLock(data.caisse_id, data.locked_by);
                    }
                    return; // Ne pas traiter comme une mise à jour de formulaire
                }
                
                // Si on a le statut de verrouillage au premier chargement, on le gère
                if (data.cloture_lock_status) {
                    if (window.handleInterfaceLock) {
                        window.handleInterfaceLock(data.cloture_lock_status.caisse_id, data.cloture_lock_status.locked_by);
                    }
                    delete data.cloture_lock_status;
                }
                
                // NOUVEAU: Gère les messages de refus de déverrouillage
                if (data.type === 'unlock_refused') {
                    alert("Erreur: " + data.message);
                    return;
                }
                
                // NOUVEAU: Gère les messages de déverrouillage forcé
                 if (data.type === 'force_unlocked') {
                    alert(data.message);
                    window.location.reload();
                    return;
                }

                if (data.id && typeof data.value !== 'undefined') {
                    const input = document.getElementById(data.id);
                    if (input && input.value !== data.value) {
                        input.value = data.value;
                    }
                } else {
                    for (const fieldId in data) {
                        const input = document.getElementById(fieldId);
                        if (input) input.value = data[fieldId];
                    }
                }
                // Déclenche un recalcul dans l'autre module
                if (typeof window.calculateAllFull === 'function') {
                    window.calculateAllFull();
                }
            } catch (error) {
                console.error("Erreur de parsing JSON WebSocket:", error);
            }
        };
    } catch (e) {
        console.error("Impossible d'initialiser la connexion WebSocket:", e);
        if (statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Erreur de connexion';
        }
    }
});

// Fonctions utilitaires pour envoyer des données depuis d'autres modules
window.sendWsMessage = function(id, value) {
    if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
        // NOUVEAU: On envoie l'id de la connexion pour permettre au serveur de vérifier les permissions
        const dataToSend = { id: id, value: value, resourceId: window.wsConnection.resourceId };
        window.wsConnection.send(JSON.stringify(dataToSend));
    }
};
