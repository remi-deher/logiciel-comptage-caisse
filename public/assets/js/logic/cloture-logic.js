// Fichier : public/assets/js/logic/cloture-logic.js (Corrigé pour une activation sécurisée)

import { sendWsMessage } from './websocket-service.js';

let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null;
let isClotureInitialized = false; // Reste faux par défaut

/**
 * NOUVELLE FONCTION : Active ou désactive l'état de préparation à la clôture.
 * C'est cette fonction qui sera appelée par le calculateur pour activer le bouton.
 * @param {boolean} isReady - Indique si la clôture peut être initiée.
 */
export function setClotureReady(isReady) {
    const clotureBtn = document.getElementById('cloture-btn');
    isClotureInitialized = isReady;
    if (clotureBtn) {
        if (isReady) {
            clotureBtn.disabled = false;
            clotureBtn.title = "Lancer le processus de clôture";
        } else {
            clotureBtn.disabled = true;
            // Message plus générique
            clotureBtn.title = "Nécessite une connexion en temps réel active.";
        }
    }
}

/**
 * Met à jour l'interface utilisateur en fonction de l'état de clôture reçu (caisses verrouillées/fermées).
 * @param {object} newState L'objet d'état reçu via WebSocket.
 */
export function updateClotureUI(newState) {
    lockedCaisses = newState.caisses || [];
    closedCaisses = (newState.closed_caisses || []).map(String);

    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        tab.classList.remove('cloturee', 'cloture-en-cours');
        if (closedCaisses.includes(caisseId)) {
            tab.classList.add('cloturee');
        } else if (lockedCaisses.some(c => c.caisse_id.toString() === caisseId)) {
            tab.classList.add('cloture-en-cours');
        }
    });

    document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(field => {
        const fieldCaisseId = field.dataset.caisseId || field.name.match(/caisse\[(\d+)\]/)?.[1];
        if (!fieldCaisseId) return;

        const isClosed = closedCaisses.includes(fieldCaisseId);
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === fieldCaisseId);
        const isLockedByOther = lockInfo && lockInfo.locked_by.toString() !== resourceId.toString();
        
        field.disabled = isClosed || isLockedByOther;
        const parentFormGroup = field.closest('.form-group');
        if (parentFormGroup) {
            parentFormGroup.style.opacity = (isClosed || isLockedByOther) ? '0.7' : '1';
            parentFormGroup.title = isClosed ? 'Cette caisse est clôturée.' : (isLockedByOther ? 'Cette caisse est en cours de modification par un autre utilisateur.' : '');
        }
    });
}

/**
 * Configure le bouton de clôture global dans la barre de navigation.
 */
export function setupGlobalClotureButton() {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;

    clotureBtn.addEventListener('click', async () => {
        if (!isClotureInitialized) {
            alert("La fonction de clôture est uniquement disponible sur la page du Calculateur et nécessite que la connexion en temps réel soit active.");
            return;
        }

        const form = document.getElementById('caisse-form');
        if (form) {
            const formData = new FormData(form);
            const data = { caisse: {} };
            for (const [key, value] of formData.entries()) {
                const match = key.match(/caisse\[(\d+)\]\[(\w+)\]/);
                if (match) {
                    const [, id, subKey] = match;
                    if (!data.caisse[id]) data.caisse[id] = {};
                    data.caisse[id][subKey] = value;
                } else {
                    const tpeMatch = key.match(/(tpe_\d+_\d+)/);
                     if (tpeMatch) {
                        const tpeId = tpeMatch[1];
                        const caisseId = tpeId.split('_')[2];
                        if (!data.caisse[caisseId]) data.caisse[caisseId] = {};
                        data.caisse[caisseId][tpeId] = value;
                     } else {
                        data[key] = value;
                     }
                }
            }
            
            sessionStorage.setItem('calculatorFormData', JSON.stringify(data));
            window.location.href = '/cloture-wizard';
        }
    });
}

/**
 * Initialise la logique de clôture en stockant la configuration et l'ID de ressource WebSocket.
 */
export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
    // On n'active PAS isClotureInitialized ici directement.
}
