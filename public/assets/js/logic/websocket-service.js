// Fichier : public/assets/js/logic/websocket-service.js (Version Corrigée avec Promise)

let wsConnection = null;

export function initializeWebSocket(onMessageHandler) {
    // On retourne une promesse pour pouvoir attendre que la connexion soit établie
    return new Promise((resolve, reject) => {
        const statusIndicator = document.getElementById('websocket-status-indicator');
        const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
        if (!statusIndicator || !statusText) {
            return reject(new Error("Indicateur de statut non trouvé."));
        }

        if (wsConnection && wsConnection.readyState < 2) {
            return resolve(wsConnection);
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/`;
        
        console.log(`[WebSocket] Tentative de connexion à : ${wsUrl}`);
        statusText.textContent = 'Connexion...';
        
        try {
            wsConnection = new WebSocket(wsUrl);

            wsConnection.onopen = () => {
                statusIndicator.classList.remove('disconnected', 'error');
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connecté';
                console.log('%c[WebSocket] Connexion établie avec succès.', 'color: green; font-weight: bold;');
                resolve(wsConnection); // La promesse est résolue, on peut continuer
            };

            wsConnection.onerror = (error) => {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Erreur';
                console.error('[WebSocket] Une erreur est survenue :', error);
                reject(new Error("La connexion WebSocket a échoué.")); // La promesse échoue
            };

            wsConnection.onclose = (event) => {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
                console.warn(`[WebSocket] Connexion fermée.`);
                // Pas de reconnexion automatique ici pour éviter les boucles
            };

            wsConnection.onmessage = (event) => {
                console.log('%c[WebSocket] Message Reçu <<', 'color: blue;', JSON.parse(event.data));
                if (typeof onMessageHandler === 'function') {
                    onMessageHandler(event);
                }
            };

        } catch (e) {
            statusText.textContent = 'Échec';
            console.error("[WebSocket] Impossible d'initialiser la connexion :", e);
            reject(e); // La promesse échoue
        }
    });
}

export function sendWsMessage(message) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        console.log('%c[WebSocket] Message Envoyé >>', 'color: orange;', message);
        wsConnection.send(JSON.stringify(message));
    } else {
        // On ne considère plus cela comme une erreur, car cela peut arriver si la connexion se coupe.
        console.warn('[WebSocket] Tentative d\'envoi de message, mais la connexion n\'est pas ouverte.');
    }
}
