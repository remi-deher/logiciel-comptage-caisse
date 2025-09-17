// Fichier : public/assets/js/logic/calculator-logic.js (Corrigé pour l'initialisation et la communication entre modules)

import { setActiveMessageHandler } from '../main.js';
import { sendWsMessage } from './websocket-service.js';
import { updateClotureUI, initializeCloture, setupGlobalClotureButton } from './cloture-logic.js';

let config = {};
let wsResourceId = null;
// L'état du calculateur est centralisé dans cet objet
let calculatorState = {
    nom_comptage: '',
    explication: '',
    caisse: {}
};
let isDirty = false;

const calculatorPageElement = () => document.getElementById('calculator-page');

// --- Logique d'Autosave ---
async function handleAutosave() {
    if (!isDirty) return;
    const form = document.getElementById('caisse-form');
    if (!form) return;
    const statusElement = document.getElementById('autosave-status');
    if (statusElement) statusElement.textContent = 'Sauvegarde en cours...';
    try {
        const response = await fetch('index.php?route=calculateur/autosave', {
            method: 'POST',
            body: new FormData(form),
            keepalive: true // Important pour les sauvegardes en quittant la page
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        isDirty = false;
        if (statusElement) statusElement.textContent = 'Changements sauvegardés.';
    } catch (error) {
        if (statusElement) statusElement.textContent = 'Erreur de sauvegarde.';
        console.error("Erreur d'autosave :", error);
    }
}

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchCalculatorConfig() {
    const response = await fetch('index.php?route=calculateur/config');
    if (!response.ok) throw new Error('Impossible de charger la configuration du calculateur.');
    return await response.json();
}

// --- Fonctions de Rendu (UI) ---

function createDenominationCard(caisseId, name, value, type) {
    const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
    const inputId = `${name}_${caisseId}`;
    const totalId = `total_${inputId}`;
    const nameAttr = `caisse[${caisseId}][denominations][${name}]`;
    const cardClass = type === 'piece' ? 'is-piece' : '';

    return `
        <div class="denom-card ${cardClass}">
            <div class="denom-card-header">${label}</div>
            <div class="denom-card-body">
                <input type="number" class="quantity-input" data-caisse-id="${caisseId}" id="${inputId}" name="${nameAttr}" min="0" placeholder="0">
            </div>
            <div class="denom-card-footer" id="${totalId}">0,00 €</div>
        </div>`;
}

function renderCalculatorUI() {
    const page = calculatorPageElement();
    if (!page) return;
    const tabSelector = page.querySelector('.tab-selector');
    const ecartContainer = page.querySelector('.ecart-display-container');
    const caissesContainer = page.querySelector('#caisses-content-container');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';

    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        calculatorState.caisse[id] = calculatorState.caisse[id] || { cheques: [], tpe: {} };
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><div id="main-ecart-caisse${id}" class="main-ecart-display"><span class="ecart-label">Écart Espèces</span><span class="ecart-value">0,00 €</span></div><div id="secondary-ecarts-caisse${id}" class="secondary-ecarts"></div></div>`;

        const billetsHtml = Object.entries(config.denominations.billets).map(([name, v]) => createDenominationCard(id, name, v, 'bill')).join('');
        const piecesLooseHtml = Object.entries(config.denominations.pieces).map(([name, v]) => createDenominationCard(id, name, v, 'piece')).join('');

        const especesTabContent = `
            <div class="theoretical-inputs-panel">
                <div class="compact-input-group"><label>Encaissement Espèces Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_especes_${id}" name="caisse[${id}][ventes_especes]"></div>
                <div class="compact-input-group"><label>Rétrocessions en Espèces</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div>
            </div>
            <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-money-bill-wave"></i> Billets <span class="section-total" id="total-billets-${id}">0,00 €</span></h4>
                <div class="denominations-container">${billetsHtml}</div>
            </div>
             <div class="cash-drawer-section">
                <h4><i class="fa-solid fa-coins"></i> Pièces <span class="section-total" id="total-pieces-${id}">0,00 €</span></h4>
                <div class="denominations-container">${piecesLooseHtml}</div>
            </div>
            <div class="cash-drawer-section totals-summary">
                 <div class="summary-line grand-total"><span>Total Espèces Compté</span><span id="total-especes-${id}">0,00 €</span></div>
            </div>`;

        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            calculatorState.caisse[id].tpe[tpeId] = calculatorState.caisse[id].tpe[tpeId] || [];
            return `<div class="tpe-card"><h4>${tpe.nom}</h4><div class="tpe-releves-list" id="tpe-releves-list-${tpeId}-${id}"></div><div class="tpe-releve-form"><input type="text" id="tpe-releve-montant-${tpeId}-${id}" placeholder="Montant du relevé"><button type="button" class="btn new-btn add-tpe-releve-btn" data-caisse-id="${id}" data-terminal-id="${tpeId}"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div id="tpe-hidden-inputs-${tpeId}-${id}"></div></div>`;
        }).join('');
        const tpeSectionHtml = tpePourCaisse.length > 0 ? `<div class="tpe-grid">${tpeHtml}</div>` : '<p>Aucun TPE configuré pour cette caisse.</p>';

        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="form-group compact-input-group" style="max-width:300px;margin-bottom:25px;"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div>
                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}" data-method-key="especes"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb_${id}" data-method-key="cb"><i class="fa-solid fa-credit-card"></i> CB</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}" data-method-key="cheques"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                    </div>
                    <div id="especes_${id}" class="payment-tab-content active">${especesTabContent}</div>
                    <div id="cb_${id}" class="payment-tab-content"><div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement CB Théorique</label><input type="text" data-caisse-id="${id}" id="ventes_cb_${id}" name="caisse[${id}][ventes_cb]"></div></div>${tpeSectionHtml}</div>
                    <div id="cheques_${id}" class="payment-tab-content"></div>
                </div>
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml; 
    ecartContainer.innerHTML = ecartsHtml; 
    caissesContainer.innerHTML = contentHtml;

    Object.keys(config.nomsCaisses).forEach(id => {
        renderChequeList(id);
        Object.keys(calculatorState.caisse[id].tpe).forEach(tpeId => renderTpeList(id, tpeId));
    });
}

function calculateAll() {
    if (!config.nomsCaisses) return;
    Object.keys(config.nomsCaisses).forEach(id => {
        let totalBillets = 0, totalPieces = 0;
        Object.entries(config.denominations.billets).forEach(([name, value]) => {
            const input = document.getElementById(`${name}_${id}`);
            if (input) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(value);
                totalBillets += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne);
            }
        });
        Object.entries(config.denominations.pieces).forEach(([name, value]) => {
            const inputLoose = document.getElementById(`${name}_${id}`);
            if (inputLoose) {
                const quantite = parseInt(inputLoose.value, 10) || 0;
                const totalLigne = quantite * parseFloat(value);
                totalPieces += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne);
            }
        });
        const totalEspeces = totalBillets + totalPieces;
        document.getElementById(`total-billets-${id}`).textContent = formatCurrency(totalBillets);
        document.getElementById(`total-pieces-${id}`).textContent = formatCurrency(totalPieces);
        document.getElementById(`total-especes-${id}`).textContent = formatCurrency(totalEspeces);
        const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${id}`).value);
        const ventesEspeces = parseLocaleFloat(document.getElementById(`ventes_especes_${id}`).value);
        const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${id}`).value);
        const ecartEspeces = (totalEspeces - fondDeCaisse) - (ventesEspeces + retrocession);
        let totalComptéCB = 0;
        const tpeState = calculatorState.caisse[id].tpe;
        if (tpeState) {
            for (const terminalId in tpeState) {
                const releves = tpeState[terminalId];
                if (releves && releves.length > 0) {
                    const dernierReleve = releves[releves.length - 1];
                    totalComptéCB += parseLocaleFloat(dernierReleve.montant);
                }
            }
        }
        const ventesCb = parseLocaleFloat(document.getElementById(`ventes_cb_${id}`).value);
        const ecartCb = totalComptéCB - ventesCb;
        const totalComptéCheques = (calculatorState.caisse[id].cheques || []).reduce((sum, cheque) => sum + parseLocaleFloat(cheque.montant), 0);
        const ventesCheques = parseLocaleFloat(document.getElementById(`ventes_cheques_${id}`).value);
        const ecartCheques = totalComptéCheques - ventesCheques;
        updateEcartDisplay(id, { especes: ecartEspeces, cb: ecartCb, cheques: ecartCheques });
    });
}

function updateEcartDisplay(id, ecarts) {
    const activeTabKey = document.querySelector(`#caisse${id} .payment-tab-link.active`)?.dataset.methodKey || 'especes';
    const mainDisplay = document.getElementById(`main-ecart-caisse${id}`);
    const secondaryContainer = document.getElementById(`secondary-ecarts-caisse${id}`);
    const ecartData = {
        especes: { label: 'Écart Espèces', value: ecarts.especes },
        cb: { label: 'Écart CB', value: ecarts.cb },
        cheques: { label: 'Écart Chèques', value: ecarts.cheques }
    };
    const mainData = ecartData[activeTabKey];
    if (mainDisplay) {
        mainDisplay.querySelector('.ecart-label').textContent = mainData.label;
        mainDisplay.querySelector('.ecart-value').textContent = formatCurrency(mainData.value);
        mainDisplay.className = 'main-ecart-display';
        if (Math.abs(mainData.value) < 0.01) mainDisplay.classList.add('ecart-ok');
        else mainDisplay.classList.add(mainData.value > 0 ? 'ecart-positif' : 'ecart-negatif');
    }
    if (secondaryContainer) {
        let secondaryHtml = '';
        for (const key in ecartData) {
            if (key !== activeTabKey) {
                const data = ecartData[key];
                let className = 'secondary-ecart-item ';
                if (Math.abs(data.value) < 0.01) className += 'ecart-ok';
                else className += (data.value > 0 ? 'ecart-positif' : 'ecart-negatif');
                secondaryHtml += `<div class="${className}"><span>${data.label}:</span> <strong>${formatCurrency(data.value)}</strong></div>`;
            }
        }
        secondaryContainer.innerHTML = secondaryHtml;
    }
}

function renderChequeList(caisseId) {
    const container = document.getElementById(`cheques_${caisseId}`);
    if(!container) return;
    container.innerHTML = `
        <div class="theoretical-inputs-panel"><div class="compact-input-group"><label>Encaissement Chèques Théorique</label><input type="text" data-caisse-id="${caisseId}" id="ventes_cheques_${caisseId}" name="caisse[${caisseId}][ventes_cheques]"></div></div>
        <div class="cheque-section"><div class="cheque-grid"><div class="cheque-form-container"><h4><i class="fa-solid fa-plus-circle"></i> Ajouter un chèque</h4><div class="form-group"><label for="cheque-amount-${caisseId}">Montant</label><input type="text" id="cheque-amount-${caisseId}" placeholder="0,00 ${config.currencySymbol}"></div><div class="form-group"><label for="cheque-comment-${caisseId}">Commentaire</label><input type="text" id="cheque-comment-${caisseId}" placeholder="Chèque n°12345"></div><button type="button" class="btn new-btn add-cheque-btn" data-caisse-id="${caisseId}" style="width: 100%;"><i class="fa-solid fa-plus"></i> Ajouter</button></div><div class="cheque-list-container"><div class="cheque-list-header"><h4><i class="fa-solid fa-list-ol"></i> Chèques Encaissés</h4><div class="cheque-total" id="cheque-total-container-${caisseId}"></div></div><div id="cheque-list-${caisseId}" class="cheque-list"></div><div id="cheque-hidden-inputs-${caisseId}"></div></div></div></div>
    `;
    const listContainer = document.getElementById(`cheque-list-${caisseId}`);
    const totalContainerParent = document.getElementById(`cheque-total-container-${caisseId}`);
    const hiddenInputsContainer = document.getElementById(`cheque-hidden-inputs-${caisseId}`);
    const cheques = calculatorState.caisse[caisseId].cheques || [];
    let totalCheques = 0;
    if (cheques.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun chèque ajouté.</p>';
    } else {
        listContainer.innerHTML = `<table class="cheque-table"><thead><tr><th>Montant</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${cheques.map((cheque, index) => { totalCheques += parseLocaleFloat(cheque.montant); return `<tr><td>${formatCurrency(parseLocaleFloat(cheque.montant))}</td><td>${cheque.commentaire || ''}</td><td class="cheque-actions"><button type="button" class="btn-icon delete-btn delete-cheque-btn" data-caisse-id="${caisseId}" data-index="${index}" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;}).join('')}</tbody></table>`;
    }
    totalContainerParent.innerHTML = `Total (${cheques.length} chèque${cheques.length > 1 ? 's' : ''}): <span id="cheque-total-${caisseId}">${formatCurrency(totalCheques)}</span>`;
    hiddenInputsContainer.innerHTML = cheques.map((cheque, index) => `<input type="hidden" name="caisse[${caisseId}][cheques][${index}][montant]" value="${cheque.montant}"><input type="hidden" name="caisse[${caisseId}][cheques][${index}][commentaire]" value="${cheque.commentaire}">`).join('');
}

function renderTpeList(caisseId, terminalId) {
    const listContainer = document.getElementById(`tpe-releves-list-${terminalId}-${caisseId}`);
    const hiddenContainer = document.getElementById(`tpe-hidden-inputs-${terminalId}-${caisseId}`);
    if (!listContainer || !hiddenContainer) return;

    const releves = (calculatorState.caisse[caisseId].tpe[terminalId] || []).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
    if (releves.length === 0) {
        listContainer.innerHTML = '<p class="empty-list">Aucun relevé pour ce TPE.</p>';
    } else {
        listContainer.innerHTML = `<table class="tpe-table"><thead><tr><th>Heure</th><th>Montant</th><th>Action</th></tr></thead><tbody>${releves.map((releve, index) => {
            const isLast = index === releves.length - 1;
            const rowClass = isLast ? 'releve-actif' : '';
            return `<tr class="${rowClass}"><td>${releve.heure || 'N/A'}</td><td>${formatCurrency(parseLocaleFloat(releve.montant))}</td><td><button type="button" class="btn-icon delete-btn delete-tpe-releve-btn" data-caisse-id="${caisseId}" data-terminal-id="${terminalId}" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
        }).join('')}</tbody></table>`;
    }
    hiddenContainer.innerHTML = releves.map((r, i) => `<input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][montant]" value="${r.montant}"><input type="hidden" name="caisse[${caisseId}][tpe][${terminalId}][${i}][heure]" value="${r.heure}">`).join('');
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'cloture_locked_caisses':
            updateClotureUI(data); 
            break;
        case 'welcome':
            wsResourceId = data.resourceId.toString();
            initializeCloture(config, wsResourceId);
            break;
        case 'full_form_state':
            if (data.cheques) {
                for (const caisseId in data.cheques) {
                    if (calculatorState.caisse.hasOwnProperty(caisseId)) {
                        calculatorState.caisse[caisseId].cheques = data.cheques[caisseId] || [];
                        renderChequeList(caisseId);
                    }
                }
            }
            if (data.tpe) {
                for (const caisseId in data.tpe) {
                    if (calculatorState.caisse.hasOwnProperty(caisseId)) {
                        calculatorState.caisse[caisseId].tpe = data.tpe[caisseId] || {};
                        for(const terminalId in calculatorState.caisse[caisseId].tpe) {
                            renderTpeList(caisseId, terminalId);
                        }
                    }
                }
            }
            if (data.state) {
                for (const id in data.state) {
                    const field = document.getElementById(id);
                    if (field) field.value = data.state[id];
                }
            }
            calculateAll();
            break;
        case 'update':
            if (data.id && document.activeElement && document.activeElement.id !== data.id) {
                const input = document.getElementById(data.id);
                if (input) {
                    input.value = data.value;
                    calculateAll();
                }
            }
            break;
        case 'cheque_update':
            if (data.caisseId && data.cheques && calculatorState.caisse.hasOwnProperty(data.caisseId)) {
                calculatorState.caisse[data.caisseId].cheques = data.cheques;
                renderChequeList(data.caisseId);
                calculateAll();
            }
            break;
         case 'tpe_update':
            if (data.caisseId && data.terminalId && data.releves && calculatorState.caisse[data.caisseId]) {
                calculatorState.caisse[data.caisseId].tpe[data.terminalId] = data.releves;
                renderTpeList(caisseId, data.terminalId);
                calculateAll();
            }
            break;
        case 'reload_page':
            alert("Les données ont été actualisées. La page va être rechargée.");
            window.location.reload();
            break;
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

function attachEventListeners() {
    const page = calculatorPageElement();
    if (!page) return;

    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.beforePageChange = handleAutosave;
    window.addEventListener('beforeunload', () => { if (isDirty) handleAutosave(); });

    page.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('.quantity-input')) {
            e.preventDefault();
            const inputs = Array.from(page.querySelectorAll('.quantity-input:not([disabled])'));
            const currentIndex = inputs.indexOf(e.target);
            const nextInput = inputs[currentIndex + 1];
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            } else {
                document.getElementById('nom_comptage')?.focus();
            }
        }
    });

    page.addEventListener('input', e => {
        if (e.target.matches('input[type="text"], input[type="number"], input[type="time"], textarea')) {
            isDirty = true;
            document.getElementById('autosave-status').textContent = 'Changements non sauvegardés.';
            calculateAll();
            if (e.target.matches('input[type="text"], input[type="number"]')) {
                 sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
            }
        }
    });

    page.addEventListener('click', e => {
        const tabLink = e.target.closest('.tab-link');
        if (tabLink) {
            page.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            tabLink.classList.add('active');
            const tabId = tabLink.dataset.tab;
            document.getElementById(tabId)?.classList.add('active');
            document.getElementById(`ecart-display-${tabId}`)?.classList.add('active');
        }
        const paymentTab = e.target.closest('.payment-tab-link');
        if(paymentTab) {
            const container = paymentTab.closest('.payment-method-tabs');
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            container.querySelector(`#${paymentTab.dataset.paymentTab}`)?.classList.add('active');
            calculateAll();
        }
        const addChequeBtn = e.target.closest('.add-cheque-btn');
        if (addChequeBtn) {
            const caisseId = addChequeBtn.dataset.caisseId;
            const amountInput = document.getElementById(`cheque-amount-${caisseId}`);
            const commentInput = document.getElementById(`cheque-comment-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            if (amount > 0) {
                calculatorState.caisse[caisseId].cheques.push({ montant: amount, commentaire: commentInput.value });
                isDirty = true;
                document.getElementById('autosave-status').textContent = 'Changements non sauvegardés.';
                renderChequeList(caisseId);
                calculateAll();
                sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: calculatorState.caisse[caisseId].cheques });
                amountInput.value = '';
                commentInput.value = '';
                amountInput.focus();
            }
        }
        const deleteChequeBtn = e.target.closest('.delete-cheque-btn');
        if (deleteChequeBtn) {
            const { caisseId, index } = deleteChequeBtn.dataset;
            if (confirm('Voulez-vous vraiment supprimer ce chèque ?')) {
                calculatorState.caisse[caisseId].cheques.splice(index, 1);
                isDirty = true;
                renderChequeList(caisseId);
                calculateAll();
                sendWsMessage({ type: 'cheque_update', caisseId: caisseId, cheques: calculatorState.caisse[caisseId].cheques });
            }
        }
        const addTpeBtn = e.target.closest('.add-tpe-releve-btn');
        if (addTpeBtn) {
            const { caisseId, terminalId } = addTpeBtn.dataset;
            const amountInput = document.getElementById(`tpe-releve-montant-${terminalId}-${caisseId}`);
            const amount = parseLocaleFloat(amountInput.value);
            const currentTime = new Date().toTimeString().slice(0, 5);
            if (amount > 0) {
                calculatorState.caisse[caisseId].tpe[terminalId].push({ montant: amount, heure: currentTime });
                isDirty = true;
                renderTpeList(caisseId, terminalId);
                calculateAll();
                sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: calculatorState.caisse[caisseId].tpe[terminalId] });
                amountInput.value = '';
                amountInput.focus();
            }
        }
        const deleteTpeBtn = e.target.closest('.delete-tpe-releve-btn');
        if (deleteTpeBtn) {
            const { caisseId, terminalId, index } = deleteTpeBtn.dataset;
            calculatorState.caisse[caisseId].tpe[terminalId].splice(index, 1);
            isDirty = true;
            renderTpeList(caisseId, terminalId);
            calculateAll();
            sendWsMessage({ type: 'tpe_update', caisseId, terminalId, releves: calculatorState.caisse[caisseId].tpe[terminalId] });
        }
    });

    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = form.querySelector('.save-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
        try {
            const response = await fetch('index.php?route=calculateur/save', {
                method: 'POST',
                body: new FormData(form)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            isDirty = false;
            document.getElementById('autosave-status').textContent = 'Comptage enregistré !';
            alert('Le comptage a été enregistré avec succès.');
            window.location.href = '/historique';
        } catch (error) {
            alert(`Erreur lors de la sauvegarde : ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Enregistrer le Comptage';
        }
    });
}

export async function initializeCalculator() {
    try {
        config = await fetchCalculatorConfig();
        renderCalculatorUI();

        try {
            const response = await fetch('index.php?route=calculateur/get_initial_data');
            const result = await response.json();
            if (result.success && result.data) {
                const data = result.data;
                calculatorState.nom_comptage = data.nom_comptage;
                calculatorState.explication = data.explication;
                document.getElementById('nom_comptage').value = data.nom_comptage || '';
                document.getElementById('explication').value = data.explication || '';

                for (const caisseId in data) {
                    if (!isNaN(caisseId) && config.nomsCaisses[caisseId]) {
                        calculatorState.caisse[caisseId] = data[caisseId];
                        ['fond_de_caisse', 'ventes_especes', 'ventes_cb', 'retrocession', 'ventes_cheques'].forEach(key => {
                             const field = document.getElementById(`${key}_${caisseId}`);
                             if (field && data[caisseId][key] !== undefined) field.value = data[caisseId][key];
                        });
                        if (data[caisseId].cheques) renderChequeList(caisseId);
                        if (data[caisseId].denominations) {
                             Object.entries(data[caisseId].denominations).forEach(([denom, qty]) => {
                                const denomField = document.getElementById(`${denom}_${caisseId}`);
                                if(denomField) denomField.value = qty;
                             });
                        }
                        if(data[caisseId].tpe) {
                            Object.entries(data[caisseId].tpe).forEach(([terminalId, releves]) => {
                                if(calculatorState.caisse[caisseId].tpe[terminalId] && releves) renderTpeList(caisseId, terminalId);
                            });
                        }
                    }
                }
            }
        } catch(error) { console.error("Erreur chargement données initiales:", error); }

        calculateAll();
        attachEventListeners();
        setActiveMessageHandler(handleWebSocketMessage);
        
        initializeCloture(config, wsResourceId);
        setupGlobalClotureButton();
        
        sendWsMessage({ type: 'get_full_state' });
    } catch (error) {
        console.error("Erreur critique d'initialisation:", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
