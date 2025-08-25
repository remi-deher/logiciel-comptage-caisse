/**
 * Module JavaScript pour la gestion de la communication WebSocket en temps réel.
 */
document.addEventListener('DOMContentLoaded', function() {
    const statusIndicator = document.getElementById('websocket-status-indicator');
    const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
    const isLoadedFromHistory = JSON.parse(document.getElementById('calculator-data')?.dataset.config)?.isLoadedFromHistory;

    if (isLoadedFromHistory) {
        if(statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Consultation';
        }
        return;
    }

    window.isSynchronized = false;
    let syncTimeout;

    window.updateWebsocketStatusIndicator = function(lockedCaisses, closedCaisses) {
        if (!statusIndicator || !statusText) return;
        lockedCaisses = lockedCaisses || [];
        closedCaisses = closedCaisses || [];
        if (lockedCaisses.length > 0) {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('cloture');
            statusText.textContent = 'Clôture en cours...';
        } else if (closedCaisses.length > 0) {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('cloture');
            statusText.textContent = `Caisse(s) clôturée(s): ${closedCaisses.length}`;
        } else {
            statusIndicator.classList.remove('cloture');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connecté en temps réel';
        }
    };

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
            
            // MODIFIÉ : Appel à la nouvelle fonction de chargement initial
            if (typeof window.loadInitialData === 'function') {
                window.loadInitialData();
            }
            
            window.wsConnection.send(JSON.stringify({ type: 'request_state' }));

            syncTimeout = setTimeout(() => {
                console.log("Personne n'a répondu, je suis seul. Le verrou est levé.");
                window.isSynchronized = true;
            }, 1500);
        };

        window.wsConnection.onerror = (error) => {
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

                if (data.type === 'broadcast_state') {
                    console.log("Réception de l'état d'un autre client. Mise à jour et levée du verrou.");
                    if (typeof window.loadFormDataFromWebSocket === 'function') {
                        window.loadFormDataFromWebSocket(data.form_state);
                    }
                    window.isSynchronized = true;
                    clearTimeout(syncTimeout);
                    return;
                }
                
                if (data.type === 'send_full_state' && typeof window.sendFullFormState === 'function') {
                    window.sendFullFormState();
                    return;
                }
                
                if (data.type === 'welcome') {
                    window.wsConnection.resourceId = data.resourceId;
                    return;
                }
                
                if (data.type === 'cloture_locked_caisses') {
                    if (window.handleInterfaceLock) {
                        window.handleInterfaceLock(data.caisses, data.closed_caisses);
                    }
                    if (window.updateWebsocketStatusIndicator) {
                        window.updateWebsocketStatusIndicator(data.caisses, data.closed_caisses);
                    }
                    return;
                }
                
                 if (data.type === 'force_unlocked') {
                    alert(data.message);
                    window.location.reload();
                    return;
                }
                
                if (data.type === 'all_caisses_closed_and_reset') { // Message spécifique pour la réinitialisation
                    if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert("Toutes les caisses ont été clôturées. Le comptage est réinitialisé.", 'success');
                    }
                    // La logique de rechargement est maintenant gérée par la diffusion du nouvel état
                    if (data.newState && typeof window.loadAndInitFormData === 'function') {
                        window.loadAndInitFormData(data.newState);
                    }
                    return;
                }

                if (data.id && typeof data.value !== 'undefined') {
                    const input = document.getElementById(data.id);
                    if (input && input.value !== data.value) {
                        input.value = data.value;
                    }
                }
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

window.sendWsMessage = function(id, value) {
    if (!window.isSynchronized) {
        console.log("Envoi bloqué : en attente de synchronisation.");
        return;
    }
    if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
        const dataToSend = { id: id, value: value };
        const jsonString = JSON.stringify(dataToSend);
        
        window.wsConnection.send(jsonString);
    }
};

// MODIFIÉ : Renommage de la fonction et modification de l'URL du fetch
window.loadInitialData = function() {
    fetch('index.php?action=get_initial_data')
        .then(response => response.json())
        .then(data => {
            if (data && data.success) {
                window.loadAndInitFormData(data.data);
            }
        })
        .catch(error => {
            console.error("Erreur lors du chargement des données initiales:", error);
        });
};
