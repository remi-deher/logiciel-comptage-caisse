// Fichier : public/assets/js/logic/cloture-logic.js (Version Finale avec correctif de l'import)

import { sendWsMessage } from './websocket-service.js';
// La ligne `import { handleAllCaissesClosed } from './calculator-logic.js';` a été supprimée car la fonction est maintenant dans ce fichier.
import { calculateWithdrawalSuggestion } from './cloture-wizard-service.js';
import { formatCurrency } from '../utils/formatters.js';

let config = {};
let lockedCaisses = [];
let closedCaisses = [];
let resourceId = null;
let isClotureInitialized = false;

export function setClotureReady(isReady) {
    const clotureBtn = document.getElementById('cloture-btn');
    isClotureInitialized = isReady;
    if (clotureBtn) {
        clotureBtn.disabled = !isReady;
        clotureBtn.title = isReady ? "Lancer le processus de clôture" : "Nécessite une connexion en temps réel active.";
    }
}

// La fonction handleAllCaissesClosed est maintenant ici, donc elle n'a plus besoin d'être importée.
async function performFinalCloture() {
    if (!confirm("Êtes-vous sûr de vouloir finaliser la journée ? Cette action créera le comptage 'Clôture Générale' et préparera le fond de caisse pour J+1.")) return;
    const btn = document.getElementById('trigger-final-cloture');
    btn.disabled = true;
    btn.textContent = 'Finalisation...';
    try {
        const response = await fetch('index.php?route=cloture/confirm_generale', { method: 'POST' });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        alert(result.message);
        sendWsMessage({ type: 'force_reload_all' });
        window.location.reload();
    } catch (error) {
        alert(`Erreur: ${error.message}`);
        btn.disabled = false;
        btn.textContent = 'Finaliser la journée';
    }
}

export function handleAllCaissesClosed(isAllClosed) {
    const existingBanner = document.getElementById('final-cloture-banner');
    const container = document.getElementById('history-view-banner-container');
    if (isAllClosed && !existingBanner && container) {
        const bannerHtml = `
            <div id="final-cloture-banner" class="history-view-banner" style="background-color: rgba(39, 174, 96, 0.1); border-color: var(--color-success);">
                <i class="fa-solid fa-flag-checkered" style="color: var(--color-success);"></i>
                <div>
                    <strong style="color: var(--color-success);">Toutes les caisses sont clôturées !</strong>
                    <p>Vous pouvez maintenant finaliser la journée ou consulter les suggestions de retrait.</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="show-global-suggestion-btn" class="btn new-btn">
                        <i class="fa-solid fa-eye"></i> Afficher les Suggestions
                    </button>
                    <button id="trigger-final-cloture" class="btn save-btn">Finaliser la journée</button>
                </div>
            </div>`;
        container.innerHTML = bannerHtml;
    } else if (!isAllClosed && existingBanner) {
        existingBanner.remove();
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

    document.querySelectorAll('#caisse-form input, #caisse-form textarea, #caisse-form button').forEach(field => {
        const fieldCaisseId = field.dataset.caisseId || field.name.match(/caisse\[(\d+)\]/)?.[1];
        if (!fieldCaisseId) return;

        const isClosed = closedCaisses.includes(fieldCaisseId);
        const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === caisseId);
        const isLockedByOther = lockInfo && lockInfo.locked_by && String(lockInfo.locked_by) !== String(resourceId);
        
        field.disabled = isClosed || isLockedByOther;
        const parentContainer = field.closest('.form-group, .compact-input-group, .denom-card, .cheque-section, .tpe-card');
        if (parentContainer) {
            parentContainer.style.opacity = (isClosed || isLockedByOther) ? '0.7' : '1';
            parentContainer.title = isClosed ? 'Cette caisse est clôturée.' : (isLockedByOther ? 'Cette caisse est en cours de modification.' : '');
        }
    });

    updateSuggestionBanner();

    const totalCaisses = Object.keys(config.nomsCaisses || {}).length;
    const allClosed = totalCaisses > 0 && closedCaisses.length === totalCaisses;
    handleAllCaissesClosed(allClosed);
}

function updateSuggestionBanner() {
    const activeTab = document.querySelector('.tab-link.active');
    const bannerContainer = document.getElementById('history-view-banner-container');
    if (!activeTab || !bannerContainer) return;
    
    const activeCaisseId = activeTab.dataset.caisseId;
    
    if (closedCaisses.includes(activeCaisseId)) {
        bannerContainer.innerHTML = `
            <div class="history-view-banner">
                <i class="fa-solid fa-flag-checkered"></i>
                <div>
                    <strong>Cette caisse est clôturée.</strong>
                    <p>Le comptage est finalisé. Vous pouvez consulter à nouveau la suggestion de retrait.</p>
                </div>
                <button id="show-suggestion-btn" class="btn new-btn" data-caisse-id="${activeCaisseId}">
                    <i class="fa-solid fa-eye"></i> Afficher la suggestion
                </button>
            </div>`;
    } else if (!document.getElementById('final-cloture-banner')) {
        bannerContainer.innerHTML = '';
    }
}

async function showWithdrawalSuggestion(caisseId) {
    const modal = document.getElementById('suggestion-modal');
    const modalTitle = document.getElementById('suggestion-modal-title');
    const modalBody = document.getElementById('suggestion-modal-body');
    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = `Suggestion pour "${config.nomsCaisses[caisseId]}"`;
    modalBody.innerHTML = '<p>Chargement de la suggestion...</p>';
    modal.classList.add('visible');

    try {
        const response = await fetch(`index.php?route=calculateur/get_closed_caisse_data&caisse_id=${caisseId}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const caisseData = result.data;
        const suggestionResult = calculateWithdrawalSuggestion(caisseData, config);

        let bodyHtml = '';
        if (suggestionResult.suggestions.length > 0) {
            const rows = suggestionResult.suggestions.map(s => {
                const label = s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`;
                return `<tr><td>Retirer ${s.qty} x ${label}</td><td>${formatCurrency(s.total)}</td></tr>`;
            }).join('');
            bodyHtml = `<table class="suggestion-table"><thead><tr><th>Dénomination</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="suggestion-total">Total à retirer : <span>${formatCurrency(suggestionResult.totalToWithdraw)}</span></div>`;
        } else {
            bodyHtml = `<p>Aucun retrait n'était nécessaire pour ce comptage.</p>`;
        }
        
        modalBody.innerHTML = bodyHtml;

    } catch (error) {
        modalBody.innerHTML = `<p class="error">Impossible de charger la suggestion : ${error.message}</p>`;
    }
}

export function setupGlobalClotureButton() {
    document.addEventListener('click', (e) => {
        const calculatorPage = document.getElementById('calculator-page');
        if (!calculatorPage) return;

        const suggestionBtn = e.target.closest('#show-suggestion-btn');
        if (suggestionBtn) {
            const caisseId = suggestionBtn.dataset.caisseId;
            showWithdrawalSuggestion(caisseId);
        }

        const globalSuggestionBtn = e.target.closest('#show-global-suggestion-btn');
        if(globalSuggestionBtn) {
            const firstClosedCaisseId = closedCaisses[0];
            if(firstClosedCaisseId) {
                showWithdrawalSuggestion(firstClosedCaisseId);
            }
        }
        
        if (e.target.closest('#trigger-final-cloture')) {
            performFinalCloture();
        }

        if (e.target.matches('#suggestion-modal-close') || e.target.id === 'suggestion-modal') {
            document.getElementById('suggestion-modal')?.classList.remove('visible');
        }
    });

    const tabSelector = document.querySelector('.tab-selector');
    if (tabSelector) {
        tabSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                setTimeout(updateSuggestionBanner, 50);
            }
        });
    }

    const clotureBtn = document.getElementById('cloture-btn');
    if (clotureBtn) {
        clotureBtn.addEventListener('click', async () => {
            if (!isClotureInitialized) {
                alert("La fonction de clôture nécessite une connexion en temps réel active.");
                return;
            }
            clotureBtn.disabled = true;
            clotureBtn.innerHTML = '<i class="fa-solid fa-save"></i> Sauvegarde...';
            try {
                const form = document.getElementById('caisse-form');
                if (form) {
                    const formData = new FormData(form);
                    const response = await fetch('index.php?route=calculateur/autosave', { method: 'POST', body: formData });
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message || 'La sauvegarde a échoué.');
                }
                window.location.href = '/cloture-wizard';
            } catch (error) {
                alert(`Erreur: Impossible de sauvegarder avant la clôture. ${error.message}`);
                clotureBtn.disabled = false;
                clotureBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Clôture';
            }
        });
    }
}

export function initializeCloture(appConfig, wsResourceId) {
    config = appConfig;
    resourceId = wsResourceId;
}
