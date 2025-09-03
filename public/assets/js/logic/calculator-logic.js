// Fichier : public/assets/js/logic/calculator-logic.js (Corrigé)

import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import { initializeCloture, updateClotureUI } from './cloture-logic.js';

let config = {};
let wsResourceId = null;
const calculatorPageElement = () => document.getElementById('calculator-page');

// --- Fonctions Utilitaires (CORRIGÉ) ---
const formatCurrency = (amount) => {
    // On utilise maintenant config.currencyCode pour la logique, et on garde 'EUR' comme fallback.
    const code = config.currencyCode || 'EUR';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount);
};
const parseLocaleFloat = (str) => {
    if (typeof str !== 'string' && typeof str !== 'number') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
};

// --- Le reste du fichier est identique ---

async function fetchCalculatorConfig() {
    const response = await fetch('index.php?route=calculateur/config');
    if (!response.ok) throw new Error('Impossible de charger la configuration.');
    const data = await response.json();
    if (!data.success) throw new Error('Configuration invalide.');
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
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}" class="ecart-display ${isActive}"><span class="ecart-value"></span><p class="ecart-explanation"></p></div>`;
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `
            <div class="form-group">
                <label>${v} ${config.currencySymbol}</label>
                <input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0">
                <span class="total-line" id="total_${name}_${id}"></span>
            </div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `
            <div class="form-group">
                <label>${v >= 1 ? v + ' ' + config.currencySymbol : (v*100) + ' cts'}</label>
                <input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0">
                <span class="total-line" id="total_${name}_${id}"></span>
            </div>`).join('');
        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="grid grid-3" style="margin-bottom:20px;">
                    <div class="form-group"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div>
                    <div class="form-group"><label>Ventes du Jour</label><input type="text" data-caisse-id="${id}" id="ventes_${id}" name="caisse[${id}][ventes]"></div>
                    <div class="form-group"><label>Rétrocessions</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div>
                </div>
                <h4>Billets</h4><div class="grid">${billets}</div>
                <h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div>
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml;
    ecartContainer.innerHTML = ecartsHtml;
    caissesContainer.innerHTML = contentHtml;
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
    display.querySelector('.ecart-value').textContent = formatCurrency(ecart);
    const explanation = display.querySelector('.ecart-explanation');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (Math.abs(ecart) < 0.01) {
        display.classList.add('ecart-ok');
        explanation.textContent = "La caisse est juste.";
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
        explanation.textContent = "Il y a un surplus dans la caisse.";
    } else {
        display.classList.add('ecart-negatif');
        explanation.textContent = "Il manque de l'argent dans la caisse.";
    }
}

function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'welcome') {
            wsResourceId = data.resourceId;
            initializeCloture(config, wsResourceId);
        } else if (data.type === 'cloture_locked_caisses') {
            updateClotureUI(data);
        } else if (data.id && document.activeElement.id !== data.id) {
            const input = document.getElementById(data.id);
            if (input) {
                input.value = data.value;
                calculateAll(); // On recalcule TOUT pour mettre à jour l'interface
            }
        }
    } catch (e) { console.error("Erreur WebSocket:", e); }
}

function attachEventListeners() {
    const page = calculatorPageElement();
    if (!page) return;

    page.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT') {
            calculateAll();
            sendWsMessage({ id: e.target.id, value: e.target.value });
        }
    });
    
    const tabSelector = page.querySelector('.tab-selector');
    tabSelector.addEventListener('click', e => {
        const btn = e.target.closest('.tab-link');
        if (btn) {
            tabSelector.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            page.querySelectorAll('.caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(tabId)?.classList.add('active');
            document.getElementById(`ecart-display-${tabId}`)?.classList.add('active');
        }
    });
}

export async function initializeCalculator() {
    try {
        config = await fetchCalculatorConfig();
        renderCalculatorUI();
        attachEventListeners();
        calculateAll(); // Calcul initial
        initializeWebSocket(handleWebSocketMessage);
    } catch (error) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
