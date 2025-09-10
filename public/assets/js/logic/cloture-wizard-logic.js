// Fichier : public/assets/js/logic/cloture-wizard-logic.js (Version Finale Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';

// --- Variables d'état ---
let config = {};
let wsResourceId = null;
let calculatorData = {};
let wizardState = {
    currentStep: 1,
    selectedCaisses: [],
    confirmedData: {},
};

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);
const parseLocaleFloat = (str) => parseFloat(String(str || '0').replace(',', '.')) || 0;

// --- API ---
async function fetchInitialData() {
    console.log("[Wizard] Récupération de la configuration et de la dernière sauvegarde auto...");
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const dataPromise = fetch('index.php?route=calculateur/get_initial_data').then(res => res.json());

    const [configResult, dataResult] = await Promise.all([configPromise, dataPromise]);
    config = configResult;

    if (!dataResult.success || !dataResult.data) {
        throw new Error("Dernière sauvegarde non trouvée. Veuillez retourner au calculateur.");
    }

    const rawData = dataResult.data;
    calculatorData = {
        nom_comptage: rawData.nom_comptage,
        explication: rawData.explication,
        caisse: {}
    };
    for (const caisseId in rawData) {
        if (!isNaN(caisseId)) {
             calculatorData.caisse[caisseId] = rawData[caisseId];
             if (!calculatorData.caisse[caisseId].denominations) {
                calculatorData.caisse[caisseId].denominations = {};
             }
        }
    }
    console.log("[Wizard] Configuration et données de la BDD chargées.", { config, calculatorData });
}

// --- Logique de Calcul ---
function calculateAllForCaisse(caisseId) {
    if (!calculatorData.caisse?.[caisseId]) return;
    let totalCompte = 0;
    const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
    const denominationsData = calculatorData.caisse[caisseId].denominations || {};

    for (const name in allDenoms) {
        const quantite = parseInt(denominationsData[name], 10) || 0;
        const totalLigne = quantite * parseFloat(allDenoms[name]);
        totalCompte += totalLigne;
        const totalLineEl = document.getElementById(`total_${name}_${caisseId}_wizard`);
        if (totalLineEl) totalLineEl.textContent = formatCurrency(totalLigne);
    }
    const fondDeCaisse = parseLocaleFloat(calculatorData.caisse[caisseId].fond_de_caisse);
    const ventes = parseLocaleFloat(calculatorData.caisse[caisseId].ventes);
    const retrocession = parseLocaleFloat(calculatorData.caisse[caisseId].retrocession);
    const ecart = (totalCompte - fondDeCaisse) - (ventes + retrocession);
    updateEcartDisplay(caisseId, ecart);
}

function calculateWithdrawalSuggestion(caisseId) {
    const caisseData = calculatorData.caisse?.[caisseId] || {};
    if (!caisseData) return { suggestions: [], totalToWithdraw: 0 };

    const denominationsData = caisseData.denominations || {};
    const allDenoms = { ...(config.denominations?.billets || {}), ...(config.denominations?.pieces || {}) };
    const minToKeepRules = config.minToKeep || {};

    // 1. Définir la VALEUR CIBLE à atteindre, à partir du champ "Fond de Caisse"
    const targetFundValue = parseLocaleFloat(caisseData.fond_de_caisse);

    // 2. Créer un inventaire des quantités actuelles pour chaque dénomination
    const currentQuantities = {};
    let currentTotalValue = 0;
    for (const name in allDenoms) {
        const qty = parseInt(denominationsData[name], 10) || 0;
        if (qty > 0) {
            currentQuantities[name] = qty;
            currentTotalValue += qty * parseFloat(allDenoms[name]);
        }
    }

    // Si la caisse est vide ou si le fond de caisse cible est supérieur à ce qu'on a, on ne peut rien retirer.
    if (currentTotalValue <= targetFundValue) {
        return { suggestions: [], totalToWithdraw: 0 };
    }

    // 3. Construire le "Fonds de Caisse Idéal" à conserver pour demain
    const fundToKeep = {};
    let fundToKeepValue = 0;
    
    // Trier les dénominations de la plus grande à la plus petite pour une logique cohérente
    const sortedDenoms = Object.keys(allDenoms).sort((a, b) => parseFloat(allDenoms[b]) - parseFloat(allDenoms[a]));

    // Étape A : Mettre de côté les coupures prioritaires définies dans min_to_keep
    for (const name of sortedDenoms) {
        const targetQty = parseInt(minToKeepRules[name], 10) || 0;
        if (targetQty > 0 && currentQuantities[name]) {
            const qtyToReserve = Math.min(currentQuantities[name], targetQty);
            const valueReserved = qtyToReserve * parseFloat(allDenoms[name]);

            // On ne dépasse pas la valeur cible totale
            if (fundToKeepValue + valueReserved <= targetFundValue) {
                fundToKeep[name] = (fundToKeep[name] || 0) + qtyToReserve;
                fundToKeepValue += valueReserved;
            }
        }
    }

    // Étape B : Compléter avec d'autres coupures pour atteindre la valeur cible exacte
    for (const name of sortedDenoms) {
        const availableQty = (currentQuantities[name] || 0) - (fundToKeep[name] || 0);
        if (availableQty > 0) {
            const value = parseFloat(allDenoms[name]);
            const remainingValueNeeded = targetFundValue - fundToKeepValue;
            
            if (remainingValueNeeded > 0) {
                // Combien de cette coupure peut-on ajouter ?
                const qtyToAdd = Math.min(availableQty, Math.floor(remainingValueNeeded / value));
                if (qtyToAdd > 0) {
                    fundToKeep[name] = (fundToKeep[name] || 0) + qtyToAdd;
                    fundToKeepValue += qtyToAdd * value;
                }
            }
        }
    }

    // 4. Calculer le retrait : c'est tout ce qui n'a pas été mis dans "fundToKeep"
    const suggestions = [];
    let totalToWithdraw = 0;
    for (const name in currentQuantities) {
        const qtyToWithdraw = currentQuantities[name] - (fundToKeep[name] || 0);
        if (qtyToWithdraw > 0) {
            const value = parseFloat(allDenoms[name]);
            const withdrawnAmount = qtyToWithdraw * value;
            suggestions.push({ name, value, qty: qtyToWithdraw, total: withdrawnAmount });
            totalToWithdraw += withdrawnAmount;
        }
    }
    
    return { suggestions, totalToWithdraw };
}

// --- Fonctions de Rendu ---
function updateEcartDisplay(id, ecart) {
    const display = document.getElementById(`ecart-display-caisse${id}_wizard`);
    if (!display) return;
    const valueSpan = display.querySelector('.ecart-value'), explanation = display.querySelector('.ecart-explanation');
    display.classList.remove('ecart-ok', 'ecart-positif', 'ecart-negatif');
    if (valueSpan) valueSpan.textContent = formatCurrency(ecart);
    if (Math.abs(ecart) < 0.01) { display.classList.add('ecart-ok'); if (explanation) explanation.textContent = "La caisse est juste."; }
    else if (ecart > 0) { display.classList.add('ecart-positif'); if (explanation) explanation.textContent = "Il y a un surplus."; }
    else { display.classList.add('ecart-negatif'); if (explanation) explanation.textContent = "Il manque de l'argent."; }
}

function renderSuggestionTable(suggestionData) {
    // La variable est renommée en suggestionData pour plus de clarté
    // CORRECTION : On vérifie suggestionData.suggestions, qui est bien l'array retourné par la fonction de calcul.
    if (!suggestionData || !suggestionData.suggestions || suggestionData.suggestions.length === 0) {
        return `
            <div class="withdrawal-summary-card">
                <div class="withdrawal-total-header status-ok">
                    <div class="total-amount">0,00 €</div>
                    <div class="total-label">Aucun retrait nécessaire</div>
                </div>
                <div class="withdrawal-details-list">
                    <div class="detail-item-empty">
                        Le fond de caisse correspond à la cible.
                    </div>
                </div>
            </div>
        `;
    }

    // CORRECTION : On utilise suggestionData.suggestions pour la boucle .map()
    const detailRows = suggestionData.suggestions.map(s => {
        const label = s.value >= 1 ? `${s.value} ${config.currencySymbol}` : `${s.value * 100} cts`;
        return `
            <div class="detail-item">
                <span class="detail-item-label">
                    <i class="fa-solid fa-money-bill-wave item-icon"></i>
                    Retirer ${s.qty} x ${label}
                </span>
                <span class="detail-item-value">${formatCurrency(s.total)}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="withdrawal-summary-card">
            <div class="withdrawal-total-header">
                <div class="total-amount">${formatCurrency(suggestionData.totalToWithdraw)}</div>
                <div class="total-label">Total à retirer de la caisse</div>
            </div>
            <div class="withdrawal-details-list">
                ${detailRows}
            </div>
        </div>
    `;
}

async function renderStep1_Selection() {
    const container = document.querySelector('.wizard-content');
    if (!container) return;

    // Affiche un état de chargement
    container.innerHTML = '<p style="text-align:center;">Chargement de l\'état des caisses...</p>';

    try {
        // Étape 1 : On récupère l'état actuel des caisses depuis l'API
        const response = await fetch('index.php?route=cloture/get_state');
        const stateData = await response.json();
        if (!stateData.success) {
            throw new Error("Impossible de récupérer l'état des caisses.");
        }
        const lockedCaisses = stateData.locked_caisses || [];
        const closedCaisses = (stateData.closed_caisses || []).map(String);

        // Étape 2 : On génère le HTML pour chaque caisse en fonction de son statut
        const caissesHtml = Object.entries(config.nomsCaisses).map(([id, nom]) => {
            const isClosed = closedCaisses.includes(id);
            const lockInfo = lockedCaisses.find(c => c.caisse_id.toString() === id);
            const isLocked = lockInfo && String(lockInfo.locked_by) !== String(wsResourceId);
            const isDisabled = isClosed || isLocked;

            let statusClass = 'status-libre';
            let statusIcon = 'fa-check-circle';
            let statusText = 'Prête pour la clôture';

            if (isClosed) {
                statusClass = 'status-cloturee';
                statusIcon = 'fa-flag-checkered';
                statusText = 'Déjà clôturée';
            } else if (isLocked) {
                statusClass = 'status-verrouillee';
                statusIcon = 'fa-lock';
                statusText = 'Utilisée par un autre collaborateur';
            }

            return `
                <label class="caisse-selection-item ${statusClass}" title="${statusText}">
                    <input type="checkbox" name="caisseSelection" value="${id}" ${isDisabled ? 'disabled' : ''}>
                    <div class="caisse-info">
                        <i class="fa-solid ${statusIcon}"></i>
                        <span>${nom}</span>
                        <small class="caisse-status-text">${statusText}</small>
                    </div>
                </label>`;
        }).join('');

        // Étape 3 : On affiche le rendu final avec la légende et les boutons d'action
        container.innerHTML = `
            <div class="wizard-step-content">
                <h3>Sélectionnez les caisses à clôturer</h3>
                <div class="selection-controls">
                    <div class="color-key">
                        <div><span class="color-dot color-libre"></span> Libre</div>
                        <div><span class="color-dot color-verrouillee"></span> En cours d'utilisation</div>
                        <div><span class="color-dot color-cloturee"></span> Déjà clôturée</div>
                    </div>
                    <div class="button-group">
                        <button type="button" id="select-all-btn" class="btn action-btn">Tout sélectionner</button>
                        <button type="button" id="deselect-all-btn" class="btn action-btn">Tout désélectionner</button>
                    </div>
                </div>
                <div class="caisse-selection-grid">${caissesHtml}</div>
            </div>`;
        
        // Étape 4 : On attache la logique aux nouveaux éléments
        const grid = container.querySelector('.caisse-selection-grid');
        const nextBtn = document.getElementById('wizard-next-btn');

        const updateNextButtonState = () => {
            nextBtn.disabled = grid.querySelectorAll('input:checked').length === 0;
        };

        grid.addEventListener('change', updateNextButtonState);

        document.getElementById('select-all-btn').addEventListener('click', () => {
            grid.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
            updateNextButtonState();
        });

        document.getElementById('deselect-all-btn').addEventListener('click', () => {
            grid.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => cb.checked = false);
            updateNextButtonState();
        });

    } catch (error) {
        container.innerHTML = `<p class="error" style="text-align:center;">${error.message}</p>`;
    }
}

function renderStep2_Counting() {
    const container = document.querySelector('.wizard-content');
    let tabsHtml = '', contentHtml = '', ecartsHtml = '';
    wizardState.selectedCaisses.forEach((id, index) => {
        const nom = config.nomsCaisses[id];
        const isActive = index === 0 ? 'active' : '';
        tabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}_wizard">${nom}</button>`;
        ecartsHtml += `<div id="ecart-display-caisse${id}_wizard" class="ecart-display ${isActive}"><span class="ecart-value"></span><p class="ecart-explanation"></p></div>`;
        const caisseData = calculatorData.caisse[id] || {};
        const denominationsData = caisseData.denominations || {};

        const buildInput = (name, value, caisseId) => `<input type="number" id="${name}_${caisseId}" name="caisse[${caisseId}][${name}]" data-caisse-id="${caisseId}" value="${value || ''}" min="0">`;
        const buildTextInput = (name, value, caisseId) => `<input type="text" id="${name}_${caisseId}" name="caisse[${caisseId}][${name}]" data-caisse-id="${caisseId}" value="${value || ''}">`;
        
        const billets = Object.entries(config.denominations.billets).map(([name, v]) => `<div class="form-group"><label>${v} ${config.currencySymbol}</label>${buildInput(name, denominationsData[name], id)}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const pieces = Object.entries(config.denominations.pieces).map(([name, v]) => `<div class="form-group"><label>${v >= 1 ? v + ' ' + config.currencySymbol : (v * 100) + ' cts'}</label>${buildInput(name, denominationsData[name], id)}<span class="total-line" id="total_${name}_${id}_wizard"></span></div>`).join('');
        const tpePourCaisse = config.tpeParCaisse ? Object.entries(config.tpeParCaisse).filter(([, tpe]) => tpe.caisse_id.toString() === id) : [];
        const tpeHtml = tpePourCaisse.map(([tpeId, tpe]) => {
            const fieldId = `tpe_${tpeId}_${id}`;
            const fieldName = `caisse[${id}][${fieldId}]`;
            return `<div class="form-group"><label>${tpe.nom}</label><input type="text" id="${fieldId}" name="${fieldName}" data-caisse-id="${id}" value="${caisseData[fieldId] || ''}"></div>`;
        }).join('');
        
        contentHtml += `<div id="caisse${id}_wizard" class="caisse-tab-content ${isActive}">
            <div class="grid grid-3" style="margin-bottom:20px;">
                <div class="form-group"><label>Fond de Caisse</label>${buildTextInput('fond_de_caisse', caisseData.fond_de_caisse, id)}</div>
                <div class="form-group"><label>Ventes</label>${buildTextInput('ventes', caisseData.ventes, id)}</div>
                <div class="form-group"><label>Rétrocessions</label>${buildTextInput('retrocession', caisseData.retrocession, id)}</div>
            </div>
            <div class="payment-method-tabs">
                <div class="payment-method-selector"><button type="button" class="payment-tab-link active" data-payment-tab="especes_${id}"><i class="fa-solid fa-money-bill-wave"></i> Espèces</button>${tpeHtml ? `<button type="button" class="payment-tab-link" data-payment-tab="cb_${id}"><i class="fa-solid fa-credit-card"></i> Carte Bancaire</button>` : ''}</div>
                <div id="especes_${id}" class="payment-tab-content active"><h4>Billets</h4><div class="grid">${billets}</div><h4 style="margin-top:20px;">Pièces</h4><div class="grid">${pieces}</div></div>
                ${tpeHtml ? `<div id="cb_${id}" class="payment-tab-content"><div class="grid">${tpeHtml}</div></div>` : ''}
            </div>
        </div>`;
    });
    container.innerHTML = `<div class="wizard-step-content"><h3>Vérifiez les comptages</h3><div class="tab-selector">${tabsHtml}</div><div class="ecart-display-container">${ecartsHtml}</div><div id="caisses-content-container">${contentHtml}</div></div>`;
    wizardState.selectedCaisses.forEach(id => calculateAllForCaisse(id));
}

function renderStep3_Summary() {
    const container = document.querySelector('.wizard-content');
    
    // La logique de génération du HTML reste la même
    let summaryHtml = wizardState.selectedCaisses.map(id => {
        const nom = config.nomsCaisses[id];
        
        // 1. On calcule les suggestions comme avant
        const suggestions = calculateWithdrawalSuggestion(id);
        
        // 2. CORRECTION : On sauvegarde les suggestions calculées dans l'état du wizard
        //    C'est cette ligne qui corrige le problème.
        wizardState.confirmedData[id] = { 
            withdrawals: suggestions.suggestions, 
            totalToWithdraw: suggestions.totalToWithdraw 
        };

        // 3. On génère le HTML pour l'affichage
        return `<div class="card"><h4>Synthèse pour ${nom}</h4>${renderSuggestionTable(suggestions)}</div>`;
    }).join('');

    container.innerHTML = `<div class="wizard-step-content"><h3>Synthèse des Opérations</h3>${summaryHtml}</div>`;
}

function renderStep4_Finalization() {
    const container = document.querySelector('.wizard-content');

    // --- Début du calcul ---
    let grandTotalVentes = 0;
    let grandTotalCompte = 0;
    let grandTotalRetraits = 0;
    let grandTotalEcart = 0;
    let rowsHtml = '';

    wizardState.selectedCaisses.forEach(id => {
        const nomCaisse = config.nomsCaisses[id] || `Caisse ${id}`;
        const caisseData = calculatorData.caisse[id] || {};
        const confirmedData = wizardState.confirmedData[id] || {};

        const ventes = parseLocaleFloat(caisseData.ventes) + parseLocaleFloat(caisseData.retrocession);
        const retrait = confirmedData.totalToWithdraw || 0;
        
        let totalCompte = 0;
        const allDenoms = { ...(config.denominations.billets || {}), ...(config.denominations.pieces || {}) };
        for (const name in caisseData.denominations) {
            totalCompte += (parseInt(caisseData.denominations[name], 10) || 0) * parseFloat(allDenoms[name]);
        }

        const ecart = totalCompte - ventes;
        const fondDeCaisseJ1 = totalCompte - retrait;

        // Mise à jour des totaux généraux
        grandTotalVentes += ventes;
        grandTotalCompte += totalCompte;
        grandTotalRetraits += retrait;
        grandTotalEcart += ecart;

        // Création de la ligne HTML pour le tableau de cette caisse
        rowsHtml += `
            <tr>
                <td><strong>${nomCaisse}</strong></td>
                <td>${formatCurrency(ventes)}</td>
                <td>${formatCurrency(totalCompte)}</td>
                <td class="ecart-${Math.abs(ecart) < 0.01 ? 'ok' : (ecart > 0 ? 'positif' : 'negatif')}">${formatCurrency(ecart)}</td>
                <td class="text-danger">${formatCurrency(retrait)}</td>
                <td class="text-success">${formatCurrency(fondDeCaisseJ1)}</td>
            </tr>
        `;
    });
    // --- Fin du calcul ---


    // --- Début du rendu HTML ---
    container.innerHTML = `
        <div class="wizard-step-content">
            <h3><i class="fa-solid fa-flag-checkered"></i> Synthèse Finale</h3>
            <p class="subtitle" style="text-align:center; margin-top:-20px; margin-bottom: 30px;">Veuillez vérifier les totaux avant de finaliser la journée.</p>
            
            <div class="card" style="padding:0;">
                <table class="final-summary-table">
                    <thead>
                        <tr>
                            <th>Caisse</th>
                            <th>Ventes Théoriques</th>
                            <th>Total Compté</th>
                            <th>Écart</th>
                            <th>Retrait</th>
                            <th>Fond de Caisse J+1</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>TOTAL GÉNÉRAL</strong></td>
                            <td><strong>${formatCurrency(grandTotalVentes)}</strong></td>
                            <td><strong>${formatCurrency(grandTotalCompte)}</strong></td>
                            <td class="ecart-${Math.abs(grandTotalEcart) < 0.01 ? 'ok' : (grandTotalEcart > 0 ? 'positif' : 'negatif')}"><strong>${formatCurrency(grandTotalEcart)}</strong></td>
                            <td class="text-danger"><strong>${formatCurrency(grandTotalRetraits)}</strong></td>
                            <td class="text-success"><strong>${formatCurrency(grandTotalCompte - grandTotalRetraits)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="next-steps-info">
                <h4>Que se passe-t-il après avoir finalisé ?</h4>
                <ul>
                    <li><i class="fa-solid fa-check-circle"></i> Un comptage "Clôture Générale" sera créé dans l'historique avec les chiffres de ce tableau.</li>
                    <li><i class="fa-solid fa-check-circle"></i> Un nouveau comptage "Fond de caisse J+1" sera automatiquement généré pour démarrer la journée de demain.</li>
                    <li><i class="fa-solid fa-check-circle"></i> L'état des caisses sera réinitialisé.</li>
                </ul>
            </div>

            <div class="confirmation-box">
                <label>
                    <input type="checkbox" id="final-confirmation-checkbox">
                    Je confirme avoir vérifié les montants et je souhaite clôturer la journée.
                </label>
            </div>
        </div>
    `;
    // --- Fin du rendu HTML ---

    // Logique pour activer/désactiver le bouton final
    const checkbox = document.getElementById('final-confirmation-checkbox');
    const nextBtn = document.getElementById('wizard-next-btn');
    
    // Assurer que le bouton est désactivé au départ
    nextBtn.disabled = true;

    checkbox.addEventListener('change', () => {
        nextBtn.disabled = !checkbox.checked;
    });
}


// --- Gestionnaire Principal ---
function updateWizardUI() {
    document.querySelectorAll('.step-item').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === wizardState.currentStep) {
            stepEl.classList.add('active');
        }
    });
    const nextBtn = document.getElementById('wizard-next-btn');
    const prevBtn = document.getElementById('wizard-prev-btn');
    switch(wizardState.currentStep) {
        case 1: 
            renderStep1_Selection(); // On appelle la nouvelle fonction
            prevBtn.style.display = 'none'; 
            nextBtn.textContent = 'Suivant'; 
            nextBtn.disabled = true; // On désactive par défaut, la fonction s'occupe du reste
            break;
        case 2: renderStep2_Counting(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Valider les comptages'; nextBtn.disabled = false; break;
        case 3: renderStep3_Summary(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Confirmer et Finaliser'; nextBtn.disabled = false; break;
        case 4: renderStep4_Finalization(); prevBtn.style.display = 'inline-block'; nextBtn.textContent = 'Terminer la Journée'; nextBtn.disabled = true; break;
    }
}

async function handleNextStep() {
    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn.disabled = true;
    if (wizardState.currentStep === 1) {
        wizardState.selectedCaisses = Array.from(document.querySelectorAll('input:checked')).map(cb => cb.value);

        // --- DEBUT DE LA CORRECTION ---
        // On s'assure que chaque caisse sélectionnée a un objet de données, même vide.
        // Cela empêche l'erreur si une caisse n'avait pas de données dans la sauvegarde initiale.
        wizardState.selectedCaisses.forEach(id => {
            if (!calculatorData.caisse[id]) {
                console.log(`[Wizard] Initialisation des données pour la caisse ${id} qui n'était pas dans la sauvegarde.`);
                calculatorData.caisse[id] = {
                    denominations: {},
                    fond_de_caisse: '0',
                    ventes: '0',
                    retrocession: '0'
                };
            }
            // On envoie le message de verrouillage ici
            sendWsMessage({ type: 'cloture_lock', caisse_id: id });
        });
        // --- FIN DE LA CORRECTION ---

        wizardState.currentStep = 2;
    } 
    else if (wizardState.currentStep === 2) { wizardState.currentStep = 3; }
    else if (wizardState.currentStep === 3) { wizardState.currentStep = 4; }
    else if (wizardState.currentStep === 4) {
        const formData = new FormData();
        formData.append('explication', 'Clôture de journée via l\'assistant.');
        wizardState.selectedCaisses.forEach(id => {
            formData.append('caisses_a_cloturer[]', id);
            // Cette boucle est maintenant sécurisée grâce à la correction ci-dessus
            for (const [key, value] of Object.entries(calculatorData.caisse[id])) {
                if (key !== 'denominations') {
                     formData.append(`caisse[${id}][${key}]`, value);
                } else {
                    for(const [denomName, denomValue] of Object.entries(value)) {
                        formData.append(`caisse[${id}][${denomName}]`, denomValue);
                    }
                }
            }
            wizardState.confirmedData[id].withdrawals.forEach(s => {
                formData.append(`retraits[${id}][${s.name}]`, s.qty);
            });
        });
        try {
            const response = await fetch('index.php?route=cloture/confirm_caisse', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            sendWsMessage({ type: 'force_reload_all' }); // Notifie les autres clients

            alert('Clôture réussie ! La page va être rechargée.');
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_caisse_confirmed', caisse_id: id }));
            window.location.href = '/calculateur';
            return;
        } catch (error) {
            console.error("[Wizard] Erreur lors de la soumission :", error);
            alert(`Erreur: ${error.message}`);
            nextBtn.disabled = false;
        }
    }
    updateWizardUI();
}

function handlePrevStep() {
    if (wizardState.currentStep === 2) {
        wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
        wizardState.selectedCaisses = [];
    }
    wizardState.currentStep--;
    updateWizardUI();
}

function attachWizardListeners() {
    document.getElementById('wizard-next-btn').addEventListener('click', handleNextStep);
    document.getElementById('wizard-prev-btn').addEventListener('click', handlePrevStep);
    document.getElementById('wizard-cancel-btn').addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment annuler ?")) {
            wizardState.selectedCaisses.forEach(id => sendWsMessage({ type: 'cloture_unlock', caisse_id: id }));
            window.location.href = '/calculateur';
        }
    });
    const wizardContent = document.querySelector('.wizard-content');
    wizardContent.addEventListener('input', e => {
        if (e.target.tagName === 'INPUT' && wizardState.currentStep === 2) {
            const caisseId = e.target.dataset.caisseId;
            const nameAttr = e.target.name;

            // --- DEBUT DE LA CORRECTION ---
            // Envoyer la mise à jour aux autres clients via WebSocket
            sendWsMessage({ type: 'update', id: e.target.id, value: e.target.value });
            // --- FIN DE LA CORRECTION ---

            if (caisseId && calculatorData.caisse[caisseId] && nameAttr) {
                const match = nameAttr.match(/\[(\w+)\]$/);
                if (match) {
                    const key = match[1];
                    if (config.denominations.billets[key] || config.denominations.pieces[key]) {
                        if (!calculatorData.caisse[caisseId].denominations) {
                            calculatorData.caisse[caisseId].denominations = {};
                        }
                        calculatorData.caisse[caisseId].denominations[key] = e.target.value;
                    } else {
                        calculatorData.caisse[caisseId][key] = e.target.value;
                    }
                    if (!key.startsWith('tpe_')) {
                        calculateAllForCaisse(caisseId);
                    }
                }
            }
        }
    });
    wizardContent.addEventListener('click', e => {
        const mainTab = e.target.closest('.tab-link');
        const paymentTab = e.target.closest('.payment-tab-link');
        if (mainTab) {
            wizardContent.querySelectorAll('.tab-link, .caisse-tab-content, .ecart-display').forEach(el => el.classList.remove('active'));
            mainTab.classList.add('active');
            const tabId = mainTab.dataset.tab;
            wizardContent.querySelector(`#${tabId}`)?.classList.add('active');
            wizardContent.querySelector(`#ecart-display-${tabId}`)?.classList.add('active');
        } else if (paymentTab) {
            const container = paymentTab.closest('.payment-method-tabs');
            container.querySelectorAll('.payment-tab-link, .payment-tab-content').forEach(el => el.classList.remove('active'));
            paymentTab.classList.add('active');
            const tabId = paymentTab.dataset.paymentTab;
            container.querySelector(`#${tabId}`)?.classList.add('active');
        }
    });
}

export async function initializeClotureWizard() {
    try {
        await fetchInitialData();
        updateWizardUI();
        attachWizardListeners();
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de l'assistant de clôture :", error);
        document.querySelector('.wizard-content').innerHTML = `<p class="error">${error.message}</p>`;
        document.getElementById('wizard-next-btn').disabled = true;
        document.getElementById('wizard-prev-btn').style.display = 'none';
    }
}
