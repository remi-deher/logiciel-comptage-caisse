// Fichier : public/assets/js/logic/websocket-service.js

let wsConnection = null;

/**
 * Initialise et établit la connexion WebSocket avec le serveur.
 * @param {function} onMessageHandler La fonction à appeler lorsqu'un message est reçu.
 */
export function initializeWebSocket(onMessageHandler) {
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;

    if (!statusIndicator || !statusText) return;

    // Assure qu'il n'y a qu'une seule connexion active
    if (wsConnection && wsConnection.readyState < 2) {
        return wsConnection;
    }

    // Détermine le protocole (ws:// ou wss://) et l'URL du serveur WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // L'URL du serveur WebSocket. Le '/ws/' est géré par la configuration de Nginx/Apache.
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/`;
    
    statusText.textContent = 'Connexion...';
    
    try {
        wsConnection = new WebSocket(wsUrl);

        wsConnection.onopen = () => {
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connecté';
            console.log('Connexion WebSocket établie.');
        };

        wsConnection.onerror = (error) => {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Erreur';
            console.error('Erreur WebSocket:', error);
        };

        wsConnection.onclose = () => {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Déconnecté';
            console.log('Connexion WebSocket fermée.');
        };

        // Transfère la gestion des messages à la fonction fournie en paramètre
        wsConnection.onmessage = (event) => {
            if (typeof onMessageHandler === 'function') {
                onMessageHandler(event);
            }
        };
        
        return wsConnection;

    } catch (e) {
        statusText.textContent = 'Échec';
        console.error("Impossible d'initialiser la connexion WebSocket:", e);
        return null;
    }
}

/**
 * Envoie un message au serveur WebSocket si la connexion est active.
 * @param {object} message L'objet JavaScript à envoyer (sera converti en JSON).
 */
export function sendWsMessage(message) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify(message));
    }
}
