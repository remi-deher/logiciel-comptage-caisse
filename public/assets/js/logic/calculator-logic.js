// Fichier : public/assets/js/logic/calculator-logic.js (Corrigé pour une activation sécurisée)

import { setActiveMessageHandler } from '../main.js';
import { sendWsMessage } from './websocket-service.js';
import { initializeCloture, updateClotureUI, setClotureReady } from './cloture-logic.js';

let config = {};
let wsResourceId = null;
let hasUnsavedChanges = false;
const calculatorPageElement = () => document.getElementById('calculator-page');

function saveStateToSession() {
    const form = document.getElementById('caisse-form');
    if (form) {
        console.log("[Calculator] Sauvegarde de l'état dans la session avant de quitter la page...");
        const formData = new FormData(form);
        const data = { caisse: {} };

        for (const [key, value] of formData.entries()) {
            // Gère les champs comme `caisse[1][b500]`
            const match = key.match(/caisse\[(\d+)\]\[(\w+)\]/);
            if (match) {
                const [, id, subKey] = match;
                if (!data.caisse[id]) data.caisse[id] = {};
                data.caisse[id][subKey] = value;
            } else {
                // Gère les champs TPE comme `tpe_1_1`
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
        hasUnsavedChanges = false;
    }
}


const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => {
    if (typeof str !== 'string' && typeof str !== 'number') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
};

async function fetchCalculatorConfig() {
    const response = await fetch('index.php?route=calculateur/config');
    if (!response.ok) throw new Error('Impossible de charger la configuration du calculateur.');
    const data = await response.json();
    if (!data.success) throw new Error('La configuration reçue est invalide.');
    return data;
}

function renderCalculatorUI() {
    const page = calculatorPageElement();
    if (!page) return;
    const tabSelector = page.querySelector('.tab-selector');
    const ecartContainer = page.querySelector('.ecart-display-container');
    const caissesContainer = page.querySelector('#caisses-content-container');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';
    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}" data-caisse-id="${id}">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><span class="ecart-value"></span><p class="ecart-explanation"></p></div>`;
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label><input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0"><span class="total-line" id="total_${name}_${id}"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v*100) + ' cts'}</label><input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0"><span class="total-line" id="total_${name}_${id}"></span></div>`).join('');
        const tpePourCaisse = config.terminaux_paiement ? Object.entries(config.terminaux_paiement).filter(([,tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            const fieldId = `tpe_${tpeId}_${id}`;
            const fieldName = `caisse[${id}][${fieldId}]`;
            return `<div class="form-group"><label>${tpe.nom}</label><input type="text" data-caisse-id="${id}" id="${fieldId}" name="${fieldName}"></div>`
        }).join('');
        contentHtml += `<div id="caisse${id}" class="caisse-tab-content ${isActive}"><div class="grid grid-3" style="margin-bottom:20px;"><div class="form-group"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div><div class="form-group"><label>Ventes du Jour</label><input type="text" data-caisse-id="${id}" id="ventes_${id}" name="caisse[${id}][ventes]"></div><div class="form-group"><label>Rétrocessions</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div></div><div class="payment-method-tabs"><div class="payment-method-selector"><button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>${tpeHtml ? `<button type="button" class="payment-tab-link" data-payment-tab="cb_${id}"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>` : ''}</div><div id="especes_${id}" class="payment-tab-content active"><h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div></div>${tpeHtml ? `<div id="cb_${id}" class="payment-tab-content"><div class="grid">${tpeHtml}</div></div>` : ''}</div></div>`;
    });
    tabSelector.innerHTML = tabsHtml; ecartContainer.innerHTML = ecartsHtml; caissesContainer.innerHTML = contentHtml;
}


function calculateAll() {
    if (!config.nomsCaisses) return;
    Object.keys(config.nomsCaisses).forEach(id => {
        let totalCompte = 0;
        const allDenoms = {...config.denominations.billets, ...config.denominations.pieces};
        for (const name in allDenoms) {
            const input = document.getElementById(`${name}_${id}`);
            if (input) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(allDenoms[name]);
                totalCompte += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne);
            }
        }
        const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${id}`).value);
        const ventes = parseLocaleFloat(document.getElementById(`ventes_${id}`).value);
        const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${id}`).value);
        const ecart = (totalCompte - fondDeCaisse) - (ventes + retrocession);
        updateEcartDisplay(id, ecart);
    });
}

function updateEcartDisplay(id, ecart) {
    const display = document.getElementById(`ecart-display-caisse${id}`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value');
    const explanation = display.querySelector('.ecart-explanation');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (valueSpan) valueSpan.textContent = formatCurrency(ecart);
    if (Math.abs(ecart) < 0.01) {
        display.classList.add('ecart-ok');
        if (explanation) explanation.textContent = "La caisse est juste.";
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
        if (explanation) explanation.textContent = "Il y a un surplus dans la caisse.";
    } else {
        display.classList.add('ecart-negatif');
        if (explanation) explanation.textContent = "Il manque de l'argent dans la caisse.";
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'cloture_locked_caisses':
            updateClotureUI(data);
            break;
        case 'welcome':
            console.log(`%c[CALCULATEUR DEBUG] Message 'welcome' reçu. Mon ID client est : ${data.resourceId}`, 'color: blue; font-weight: bold;');
            wsResourceId = data.resourceId.toString();
            initializeCloture(config, wsResourceId);
            break;
        case 'full_form_state':
            if (Object.keys(data.state).length > 0) {
                for (const id in data.state) {
                    const field = document.getElementById(id);
                    if (field) field.value = data.state[id];
                }
                calculateAll();
            }
            break;
        case 'update':
             if (data.id && document.activeElement.id !== data.id) {
                const input = document.getElementById(data.id);
                if (input) {
                    input.value = data.value;
                    calculateAll();
                }
            }
            break;
    }
}

function attachEventListeners() {
    const page = calculatorPageElement();
    if (!page) return;

    page.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            hasUnsavedChanges = true;
            calculateAll();
            sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
        }
    });
    
    const tabSelector = page.querySelector('.tab-selector');
    tabSelector.addEventListener('click', e => {
        const btn = e.target.closest('.tab-link');
        if (btn) {
            tabSelector.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(tabId)?.classList.add('active');
            document.getElementById(`ecart-display-${tabId}`)?.classList.add('active');
        }
    });

    page.addEventListener('click', e => {
        const paymentTab = e.target.closest('.payment-tab-link');
        if(paymentTab) {
            const container = paymentTab.closest('.payment-method-tabs');
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            const tabId = paymentTab.dataset.paymentTab;
            container.querySelector(`#${tabId}`)?.classList.add('active');
        }
    });

    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveStateToSession();
        const saveButton = form.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Enregistrement...';
        try {
            const response = await fetch('index.php?route=calculateur/save', { method: 'POST', body: new FormData(form) });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            alert('Sauvegarde manuelle réussie !');
        } catch (error) {
            alert(`Erreur de sauvegarde : ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Enregistrer le Comptage';
        }
    });
}

export async function initializeCalculator() {
    try {
        config = await fetchCalculatorConfig();
        renderCalculatorUI();

        const sessionData = sessionStorage.getItem('calculatorFormData');
        if (sessionData) {
            const dataToLoad = JSON.parse(sessionData);
            document.getElementById('nom_comptage').value = dataToLoad.nom_comptage || '';
            document.getElementById('explication').value = dataToLoad.explication || '';
            for (const caisseId in dataToLoad.caisse) {
                if (config.nomsCaisses[caisseId]) {
                    for (const key in dataToLoad.caisse[caisseId]) {
                        const field = document.getElementById(key);
                        if (field) {
                            field.value = dataToLoad.caisse[caisseId][key];
                        }
                    }
                }
            }
        }
        
        calculateAll();
        
        // La page du calculateur définit son propre gestionnaire de messages pour le WebSocket global
        setActiveMessageHandler(handleWebSocketMessage);
        
        // Les écouteurs d'événements sont attachés
        attachEventListeners();
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.beforePageChange = saveStateToSession;
        }
        window.addEventListener('beforeunload', saveStateToSession);

    } catch (error) {
        console.error("Erreur critique lors de l'initialisation du calculateur :", error);
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
