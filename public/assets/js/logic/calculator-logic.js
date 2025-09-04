// Fichier : public/assets/js/logic/calculator-logic.js (Version Corrigée et Complète)

import { initializeWebSocket, sendWsMessage } from './websocket-service.js';
import { initializeCloture, updateClotureUI } from './cloture-logic.js';

// --- Variables globales pour la page ---
let config = {};
let wsResourceId = null;
let hasUnsavedChanges = false;
const calculatorPageElement = () => document.getElementById('calculator-page');

async function triggerAutosave() {
    const form = document.getElementById('caisse-form');
    if (hasUnsavedChanges && form) {
        console.log('[Autosave] Détection de changements non sauvegardés. Envoi...');
        const formData = new FormData(form);
        try {
            const response = await fetch('index.php?route=calculateur/autosave', {
                method: 'POST',
                body: formData,
                keepalive: true
            });
            const result = await response.json();
            if (result.success) {
                hasUnsavedChanges = false;
                console.log('[Autosave] Succès.');
            } else {
                console.error('[Autosave] Échec de la sauvegarde côté serveur.');
            }
        } catch (e) {
            console.error('[Autosave] Erreur réseau.', e);
        }
    }
}

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
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
            <div class="form-group"><label>${v} ${config.currencySymbol}</label><input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0"><span class="total-line" id="total_${name}_${id}"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `
            <div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v*100) + ' cts'}</label><input type="number" data-caisse-id="${id}" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" placeholder="0"><span class="total-line" id="total_${name}_${id}"></span></div>`).join('');
        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="grid grid-3" style="margin-bottom:20px;">
                    <div class="form-group"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div>
                    <div class="form-group"><label>Ventes du Jour</label><input type="text" data-caisse-id="${id}" id="ventes_${id}" name="caisse[${id}][ventes]"></div>
                    <div class="form-group"><label>Rétrocessions</label><input type="text" data-caisse-id="${id}" id="retrocession_${id}" name="caisse[${id}][retrocession]"></div>
                </div>
                <h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div>
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml;
    ecartContainer.innerHTML = ecartsHtml;
    caissesContainer.innerHTML = contentHtml;
}

// --- Logique de calcul ---
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

// --- Gestion des messages WebSocket ---
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'welcome') {
            wsResourceId = data.resourceId;
            initializeCloture(config, wsResourceId);
            sendWsMessage({ type: 'request_state' }); 
        } else if (data.type === 'cloture_locked_caisses') {
            updateClotureUI(data);
        } else if (data.type === 'send_full_state') {
            sendFullFormState();
        } else if (data.type === 'broadcast_state') {
            loadFormState(data.form_state);
        } else if (data.id && document.activeElement.id !== data.id) {
            const input = document.getElementById(data.id);
            if (input) {
                input.value = data.value;
                calculateAll();
            }
        }
    } catch (e) { console.error("Erreur WebSocket:", e); }
}

function loadFormState(state) {
    let hasChanges = false;
    for (const id in state) {
        const input = document.getElementById(id);
        if (input && input.value !== state[id]) {
            input.value = state[id];
            hasChanges = true;
        }
    }
    if (hasChanges) calculateAll();
}

function sendFullFormState() {
    const formState = {};
    document.querySelectorAll('#caisse-form input, #caisse-form textarea').forEach(el => {
        if (el.id) formState[el.id] = el.value;
    });
    sendWsMessage({ type: 'broadcast_state', form_state: formState });
}

function initializeAutosave() {
    window.addEventListener('beforeunload', () => {
        if (hasUnsavedChanges) {
             triggerAutosave();
        }
    });
}

function attachEventListeners() {
    const page = calculatorPageElement();
    if (!page) return;

    page.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            hasUnsavedChanges = true;
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
            hasUnsavedChanges = false; 
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

        // --- DÉBUT DE LA LOGIQUE DE REPRISE CORRIGÉE ---
        console.log('[Init] Tentative de chargement des données initiales...');
        const initialDataResponse = await fetch('index.php?route=calculateur/get_initial_data');
        const initialDataResult = await initialDataResponse.json();
        
        if (initialDataResult.success && initialDataResult.data) {
            console.log('[Init] Données initiales reçues, application en cours...', initialDataResult.data);
            const dataToLoad = initialDataResult.data;

            // Remplir les champs nom_comptage et explication
            const nomComptageField = document.getElementById('nom_comptage');
            const explicationField = document.getElementById('explication');
            if (nomComptageField) nomComptageField.value = dataToLoad.nom_comptage || '';
            if (explicationField) explicationField.value = dataToLoad.explication || '';

            // Parcourir chaque caisse dans les données reçues
            for (const caisseId in dataToLoad) {
                if (caisseId === 'nom_comptage' || caisseId === 'explication') continue;

                const caisseData = dataToLoad[caisseId];
                
                // Remplir fond de caisse, ventes, retrocession
                const fdcField = document.getElementById(`fond_de_caisse_${caisseId}`);
                const ventesField = document.getElementById(`ventes_${caisseId}`);
                const retroField = document.getElementById(`retrocession_${caisseId}`);

                if (fdcField) fdcField.value = caisseData.fond_de_caisse || '';
                if (ventesField) ventesField.value = caisseData.ventes || '';
                if (retroField) retroField.value = caisseData.retrocession || '';
                
                // Remplir les quantités pour chaque dénomination
                if (caisseData.denominations) {
                    for (const denomName in caisseData.denominations) {
                        const denomField = document.getElementById(`${denomName}_${caisseId}`);
                        if (denomField) {
                            denomField.value = caisseData.denominations[denomName];
                        }
                    }
                }
            }
            console.log('[Init] Remplissage du formulaire terminé.');
        } else {
            console.log('[Init] Aucune donnée initiale à charger.');
        }
        // --- FIN DE LA LOGIQUE DE REPRISE ---

        attachEventListeners();
        calculateAll(); // Calcule les totaux une fois le formulaire rempli
        initializeAutosave();
        
        await initializeWebSocket(handleWebSocketMessage);
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.beforePageChange = triggerAutosave;
        }

    } catch (error) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
