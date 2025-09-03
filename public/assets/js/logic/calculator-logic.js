// Fichier : public/assets/js/logic/calculator-logic.js

import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import { initializeCloture, updateClotureUI } from './cloture-logic.js';

// --- Variables globales pour la page ---
let config = {};
let wsResourceId = null; // Pour stocker l'ID unique de notre connexion WebSocket

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencySymbol || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => {
    if (typeof str !== 'string' && typeof str !== 'number') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
};

// --- API ---
async function fetchCalculatorConfig() {
    const response = await fetch('index.php?route=calculateur/config');
    if (!response.ok) throw new Error('Impossible de charger la configuration du calculateur.');
    const data = await response.json();
    if (!data.success) throw new Error('La configuration reçue est invalide.');
    return data;
}

// --- Rendu dynamique de l'interface ---
function renderCalculatorUI() {
    const tabSelector = document.querySelector('.tab-selector');
    const ecartContainer = document.querySelector('.ecart-display-container');
    const caissesContainer = document.getElementById('caisses-content-container');

    if (!tabSelector || !ecartContainer || !caissesContainer) {
        console.error("Éléments de l'interface du calculateur manquants.");
        return;
    }

    let caissesTabsHtml = '';
    let caissesContentHtml = '';
    let ecartDisplaysHtml = '';

    Object.entries(config.nomsCaisses).forEach(([id, nom], index) => {
        const isActive = index === 0 ? 'active' : '';
        caissesTabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}">${nom}</button>`;
        ecartDisplaysHtml += `
            <div id="ecart-display-caisse${id}" class="ecart-display ${isActive}">
                Écart : <span class="ecart-value">0,00 ${config.currencySymbol}</span>
                <p class="ecart-explanation"></p>
            </div>`;

        const billetsHtml = Object.entries(config.denominations.billets).map(([name, valeur]) => `
            <div class="form-group">
                <label>${valeur} ${config.currencySymbol}</label>
                <input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" step="1" placeholder="0">
                <span class="total-line" id="total_${name}_${id}">0,00 ${config.currencySymbol}</span>
            </div>
        `).join('');

        const piecesHtml = Object.entries(config.denominations.pieces).map(([name, valeur]) => `
            <div class="form-group">
                <label>${valeur >= 1 ? valeur + ' ' + config.currencySymbol : (valeur * 100) + ' cts'}</label>
                <input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" step="1" placeholder="0">
                <span class="total-line" id="total_${name}_${id}">0,00 ${config.currencySymbol}</span>
            </div>
        `).join('');

        caissesContentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="grid grid-3" style="margin-bottom:20px;">
                    <div class="form-group">
                        <label>Fond de Caisse</label>
                        <input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label>Ventes du Jour</label>
                        <input type="text" data-caisse-id="${id}" id="ventes_${id}" name="caisse[${id}][ventes]" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label>Rétrocessions</label>
                        <input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]" placeholder="0,00">
                    </div>
                </div>
                <h4>Billets</h4>
                <div class="grid">${billetsHtml}</div>
                <h4 style="margin-top: 20px;">Pièces</h4>
                <div class="grid">${piecesHtml}</div>
            </div>
        `;
    });

    tabSelector.innerHTML = caissesTabsHtml;
    ecartContainer.innerHTML = ecartDisplaysHtml;
    caissesContainer.innerHTML = caissesContentHtml;
}

// --- Logique de calcul ---
function calculateAll() {
    Object.keys(config.nomsCaisses).forEach(id => {
        let totalCompte = 0;
        document.querySelectorAll(`input[data-caisse-id="${id}"]`).forEach(input => {
            const name = input.id.split('_')[0];
            const valeur = config.denominations.billets[name] || config.denominations.pieces[name];
            if (valeur) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(valeur);
                totalCompte += totalLigne;
                const totalLigneElement = document.getElementById(`total_${name}_${id}`);
                if (totalLigneElement) totalLigneElement.textContent = formatCurrency(totalLigne);
            }
        });

        const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${id}`).value);
        const ventes = parseLocaleFloat(document.getElementById(`ventes_${id}`).value);
        const retrocession = parseLocaleFloat(document.getElementById(`retrocession_${id}`).value);
        
        const recetteTheorique = ventes + retrocession;
        const recetteReelle = totalCompte - fondDeCaisse;
        const ecart = recetteReelle - recetteTheorique;

        updateEcartDisplay(id, ecart);
    });
}

function updateEcartDisplay(caisseId, ecart) {
    const display = document.getElementById(`ecart-display-caisse${caisseId}`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value');
    const explanationP = display.querySelector('.ecart-explanation');

    if (valueSpan) valueSpan.textContent = formatCurrency(ecart);
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    
    if (Math.abs(ecart) < 0.01) {
        display.classList.add('ecart-ok');
        if(explanationP) explanationP.textContent = "L'écart est nul. La caisse est juste.";
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
        if(explanationP) explanationP.textContent = "Il y a un surplus dans la caisse.";
    } else {
        display.classList.add('ecart-negatif');
        if(explanationP) explanationP.textContent = "Il manque de l'argent dans la caisse.";
    }
}


// --- Gestion des messages WebSocket ---
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'welcome') {
            wsResourceId = data.resourceId;
            initializeCloture(config, wsResourceId);
            return;
        }

        if (data.type === 'cloture_locked_caisses') {
            updateClotureUI(data);
            return;
        }

        if (data.id && typeof data.value !== 'undefined') {
            const input = document.getElementById(data.id);
            // On met à jour le champ seulement si ce n'est pas nous qui sommes en train de le modifier
            if (input && input !== document.activeElement) {
                input.value = data.value;
                calculateAll(); // Recalcule tout après une mise à jour externe
            }
        }

    } catch (error) {
        console.error("Erreur de parsing du message WebSocket:", error);
    }
}


// --- Événements ---
function attachEventListeners() {
    const calculatorPage = document.getElementById('calculator-page');
    if (!calculatorPage) return;

    calculatorPage.addEventListener('input', (e) => {
        if (e.target.matches('input[type="number"], input[type="text"]')) {
            calculateAll();
            sendWsMessage({ id: e.target.id, value: e.target.value });
        }
    });
    
    calculatorPage.querySelector('.tab-selector').addEventListener('click', (e) => {
        const button = e.target.closest('.tab-link');
        if (button) {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            document.getElementById(`ecart-display-${tabId}`).classList.add('active');
        }
    });
    
    const form = document.getElementById('caisse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveButton = form.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Enregistrement...';

        try {
            const formData = new FormData(form);
            const response = await fetch('index.php?route=calculateur/save', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            alert('Sauvegarde réussie !'); // À remplacer par une meilleure notification
        } catch (error) {
            alert(`Erreur de sauvegarde : ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Enregistrer le Comptage';
        }
    });
}


// --- Point d'entrée de la logique de la page ---
export async function initializeCalculator() {
    try {
        config = await fetchCalculatorConfig();
        renderCalculatorUI();
        attachEventListeners();
        calculateAll();
        initializeWebSocket(handleWebSocketMessage);
    } catch (error) {
        const container = document.getElementById('calculator-page') || document.getElementById('main-content');
        container.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
