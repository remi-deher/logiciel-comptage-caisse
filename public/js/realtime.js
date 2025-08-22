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

    // Si on est en mode consultation, on ne se connecte pas au temps réel
    if (isLoadedFromHistory) {
        if(statusIndicator) {
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Consultation';
        }
        return;
    }

    // NOUVEAU: Variable pour suivre si des données initiales ont été reçues
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
            // Envoie une demande d'état au serveur.
            window.wsConnection.send(JSON.stringify({ type: 'request_state' }));

            // Lance un minuteur pour vérifier si des données initiales sont reçues
            initialDataTimeout = setTimeout(() => {
                if (!hasReceivedInitialData) {
                    // Correction: on ne recharge plus la page, on charge directement la sauvegarde auto
                    if(typeof window.loadLastAutosave === 'function') {
                         window.loadLastAutosave();
                    }
                }
            }, 3000); // Délai de 3 secondes
        };

        window.wsConnection.onerror = (error) => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            // Annule le minuteur en cas d'erreur de connexion
            if (initialDataTimeout) clearTimeout(initialDataTimeout);
            console.error("WebSocket Error: Connexion interrompue.", error);
        };

        window.wsConnection.onclose = () => {
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
                statusText.textContent = 'Déconnecté';
            }
            // Annule le minuteur en cas de fermeture de la connexion
            if (initialDataTimeout) clearTimeout(initialDataTimeout);
        };

        window.wsConnection.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                
                // Un message est reçu, donc d'autres clients sont connectés
                // Correction: ne pas mettre hasReceivedInitialData à true pour les messages send_full_state
                if (data.type !== 'send_full_state') {
                    hasReceivedInitialData = true;
                    if (initialDataTimeout) clearTimeout(initialDataTimeout);
                }
                
                // NOUVEAU: Le serveur nous demande d'envoyer notre état complet
                if (data.type === 'send_full_state' && typeof window.sendFullFormState === 'function') {
                    window.sendFullFormState();
                    return;
                }
                
                // NOUVEAU: Le serveur nous envoie l'état complet du formulaire
                if (data.type === 'broadcast_state' && typeof window.loadFormDataFromWebSocket === 'function') {
                    window.loadFormDataFromWebSocket(data.form_state);
                    return;
                }
                
                // NOUVEAU: Le serveur envoie un message de bienvenue avec notre ID.
                if (data.type === 'welcome') {
                    window.wsConnection.resourceId = data.resourceId;
                    return;
                }
                
                // Gère le statut de verrouillage et des caisses clôturées
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
                
                // Gère le statut de verrouillage au premier chargement
                if (data.cloture_locked_caisses) {
                    if (window.handleInterfaceLock) {
                        window.handleInterfaceLock(data.cloture_locked_caisses, data.closed_caisses);
                    }
                    delete data.cloture_locked_caisses;
                }
                
                 // Gère les messages de déverrouillage forcé
                 if (data.type === 'force_unlocked') {
                    alert(data.message);
                    window.location.reload();
                    return;
                }
                
                // Si toutes les caisses sont clôturées, on recharge la page
                if (data.type === 'all_caisses_closed') {
                    alert('Toutes les caisses ont été clôturées. L\'application va être réinitialisée.');
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
                console.error("[WS] Erreur de parsing JSON WebSocket:", error);
            }
        };
    } catch (e) {
        console.error("[WS] Impossible d'initialiser la connexion WebSocket:", e);
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
        const jsonString = JSON.stringify(dataToSend);
        
        window.wsConnection.send(jsonString);
    }
};

// NOUVEAU: Fonction pour charger la dernière sauvegarde automatique
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
            console.error("[WS] Erreur lors du chargement de la sauvegarde automatique:", error);
        });
};
