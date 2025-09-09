// Fichier : public/assets/js/logic/cloture-logic.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';
import { handleAllCaissesClosed } from './calculator-logic.js';

let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null;
let isClotureInitialized = false;

export function setClotureReady(isReady) {
    const clotureBtn = document.getElementById('cloture-btn');
    isClotureInitialized = isReady;
    if (clotureBtn) {
        if (isReady) {
            clotureBtn.disabled = false;
            clotureBtn.title = "Lancer le processus de clôture";
        } else {
            clotureBtn.disabled = true;
            clotureBtn.title = "Nécessite une connexion en temps réel active.";
        }
    }
}

export function updateClotureUI(newState) {
    if (!newState) return;

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
        
        const isLockedByOther = lockInfo && lockInfo.locked_by && String(lockInfo.locked_by) !== String(resourceId);
        
        field.disabled = isClosed || isLockedByOther;
        const parentFormGroup = field.closest('.form-group');
        if (parentFormGroup) {
            parentFormGroup.style.opacity = (isClosed || isLockedByOther) ? '0.7' : '1';
            parentFormGroup.title = isClosed ? 'Cette caisse est clôturée.' : (isLockedByOther ? `Cette caisse est en cours de modification par un autre utilisateur.` : '');
        }
    });

    if (config.nomsCaisses) {
        const totalCaisses = Object.keys(config.nomsCaisses).length;
        if (totalCaisses > 0 && closedCaisses.length === totalCaisses) {
            handleAllCaissesClosed(true);
        } else {
            handleAllCaissesClosed(false);
        }
    }
}

export function setupGlobalClotureButton() {
    const clotureBtn = document.getElementById('cloture-btn');
    if (!clotureBtn) return;

    clotureBtn.addEventListener('click', () => {
        if (!isClotureInitialized) {
            alert("La fonction de clôture nécessite que la connexion en temps réel soit active.");
            return;
        }

        // On n'a plus besoin de sauvegarder manuellement la session,
        // l'autosave en BDD s'en est déjà chargé.
        window.location.href = '/cloture-wizard';
    });
}

export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
}
