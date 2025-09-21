// Fichier : public/assets/js/logic/websocket-service.js (Version Corrigée et Verbosifiée)

let wsConnection = null;

export function initializeWebSocket(onMessageHandler) {
    return new Promise((resolve, reject) => {
        const statusIndicator = document.getElementById('websocket-status-indicator');
        const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
        if (!statusIndicator || !statusText) {
            console.error("[WebSocket] ERREUR: L'indicateur de statut de la connexion est introuvable sur la page.");
            return reject(new Error("Indicateur de statut non trouvé."));
        }

        if (wsConnection && wsConnection.readyState < 2) {
            console.log("[WebSocket] Une connexion existante est déjà active.");
            return resolve(wsConnection);
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/`;
        
        console.log(`[WebSocket] Tentative de connexion à l'adresse : ${wsUrl}`);
        statusText.textContent = 'Connexion...';
        
        try {
            wsConnection = new WebSocket(wsUrl);

            wsConnection.onopen = () => {
                statusIndicator.classList.remove('disconnected', 'error');
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connecté';
                console.log('%c[WebSocket] Connexion établie avec succès.', 'color: green; font-weight: bold;');
                
                // --- CORRECTION AJOUTÉE ICI ---
                // On envoie la demande d'état initial seulement APRÈS la confirmation de connexion.
                sendWsMessage({ type: 'get_full_state' });
                
                resolve(wsConnection);
            };

            wsConnection.onerror = (error) => {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Erreur';
                console.error('[WebSocket] Une erreur de connexion est survenue :', error);
                reject(new Error("La connexion WebSocket a échoué."));
            };

            wsConnection.onclose = (event) => {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
                console.warn(`[WebSocket] La connexion a été fermée. Code: ${event.code}, Raison: ${event.reason}`);
            };

            wsConnection.onmessage = (event) => {
                const parsedData = JSON.parse(event.data);
                console.log('%c[WebSocket] Message Reçu <<', 'color: blue; font-weight: bold;', parsedData);

                if (typeof onMessageHandler === 'function') {
                    onMessageHandler(parsedData);
                }
            };

        } catch (e) {
            statusText.textContent = 'Échec';
            console.error("[WebSocket] Impossible d'initialiser la connexion :", e);
            reject(e);
        }
    });
}

export function sendWsMessage(message) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        console.log('%c[WebSocket] Message Envoyé >>', 'color: orange; font-weight: bold;', message);
        wsConnection.send(JSON.stringify(message));
    } else {
        console.warn('[WebSocket] Tentative d\'envoi de message, mais la connexion n\'est pas (encore) ouverte. État actuel :', wsConnection?.readyState);
    }
}
