/**
 * Module JavaScript pour la gestion de la communication WebSocket en temps réel.
 * Ce module est responsable de la connexion et de la diffusion des données.
 *
 * Logique MISE A JOUR :
 * 1. Charge la sauvegarde locale pour un affichage immédiat.
 * 2. Met en place un verrou pour empêcher l'envoi de données.
 * 3. Demande l'état aux autres clients.
 * 4. Si un autre client répond, ses données deviennent la source de vérité et le verrou est levé.
 * 5. Si personne ne répond après un délai, l'utilisateur est considéré comme seul et le verrou est levé.
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

    // NOUVEAU : Verrou pour empêcher l'envoi de données avant la synchronisation.
    window.isSynchronized = false;
    let syncTimeout;

    // Fonction globale pour mettre à jour l'indicateur de statut
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
            
            // 1. Charge la sauvegarde immédiatement.
            if (typeof window.loadLastAutosave === 'function') {
                window.loadLastAutosave();
            }
            
            // 2. Demande l'état aux autres clients.
            window.wsConnection.send(JSON.stringify({ type: 'request_state' }));

            // 3. Met en place un timeout. Si personne ne répond, on est seul.
            syncTimeout = setTimeout(() => {
                console.log("Personne n'a répondu, je suis seul. Le verrou est levé.");
                window.isSynchronized = true;
            }, 1500); // Délai de 1.5 secondes
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

                // 4. On reçoit l'état d'un autre client (la source de vérité).
                if (data.type === 'broadcast_state') {
                    console.log("Réception de l'état d'un autre client. Mise à jour et levée du verrou.");
                    if (typeof window.loadFormDataFromWebSocket === 'function') {
                        window.loadFormDataFromWebSocket(data.form_state);
                    }
                    window.isSynchronized = true; // On lève le verrou
                    clearTimeout(syncTimeout); // On annule le timeout
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
                
                if (data.type === 'all_caisses_closed') {
                    if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert("Toutes les caisses ont été clôturées. Le comptage est réinitialisé.", 'success');
                    } else {
                        alert('Toutes les caisses ont été clôturées. Le comptage est réinitialisé.');
                    }
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

// NOUVEAU : La fonction d'envoi de message vérifie maintenant le verrou.
window.sendWsMessage = function(id, value) {
    if (!window.isSynchronized) {
        console.log("Envoi bloqué : en attente de synchronisation.");
        return; // Ne rien envoyer si le verrou est actif
    }
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
            }
        })
        .catch(error => {
            console.error("Erreur lors du chargement de la sauvegarde automatique:", error);
        });
};
