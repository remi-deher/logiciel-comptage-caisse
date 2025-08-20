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
            console.log("WebSocket connected. Waiting for server ID...");
        };

        window.wsConnection.onerror = (error) => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            console.error("WebSocket Error: Connexion interrompue.", error);
        };

        window.wsConnection.onclose = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            console.log("WebSocket closed.");
        };

        window.wsConnection.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log("Message from WebSocket:", data);
                
                // NOUVEAU : Le serveur envoie un message de bienvenue avec notre ID.
                if (data.type === 'welcome') {
                    window.wsConnection.resourceId = data.resourceId;
                    console.log("Received server ID:", window.wsConnection.resourceId);
                    // On ne fait rien d'autre, le reste du flux gérera l'affichage.
                    return;
                }
                
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
        const dataToSend = { id: id, value: value };
        window.wsConnection.send(JSON.stringify(dataToSend));
    }
};
