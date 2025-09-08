// Fichier : public/assets/js/logic/cloture-logic.js (Adapté pour le nouvel assistant)

import { sendWsMessage } from './websocket-service.js';

let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null;
let isClotureInitialized = false;

/**
 * Met à jour l'interface utilisateur en fonction de l'état de clôture reçu (caisses verrouillées/fermées).
 * @param {object} newState L'objet d'état reçu via WebSocket.
 */
export function updateClotureUI(newState) {
    lockedCaisses = newState.caisses || [];
    closedCaisses = (newState.closed_caisses || []).map(String);

    // Mettre à jour les onglets des caisses
    document.querySelectorAll('.tab-link').forEach(tab => {
        const caisseId = tab.dataset.caisseId;
        tab.classList.remove('cloturee', 'cloture-en-cours');
        if (closedCaisses.includes(caisseId)) {
            tab.classList.add('cloturee');
        } else if (lockedCaisses.some(c => c.caisse_id.toString() === caisseId)) {
            tab.classList.add('cloture-en-cours');
        }
    });

    // Désactiver les champs des caisses verrouillées ou fermées
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
 * Au clic, il sauvegarde l'état du formulaire du calculateur et redirige vers l'assistant.
 */
export function setupGlobalClotureButton() {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;

    clotureBtn.addEventListener('click', async () => {
        if (!isClotureInitialized) {
            alert("La fonction de clôture est uniquement disponible sur la page du Calculateur.");
            return;
        }

        const form = document.getElementById('caisse-form');
        if (form) {
            const formData = new FormData(form);
            const data = {};
            for (const [key, value] of formData.entries()) {
                // Transformer caisse[1][b500] en un objet imbriqué
                const match = key.match(/(\w+)\[(\d+)\]\[(\w+)\]/);
                if (match) {
                    const [, mainKey, id, subKey] = match;
                    if (!data[mainKey]) data[mainKey] = {};
                    if (!data[mainKey][id]) data[mainKey][id] = {};
                    data[mainKey][id][subKey] = value;
                } else {
                    data[key] = value;
                }
            }
            
            // Sauvegarde les données dans sessionStorage pour que l'assistant y accède
            sessionStorage.setItem('calculatorFormData', JSON.stringify(data));
            
            // Redirige vers la nouvelle page de l'assistant
            window.location.href = '/cloture-wizard';
        }
    });
}

/**
 * Initialise la logique de clôture en stockant la configuration et l'ID de ressource WebSocket.
 * @param {object} appConfig La configuration de l'application.
 * @param {string} wsResourceId L'ID unique de la connexion WebSocket.
 */
export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
    isClotureInitialized = true;
}
