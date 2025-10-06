// tests/js/websocket-service.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// On va importer les fonctions dynamiquement à l'intérieur des tests
// pour pouvoir les réinitialiser.
let initializeWebSocket, sendWsMessage;

// On garde une référence à notre instance de WebSocket simulée
let mockWebSocketInstance = null;

// Simulation (Mock) de la classe WebSocket
class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0; // 0 = CONNECTING
        this.send = jest.fn();
        mockWebSocketInstance = this; // On stocke l'instance pour y accéder dans les tests
    }

    // Fonctions de simulation pour déclencher les événements depuis nos tests
    _open() {
        this.readyState = 1; // 1 = OPEN
        if (this.onopen) this.onopen();
    }
    _message(data) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
    }
    _error(error) {
        if (this.onerror) this.onerror(error);
    }

    // Callbacks vides
    onopen = () => {};
    onmessage = () => {};
    onerror = () => {};
    onclose = () => {};
}

// On assigne notre classe simulée au scope global
global.WebSocket = MockWebSocket;
// *** LA CORRECTION CRUCIALE EST ICI ***
// On définit la constante manquante dans l'environnement de test Node.js
global.WebSocket.OPEN = 1;


describe('websocket-service', () => {
    
    beforeEach(async () => {
        // Prépare le DOM nécessaire avant chaque test
        document.body.innerHTML = `
            <div id="websocket-status-indicator">
                <span class="status-text"></span>
            </div>`;
        
        // Réinitialise les modules pour s'assurer que la variable 'wsConnection' est nulle
        jest.resetModules();
        
        // Réimporte dynamiquement le module pour avoir une version "fraîche"
        const webSocketService = await import('../../public/assets/js/logic/websocket-service.js');
        initializeWebSocket = webSocketService.initializeWebSocket;
        sendWsMessage = webSocketService.sendWsMessage;
    });

    afterEach(() => {
        mockWebSocketInstance = null;
    });

    it('devrait se connecter et résoudre la promesse après le message de bienvenue', async () => {
        const handler = jest.fn();
        const promise = initializeWebSocket(handler);

        // On attend que les tâches asynchrones se lancent
        await new Promise(process.nextTick);

        // On simule le cycle de vie : ouverture, puis message
        mockWebSocketInstance._open();
        mockWebSocketInstance._message({ type: 'welcome', resourceId: 'client-123' });
        
        // On attend que la promesse soit résolue
        await promise;

        const statusText = document.querySelector('.status-text');
        expect(statusText.textContent).toBe('Connecté');
        expect(handler).toHaveBeenCalledWith({ type: 'welcome', resourceId: 'client-123' });
    });

    it('devrait envoyer un message si la connexion est ouverte', async () => {
        // Initialise et attend la connexion complète
        const promise = initializeWebSocket(() => {});
        await new Promise(process.nextTick);
        mockWebSocketInstance._open();
        mockWebSocketInstance._message({ type: 'welcome', resourceId: 'client-123' });
        await promise;

        const message = { type: 'update', data: 'test' };
        sendWsMessage(message);

        expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('ne devrait pas envoyer de message si la connexion n\'est pas ouverte', async () => {
        initializeWebSocket(() => {});
        await new Promise(process.nextTick);
        
        const message = { type: 'test' };
        sendWsMessage(message);

        expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });

    it('devrait rejeter la promesse en cas d\'erreur de connexion', async () => {
        const promise = initializeWebSocket(() => {});
        await new Promise(process.nextTick);

        // Simule une erreur
        mockWebSocketInstance._error(new Error('Erreur de connexion simulée'));

        await expect(promise).rejects.toThrow("La connexion WebSocket a échoué.");
        const statusText = document.querySelector('.status-text');
        expect(statusText.textContent).toBe('Erreur');
    });
});
