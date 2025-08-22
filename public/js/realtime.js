/**
 * Module JavaScript pour la gestion de la communication WebSocket en temps réel.
 * Ce module est responsable de la connexion et de la diffusion des données.
 *
 * Logique mise à jour pour gérer le statut de clôture persistant.
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

    let hasReceivedInitialData = false;
    let initialDataTimeout;

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
            window.wsConnection.send(JSON.stringify({ type: 'request_state' }));

            initialDataTimeout = setTimeout(() => {
                if (!hasReceivedInitialData) {
                    if(typeof window.loadLastAutosave === 'function') {
                         window.loadLastAutosave();
                    }
                }
            }, 3000);
        };

        window.wsConnection.onerror = (error) => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            if (initialDataTimeout) clearTimeout(initialDataTimeout);
        };

        window.wsConnection.onclose = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            if (initialDataTimeout) clearTimeout(initialDataTimeout);
        };

        window.wsConnection.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                
                if (data.type !== 'send_full_state') {
                    hasReceivedInitialData = true;
                    if (initialDataTimeout) clearTimeout(initialDataTimeout);
                }
                
                if (data.type === 'send_full_state' && typeof window.sendFullFormState === 'function') {
                    window.sendFullFormState();
                    return;
                }
                
                if (data.type === 'broadcast_state' && typeof window.loadFormDataFromWebSocket === 'function') {
                    window.loadFormDataFromWebSocket(data.form_state);
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
                    if (Array.isArray(data.caisses) && data.caisses.length > 0) {
                        statusIndicator.classList.remove('connected');
                        statusIndicator.classList.add('cloture');
                        statusText.textContent = 'Clôture en cours...';
                    } else if (Array.isArray(data.closed_caisses) && data.closed_caisses.length > 0) {
                         statusIndicator.classList.remove('connected');
                         statusIndicator.classList.add('cloture');
                         statusText.textContent = `Caisse(s) clôturée(s): ${data.closed_caisses.length}`;
                    } else {
                         statusIndicator.classList.remove('cloture');
                         statusIndicator.classList.add('connected');
                         statusText.textContent = 'Connecté en temps réel';
                    }
                    return;
                }
                
                if (data.cloture_locked_caisses) {
                    if (window.handleInterfaceLock) {
                        window.handleInterfaceLock(data.cloture_locked_caisses, data.closed_caisses);
                    }
                    delete data.cloture_locked_caisses;
                }
                
                 if (data.type === 'force_unlocked') {
                    alert(data.message);
                    window.location.reload();
                    return;
                }
                
                if (data.type === 'all_caisses_closed') {
                    alert('Toutes les caisses ont été clôturées. Le comptage est réinitialisé.');
                    if (typeof window.resetAllCaisseFields === 'function') {
                        window.resetAllCaisseFields();
                    }
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
    if (window.wsConnection && window.wsConnection.readyState === WebSocket.OPEN) {
        const dataToSend = { id: id, value: value };
        const jsonString = JSON.stringify(dataToSend);
        
        window.wsConnection.send(jsonString);
    }
};

window.loadLastAutosave = function() {
    fetch('index.php?action=get_last_autosave_data')
        .then(response => response.json())
        .then(data => {
            if (data && data.success) {
                window.loadAndInitFormData(data.data);
            } else {
            }
        })
        .catch(error => {
            console.error("Erreur lors du chargement de la sauvegarde automatique:", error);
        });
};
