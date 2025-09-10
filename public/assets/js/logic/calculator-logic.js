// Fichier : public/assets/js/logic/calculator-logic.js (Version Finale Complète et Corrigée)

import { setActiveMessageHandler } from '../main.js';
import { sendWsMessage } from './websocket-service.js';
import { initializeCloture, updateClotureUI } from './cloture-logic.js';

let config = {};
let wsResourceId = null;
let autosaveTimer = null; // Timer pour la fonction d'autosave

const calculatorPageElement = () => document.getElementById('calculator-page');

// --- FONCTION AUTOSAVE ---
// Enregistre le formulaire en BDD après un délai d'inactivité
function triggerAutosave() {
    clearTimeout(autosaveTimer); // Annule la sauvegarde précédente si l'utilisateur tape encore
    const statusElement = document.getElementById('autosave-status');
    if (statusElement) {
        statusElement.textContent = 'Modifications en attente...';
    }

    autosaveTimer = setTimeout(async () => {
        const form = document.getElementById('caisse-form');
        if (!form) return;

        if (statusElement) statusElement.textContent = 'Sauvegarde...';
        try {
            const formData = new FormData(form);
            const response = await fetch('index.php?route=calculateur/autosave', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            if (statusElement) statusElement.textContent = `Dernière sauvegarde à ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            if (statusElement) statusElement.textContent = 'Erreur de sauvegarde auto.';
            console.error("Erreur d'autosave:", error);
        }
    }, 2000); // Délai de 2 secondes
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
        
        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([,tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            const fieldName = `caisse[${id}][tpe][${tpeId}]`;
            return `<div class="form-group"><label>${tpe.nom}</label><input type="text" data-caisse-id="${id}" name="${fieldName}"></div>`
        }).join('');
        
        contentHtml += `
            <div id="caisse${id}" class="caisse-tab-content ${isActive}">
                <div class="grid grid-4" style="margin-bottom:20px;">
                    <div class="form-group"><label>Fond de Caisse</label><input type="text" data-caisse-id="${id}" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]"></div>
                    <div class="form-group"><label>Ventes Espèces (Théorique)</label><input type="text" data-caisse-id="${id}" id="ventes_especes_${id}" name="caisse[${id}][ventes_especes]"></div>
                    <div class="form-group"><label>Ventes CB (Théorique)</label><input type="text" data-caisse-id="${id}" id="ventes_cb_${id}" name="caisse[${id}][ventes_cb]"></div>
                    <div class="form-group"><label>Ventes Chèques (Théorique)</label><input type="text" data-caisse-id="${id}" id="ventes_cheques_${id}" name="caisse[${id}][ventes_cheques]"></div>
                </div>
                <div class="payment-method-tabs">
                    <div class="payment-method-selector">
                        <button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cb_${id}"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="cheques_${id}"><i class="fa-solid fa-money-check-dollar"></i> Chèques</button>
                        <button type="button" class="payment-tab-link" data-payment-tab="reserve_${id}"><i class="fa-solid fa-vault"></i> Réserve</button>
                    </div>
                    <div id="especes_${id}" class="payment-tab-content active"><h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div></div>
                    <div id="cb_${id}" class="payment-tab-content">
                        ${tpeHtml || '<p>Aucun terminal de paiement configuré pour cette caisse.</p>'}
                    </div>
                    <div id="cheques_${id}" class="payment-tab-content">
                        <div class="form-group">
                            <label>Montant total des chèques</label>
                            <input type="text" name="caisse[${id}][cheques_total]" placeholder="0,00">
                        </div>
                    </div>
                    <div id="reserve_${id}" class="payment-tab-content">
                        <p>Chargement des informations de la réserve...</p>
                    </div>
                </div>
            </div>`;
    });
    tabSelector.innerHTML = tabsHtml; ecartContainer.innerHTML = ecartsHtml; caissesContainer.innerHTML = contentHtml;
}


function calculateAll() {
    if (!config.nomsCaisses) return;
    Object.keys(config.nomsCaisses).forEach(id => {
        let totalCompteEspeces = 0;
        const allDenoms = {...config.denominations.billets, ...config.denominations.pieces};
        for (const name in allDenoms) {
            const input = document.getElementById(`${name}_${id}`);
            if (input) {
                const quantite = parseInt(input.value, 10) || 0;
                const totalLigne = quantite * parseFloat(allDenoms[name]);
                totalCompteEspeces += totalLigne;
                document.getElementById(`total_${name}_${id}`).textContent = formatCurrency(totalLigne);
            }
        }
        
        const fondDeCaisse = parseLocaleFloat(document.getElementById(`fond_de_caisse_${id}`).value);
        const ventesEspeces = parseLocaleFloat(document.getElementById(`ventes_especes_${id}`).value);
        
        const recetteReelleEspeces = totalCompteEspeces - fondDeCaisse;
        const ecart = recetteReelleEspeces - ventesEspeces;
        
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
        if (explanation) explanation.textContent = "L'écart en espèces est de 0.";
    } else if (ecart > 0) {
        display.classList.add('ecart-positif');
        if (explanation) explanation.textContent = "Il y a un surplus d'espèces dans la caisse.";
    } else {
        display.classList.add('ecart-negatif');
        if (explanation) explanation.textContent = "Il manque des espèces dans la caisse.";
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'cloture_locked_caisses':
            updateClotureUI(data);
            if (config.nomsCaisses) {
                const totalCaisses = Object.keys(config.nomsCaisses).length;
                const closedCaissesCount = (data.closed_caisses || []).length;
                if (totalCaisses > 0 && closedCaissesCount === totalCaisses) {
                    handleAllCaissesClosed(true);
                } else {
                    handleAllCaissesClosed(false);
                }
            }
            break;
        case 'welcome':
            wsResourceId = data.resourceId.toString();
            initializeCloture(config, wsResourceId);
            break;
        case 'full_form_state':
            if (data.state && Object.keys(data.state).length > 0) {
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
        case 'reload_page':
            alert("Les données ont été mises à jour par un autre utilisateur. La page va être actualisée pour afficher les dernières informations.");
            window.location.reload();
            break;
        case 'nouvelle_demande_reserve':
            console.log('[WebSocket] Une mise à jour de la réserve a eu lieu, rafraîchissement des données.');
            updateAllReserveTabs();
            break;
    }
}

async function fetchReserveData() {
    try {
        const response = await fetch('index.php?route=reserve/get_data');
        if (!response.ok) return null;
        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        console.error("Erreur lors de la récupération des données de la réserve:", error);
        return null;
    }
}

function renderReserveTabContent(caisseId, reserveData) {
    const container = document.getElementById(`reserve_${caisseId}`);
    if (!container) return;

    const demandesEnAttente = reserveData?.demandes_en_attente.filter(d => d.caisse_id.toString() === caisseId) || [];
    let demandesHtml = '<h4>Demandes en attente</h4>';
    if (demandesEnAttente.length > 0) {
        demandesHtml += demandesEnAttente.map(demande => {
            const denomValue = (config.denominations.billets[demande.denomination_demandee] || config.denominations.pieces[demande.denomination_demandee]);
            const label = denomValue >= 1 ? `${denomValue} ${config.currencySymbol}` : `${denomValue * 100} cts`;
            return `<div class="pending-demande-item"><span>${demande.quantite_demandee} x ${label}</span> <strong>${formatCurrency(demande.valeur_demandee)}</strong></div>`;
        }).join('');
    } else {
        demandesHtml += '<p>Aucune demande en attente pour cette caisse.</p>';
    }

    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
    const denomOptions = sortedDenoms.map(([name, value]) => {
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        return `<option value="${name}">${label}</option>`;
    }).join('');

    const formHtml = `
        <h4 style="margin-top: 30px;">Faire une nouvelle demande</h4>
        <form class="reserve-demande-form" data-caisse-id="${caisseId}">
            <input type="hidden" name="caisse_id" value="${caisseId}">
            <div class="form-group">
                <label>Dénomination nécessaire</label>
                <select name="denomination_demandee" required>${denomOptions}</select>
            </div>
            <div class="form-group">
                <label>Quantité</label>
                <input type="number" name="quantite_demandee" min="1" required>
            </div>
             <div class="form-group">
                <label>Notes (optionnel)</label>
                <textarea name="notes_demandeur" rows="2"></textarea>
            </div>
            <button type="submit" class="btn save-btn">Envoyer la demande</button>
        </form>
    `;

    container.innerHTML = demandesHtml + formHtml;
}

async function updateAllReserveTabs() {
    const reserveData = await fetchReserveData();
    if (reserveData) {
        Object.keys(config.nomsCaisses).forEach(caisseId => {
            renderReserveTabContent(caisseId, reserveData);
        });
    }
}

function attachEventListeners() {
    const page = calculatorPageElement();
    if (!page) return;

    page.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            calculateAll();
            triggerAutosave();
            sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
        }
    });
    
    const tabSelector = page.querySelector('.tab-selector');
    tabSelector.addEventListener('click', e => {
        const btn = e.target.closest('.tab-link');
        if (btn) {
            page.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
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

    page.addEventListener('submit', async (e) => {
        if (e.target.classList.contains('reserve-demande-form')) {
            e.preventDefault();
            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi...';

            try {
                const response = await fetch('index.php?route=reserve/submit_demande', {
                    method: 'POST',
                    body: new FormData(form)
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);

                alert('Demande envoyée avec succès !');
                sendWsMessage({ type: 'nouvelle_demande_reserve' });
                form.reset();
                updateAllReserveTabs();
            } catch (error) {
                alert(`Erreur: ${error.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer la demande';
            }
        }
    });
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
                    <p>Vous pouvez maintenant finaliser la journée. Cette action créera un rapport final et préparera les fonds de caisse pour demain.</p>
                </div>
                <button id="trigger-final-cloture" class="btn save-btn">Finaliser la journée</button>
            </div>`;
        container.innerHTML = bannerHtml;
        document.getElementById('trigger-final-cloture').addEventListener('click', performFinalCloture);
    } else if (!isAllClosed && existingBanner) {
        existingBanner.remove();
    }
}

async function performFinalCloture() {
    if (!confirm("Êtes-vous sûr de vouloir finaliser la journée ? Cette action est irréversible et réinitialisera les caisses pour demain.")) {
        return;
    }

    const button = document.getElementById('trigger-final-cloture');
    button.disabled = true;
    button.textContent = 'Finalisation...';

    try {
        const form = document.getElementById('caisse-form');
        const formData = new FormData();
        form.querySelectorAll('input, textarea').forEach(field => {
            if (field.name) {
                formData.append(field.name, field.value);
            }
        });

        const response = await fetch('index.php?route=cloture/confirm_generale', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        sendWsMessage({ type: 'force_reload_all' });

        alert(result.message);
        window.location.reload();

    } catch (error) {
        alert(`Erreur lors de la finalisation : ${error.message}`);
        button.disabled = false;
        button.textContent = 'Finaliser la journée';
    }
}

export async function initializeCalculator() {
    try {
        config = await fetchCalculatorConfig();
        renderCalculatorUI();

        try {
            const response = await fetch('index.php?route=calculateur/get_initial_data');
            const result = await response.json();
            if (result.success && result.data) {
                console.log(`%c[CHARGEMENT INITIAL] Sauvegarde BDD chargée : "${result.data.nom_comptage}"`, 'color: green; font-weight: bold;');
                
                const dataToLoad = result.data;

                if (dataToLoad.nom_comptage.startsWith('Fond de caisse J+1') || dataToLoad.nom_comptage.startsWith('Sauvegarde auto')) {
                    document.getElementById('nom_comptage').value = '';
                    document.getElementById('explication').value = '';
                } else {
                    document.getElementById('nom_comptage').value = dataToLoad.nom_comptage || '';
                    document.getElementById('explication').value = dataToLoad.explication || '';
                }
                
                for (const caisseId in dataToLoad) {
                    if (config.nomsCaisses[caisseId]) {
                        for (const key in dataToLoad[caisseId]) {
                            if (key === 'denominations') {
                                for (const denomName in dataToLoad[caisseId][key]) {
                                    const field = document.getElementById(`${denomName}_${caisseId}`);
                                    if (field) field.value = dataToLoad[caisseId][key][denomName];
                                }
                            } else {
                                const field = document.getElementById(`${key}_${caisseId}`);
                                if (field) field.value = dataToLoad[caisseId][key];
                            }
                        }
                    }
                }
            } else {
                console.log("[CHARGEMENT INITIAL] Aucune sauvegarde BDD trouvée.");
            }
        } catch (error) {
            console.error("Erreur lors du chargement de la sauvegarde initiale:", error);
        }

        calculateAll();
        setActiveMessageHandler(handleWebSocketMessage);
        attachEventListeners();
        
        console.log("[Calculator] Prêt. Demande de l'état complet au serveur WebSocket.");
        sendWsMessage({ type: 'get_full_state' });

        updateAllReserveTabs();

    } catch (error) {
        console.error("Erreur critique lors de l'initialisation du calculateur :", error);
        document.getElementById('main-content').innerHTML = `<div class="container error"><p>Impossible de charger le calculateur : ${error.message}</p></div>`;
    }
}
