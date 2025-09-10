// Fichier : public/assets/js/logic/reserve-logic.js (Version Complète et Corrigée)

import { sendWsMessage } from './websocket-service.js';

let config = {}; // Pour stocker la configuration (dénominations, caisses, etc.)

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

// --- API ---
async function fetchReserveData() {
    const response = await fetch('index.php?route=reserve/get_data');
    if (!response.ok) throw new Error('Impossible de charger les données de la réserve.');
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Réponse invalide de l\'API de la réserve.');
    return data;
}

async function submitDemande(formData) {
    const response = await fetch('index.php?route=reserve/submit_demande', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}

async function submitProcessDemande(formData) {
    const response = await fetch('index.php?route=reserve/process_demande', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}

// --- Rendu (Affichage) ---

function renderReserveStatus(container, status) {
    if (!container) return;
    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);

    document.getElementById('reserve-total-value').textContent = formatCurrency(status.total);
    
    container.innerHTML = sortedDenoms.map(([name, value]) => {
        const quantite = status.denominations[name] || 0;
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        return `
            <div class="denom-card">
                <h4>${label}</h4>
                <div class="quantite">${quantite}</div>
                <div class="valeur">${formatCurrency(quantite * value)}</div>
            </div>`;
    }).join('');
}

function renderDemandes(container, demandes) {
    if (!container) return;
    if (demandes.length === 0) {
        container.innerHTML = '<div class="card"><p style="text-align: center; margin: 0;">Aucune demande en attente.</p></div>';
        return;
    }

    container.innerHTML = demandes.map(demande => {
         const denomValue = (config.denominations.billets[demande.denomination_demandee] || config.denominations.pieces[demande.denomination_demandee]);
         const label = denomValue >= 1 ? `${denomValue} ${config.currencySymbol}` : `${denomValue * 100} cts`;
         return `
            <div class="card demande-card" data-demande-id="${demande.id}" data-caisse-id="${demande.caisse_id}" data-caisse-nom="${demande.caisse_nom}" data-valeur-demandee="${demande.valeur_demandee}">
                <div class="demande-header">
                    <h5>Demande de <strong>${demande.caisse_nom}</strong> <small>par ${demande.demandeur_nom}</small></h5>
                    <span class="date">${new Date(demande.date_demande).toLocaleString('fr-FR')}</span>
                </div>
                <div class="demande-body">
                    <div>
                        <strong>Besoin de :</strong> ${demande.quantite_demandee} x ${label}
                        <div class="valeur-display">${formatCurrency(demande.valeur_demandee)}</div>
                    </div>
                    <button class="btn save-btn process-demande-btn">Traiter</button>
                </div>
                ${demande.notes_demandeur ? `<div class="demande-footer"><strong>Notes :</strong> ${demande.notes_demandeur}</div>` : ''}
            </div>
         `;
    }).join('');
}

function renderHistorique(container, historique) {
    if (!container) return;
     if (historique.length === 0) {
        container.innerHTML = '<p>Aucune opération récente.</p>';
        return;
    }
    container.innerHTML = historique.map(h => `
        <div class="card">
            <div class="historique-item-header">
                <span>Par ${h.approbateur_nom || 'Admin'} pour ${h.caisse_nom}</span>
                <span>${new Date(h.date_operation).toLocaleString('fr-FR')}</span>
            </div>
            <div class="historique-item-body">
                <div class="valeur-display">${formatCurrency(h.valeur_echange)}</div>
            </div>
        </div>
    `).join('');
}

function renderDemandeForm(container) {
    if (!container) return;
    
    const caisseOptions = Object.entries(config.nomsCaisses).map(([id, nom]) => `<option value="${id}">${nom}</option>`).join('');
    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
    const denomOptions = sortedDenoms.map(([name, value]) => {
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        return `<option value="${name}">${label}</option>`;
    }).join('');

    container.innerHTML = `
        <form id="new-demande-form" class="card hidden">
            <h4>Faire une nouvelle demande</h4>
            <div class="form-group">
                <label for="demande-caisse-id">Pour la caisse</label>
                <select id="demande-caisse-id" name="caisse_id" required>${caisseOptions}</select>
            </div>
             <div class="form-group">
                <label for="demande-denomination">J'ai besoin de</label>
                <select id="demande-denomination" name="denomination_demandee" required>${denomOptions}</select>
            </div>
            <div class="form-group">
                <label for="demande-quantite">Quantité</label>
                <input type="number" id="demande-quantite" name="quantite_demandee" min="1" required>
            </div>
             <div class="form-group">
                <label for="notes_demandeur">Notes (optionnel)</label>
                <textarea id="notes_demandeur" name="notes_demandeur" rows="2" placeholder="Ex: Pour fond de caisse..."></textarea>
            </div>
            <div class="value-display">Total demandé: <span id="demande-valeur">0,00 ${config.currencySymbol}</span></div>
            <div class="form-actions">
                <button type="button" id="cancel-demande-btn" class="btn delete-btn">Annuler</button>
                <button type="submit" class="btn save-btn">Envoyer</button>
            </div>
        </form>
    `;
}

function renderProcessModal(demandeData) {
    const modalContent = document.getElementById('process-demande-modal-content');
    if (!modalContent) return;

    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
    const denomOptions = sortedDenoms.map(([name, value]) => {
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        return `<option value="${name}">${label}</option>`;
    }).join('');

    modalContent.innerHTML = `
        <form id="process-demande-form">
            <div class="modal-header">
                <h3>Traiter la demande pour ${demandeData.caisseNom}</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <input type="hidden" name="demande_id" value="${demandeData.id}">
                <input type="hidden" name="caisse_id" value="${demandeData.caisseId}">

                <div class="exchange-summary">
                    <span>Besoin de la caisse :</span>
                    <strong class="total-needed">${formatCurrency(demandeData.valeurDemandee)}</strong>
                </div>

                <div class="exchange-grid">
                    <div class="exchange-panel">
                        <h4><i class="fa-solid fa-arrow-up-from-bracket"></i> Donner à la caisse</h4>
                        <div class="form-group">
                            <label>Dénomination</label>
                            <select name="denomination_vers_caisse" required>${denomOptions}</select>
                        </div>
                        <div class="form-group">
                            <label>Quantité</label>
                            <input type="number" name="quantite_vers_caisse" min="0" required value="0">
                        </div>
                        <div class="value-display">Total donné : <span id="total-vers-caisse">0,00 €</span></div>
                    </div>
                    <div class="exchange-panel">
                        <h4><i class="fa-solid fa-arrow-down-to-bracket"></i> Reprendre de la caisse</h4>
                        <div class="form-group">
                            <label>Dénomination</label>
                            <select name="denomination_depuis_caisse" required>${denomOptions}</select>
                        </div>
                        <div class="form-group">
                            <label>Quantité</label>
                            <input type="number" name="quantite_depuis_caisse" min="0" required value="0">
                        </div>
                        <div class="value-display">Total repris : <span id="total-depuis-caisse">0,00 €</span></div>
                    </div>
                </div>
                <div class="balance-indicator" id="balance-indicator">
                    <i class="fa-solid fa-scale-unbalanced"></i>
                    <span>La balance doit être égale à 0.00 €</span>
                </div>
                 <div class="form-group">
                    <label for="notes">Notes (optionnel)</label>
                    <textarea id="notes" name="notes" rows="2" placeholder="Ex: Remplacement de 2x10€ par 1x20€"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn delete-btn modal-cancel-btn">Annuler</button>
                <button type="submit" class="btn save-btn" id="confirm-exchange-btn" disabled>Valider l'échange</button>
            </div>
        </form>
    `;
}


// --- Point d'entrée de la logique de la page ---
export async function initializeReserveLogic() {
    const reservePage = document.getElementById('reserve-page');
    if (!reservePage) return;

    try {
        const configResponse = await fetch('index.php?route=calculateur/config');
        config = await configResponse.json();

        const statusGrid = document.getElementById('reserve-denominations-grid');
        const demandesList = document.getElementById('demandes-en-attente-list');
        const historiqueList = document.getElementById('historique-list');
        const formContainer = document.getElementById('demande-form-container');

        renderDemandeForm(formContainer); // Crée le formulaire

        async function loadAndRender() {
            try {
                statusGrid.innerHTML = '<p>Chargement...</p>';
                demandesList.innerHTML = '<p>Chargement...</p>';
                historiqueList.innerHTML = '<p>Chargement...</p>';
                
                const data = await fetchReserveData();
                renderReserveStatus(statusGrid, data.reserve_status);
                renderDemandes(demandesList, data.demandes_en_attente);
                renderHistorique(historiqueList, data.historique);
            } catch (error) {
                const errorContainer = document.getElementById('reserve-status-section');
                errorContainer.innerHTML = `<p class="error">${error.message}</p>`;
            }
        }
        
        loadAndRender(); // Chargement initial

        // --- Événements ---
        const showFormBtn = document.getElementById('show-demande-form-btn');
        const demandeForm = document.getElementById('new-demande-form');
        
        showFormBtn.addEventListener('click', () => {
            demandeForm.classList.remove('hidden');
            showFormBtn.classList.add('hidden');
        });

        demandeForm.addEventListener('click', (e) => {
            if (e.target.id === 'cancel-demande-btn') {
                demandeForm.classList.add('hidden');
                showFormBtn.classList.remove('hidden');
                demandeForm.reset();
            }
        });
        
        demandeForm.addEventListener('input', () => {
             const quantite = parseInt(document.getElementById('demande-quantite').value) || 0;
             const denomName = document.getElementById('demande-denomination').value;
             const denomValue = (config.denominations.billets[denomName] || config.denominations.pieces[denomName]) || 0;
             document.getElementById('demande-valeur').textContent = formatCurrency(quantite * denomValue);
        });

        demandeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = demandeForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi...';

            try {
                const result = await submitDemande(new FormData(demandeForm));
                if (!result.success) throw new Error(result.message);
                
                alert('Demande envoyée avec succès !');
                sendWsMessage({ type: 'nouvelle_demande_reserve' });
                demandeForm.reset();
                demandeForm.querySelector('#cancel-demande-btn').click();
                loadAndRender(); // Recharge les données pour voir la nouvelle demande
            } catch (error) {
                alert(`Erreur: ${error.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer';
            }
        });
        
        // --- Logique de la modale de traitement ---
        const demandesListContainer = document.getElementById('demandes-en-attente-list');
        const processModal = document.getElementById('process-demande-modal');

        demandesListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('process-demande-btn')) {
                const card = e.target.closest('.demande-card');
                const demandeData = {
                    id: card.dataset.demandeId,
                    caisseId: card.dataset.caisseId,
                    caisseNom: card.dataset.caisseNom,
                    valeurDemandee: parseFloat(card.dataset.valeurDemandee)
                };
                renderProcessModal(demandeData);
                processModal.classList.add('visible');
            }
        });

        processModal.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close') || e.target.matches('.modal-cancel-btn') || e.target === processModal) {
                processModal.classList.remove('visible');
            }
        });

        processModal.addEventListener('input', (e) => {
            if (e.target.matches('input[type="number"], select')) {
                const form = document.getElementById('process-demande-form');
                const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };

                const qteVers = parseInt(form.elements.quantite_vers_caisse.value) || 0;
                const denomVers = form.elements.denomination_vers_caisse.value;
                const totalVers = qteVers * parseFloat(allDenominations[denomVers] || 0);

                const qteDepuis = parseInt(form.elements.quantite_depuis_caisse.value) || 0;
                const denomDepuis = form.elements.denomination_depuis_caisse.value;
                const totalDepuis = qteDepuis * parseFloat(allDenominations[denomDepuis] || 0);

                document.getElementById('total-vers-caisse').textContent = formatCurrency(totalVers);
                document.getElementById('total-depuis-caisse').textContent = formatCurrency(totalDepuis);

                const balance = totalVers - totalDepuis;
                const balanceIndicator = document.getElementById('balance-indicator');
                const confirmBtn = document.getElementById('confirm-exchange-btn');

                balanceIndicator.querySelector('span').textContent = `Balance : ${formatCurrency(balance)}`;
                if (Math.abs(balance) < 0.01) {
                    balanceIndicator.className = 'balance-indicator balance-ok';
                    balanceIndicator.querySelector('i').className = 'fa-solid fa-scale-balanced';
                    confirmBtn.disabled = false;
                } else {
                    balanceIndicator.className = 'balance-indicator balance-nok';
                    balanceIndicator.querySelector('i').className = 'fa-solid fa-scale-unbalanced';
                    confirmBtn.disabled = true;
                }
            }
        });

        processModal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Traitement...';

            try {
                const result = await submitProcessDemande(new FormData(form));
                if (!result.success) throw new Error(result.message);
                
                alert('Échange validé avec succès !');
                sendWsMessage({ type: 'nouvelle_demande_reserve' }); // Notifie les autres clients
                processModal.classList.remove('visible');
                loadAndRender(); // Recharge les données pour mettre à jour la liste
            } catch (error) {
                alert(`Erreur : ${error.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Valider l\'échange';
            }
        });
        
    } catch (error) {
        reservePage.innerHTML = `<div class="container error"><p>Impossible de charger la configuration : ${error.message}</p></div>`;
    }
}
