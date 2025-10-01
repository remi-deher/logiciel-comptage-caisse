// Fichier : public/assets/js/logic/reserve-ui.js

import { formatCurrency, formatDateFr } from '../utils/formatters.js';

/**
 * Affiche l'état actuel de la réserve (quantités et totaux par dénomination).
 */
export function renderReserveStatus(container, status, config) {
    if (!container) return;
    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };
    const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);

    document.getElementById('reserve-total-value').textContent = formatCurrency(status.total, config);
    
    container.innerHTML = sortedDenoms.map(([name, value]) => {
        const quantite = status.denominations[name] || 0;
        const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
        return `
            <div class="denom-card">
                <h4>${label}</h4>
                <div class="quantite">${quantite}</div>
                <div class="valeur">${formatCurrency(quantite * value, config)}</div>
            </div>`;
    }).join('');
}

/**
 * Affiche la liste des demandes de monnaie en attente.
 */
export function renderDemandes(container, demandes, config) {
    if (!container) return;
    if (demandes.length === 0) {
        container.innerHTML = '<div class="card"><p style="text-align: center; margin: 0;">Aucune demande en attente.</p></div>';
        return;
    }

    container.innerHTML = demandes.map(demande => {
         // Nouvelle logique pour afficher les détails depuis le JSON
        const detailsHtml = (demande.details || []).map(item => {
            const denomValue = (config.denominations.billets[item.denomination] || config.denominations.pieces[item.denomination]);
            const label = denomValue >= 1 ? `${denomValue} ${config.currencySymbol}` : `${denomValue * 100} cts`;
            const unit = item.type === 'rouleau' ? (item.quantite > 1 ? 'Rouleaux' : 'Rouleau') : (item.type === 'billet' ? 'x' : 'pièces');
            return `<strong>${item.quantite}</strong> ${unit} de ${label}`;
        }).join('<br>');

         return `
            <div class="card demande-card" data-demande-id="${demande.id}" data-caisse-id="${demande.caisse_id}" data-caisse-nom="${demande.caisse_nom}" data-valeur-demandee="${demande.valeur_demandee}">
                <div class="demande-header">
                    <h5>Demande de <strong>${demande.caisse_nom}</strong> <small>par ${demande.demandeur_nom}</small></h5>
                    <span class="date">${formatDateFr(demande.date_demande)}</span>
                </div>
                <div class="demande-body">
                    <div>
                        <strong>Besoin de :</strong><br> ${detailsHtml}
                        <div class="valeur-display">${formatCurrency(demande.valeur_demandee, config)}</div>
                    </div>
                    <button class="btn save-btn process-demande-btn">Traiter</button>
                </div>
                ${demande.notes_demandeur ? `<div class="demande-footer"><strong>Notes :</strong> ${demande.notes_demandeur}</div>` : ''}
            </div>`;
    }).join('');
}


/**
 * Affiche l'historique des dernières opérations.
 */
export function renderHistorique(container, historique, config) {
    if (!container) return;
     if (historique.length === 0) {
        container.innerHTML = '<p>Aucune opération récente.</p>';
        return;
    }
    container.innerHTML = historique.map(h => `
        <div class="card">
            <div class="historique-item-header">
                <span>Par ${h.approbateur_nom || 'Admin'} pour ${h.caisse_nom}</span>
                <span>${formatDateFr(h.date_operation)}</span>
            </div>
            <div class="historique-item-body">
                <div class="valeur-display">${formatCurrency(h.valeur_echange, config)}</div>
            </div>
        </div>
    `).join('');
}


/**
 * Affiche le formulaire de nouvelle demande avec la distinction pièces/rouleaux.
 */
export function renderDemandeForm(container, config) {
    if (!container) return;
    
    const caisseOptions = Object.entries(config.nomsCaisses).map(([id, nom]) => `<option value="${id}">${nom}</option>`).join('');
    
    // Trier les billets et les pièces
    const sortedBillets = Object.entries(config.denominations.billets).sort((a, b) => b[1] - a[1]);
    const sortedPieces = Object.entries(config.denominations.pieces).sort((a, b) => b[1] - a[1]);

    const billetsHtml = sortedBillets.map(([name, value]) => `
        <div class="demande-form-row">
            <label>${value} ${config.currencySymbol}</label>
            <input type="hidden" name="demande_billets_denoms[]" value="${name}">
            <input type="number" name="demande_billets_qtys[]" min="0" placeholder="Qté" class="inline-input">
        </div>
    `).join('');

    const piecesHtml = sortedPieces.map(([name, value]) => `
        <div class="demande-form-row">
            <label>${value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`}</label>
            <input type="hidden" name="demande_pieces_denoms[]" value="${name}">
            <input type="number" name="demande_pieces_qtys[]" min="0" placeholder="Pièces" class="inline-input">
            <input type="number" name="demande_rouleaux_qtys[]" min="0" placeholder="Rouleaux" class="inline-input">
        </div>
    `).join('');

    container.innerHTML = `
        <form id="new-demande-form" class="card hidden">
            <h4>Faire une nouvelle demande</h4>
            <div class="form-group">
                <label for="demande-caisse-id">Pour la caisse</label>
                <select id="demande-caisse-id" name="caisse_id" required>${caisseOptions}</select>
            </div>
            
            <div class="demande-grid">
                <div class="demande-column">
                    <h5>Billets</h5>
                    ${billetsHtml}
                </div>
                <div class="demande-column">
                    <h5>Pièces</h5>
                    ${piecesHtml}
                </div>
            </div>

            <div class="form-group">
                <label for="notes_demandeur">Notes (optionnel)</label>
                <textarea id="notes_demandeur" name="notes_demandeur" rows="2" placeholder="Ex: Pour fond de caisse..."></textarea>
            </div>
            <div class="value-display">Total demandé: <span id="demande-valeur">0,00 ${config.currencySymbol}</span></div>
            <div class="form-actions">
                <button type="button" id="cancel-demande-btn" class="btn delete-btn">Annuler</button>
                <button type="submit" class="btn save-btn">Envoyer la Demande</button>
            </div>
        </form>
    `;
}


/**
 * Affiche le contenu de la modale de traitement de demande.
 */
export function renderProcessModal(demandeData, config) {
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
            <div class="modal-header"><h3>Traiter la demande pour ${demandeData.caisseNom}</h3><span class="modal-close">&times;</span></div>
            <div class="modal-body">
                <input type="hidden" name="demande_id" value="${demandeData.id}"><input type="hidden" name="caisse_id" value="${demandeData.caisseId}">
                <div class="exchange-summary"><span>Besoin de la caisse :</span><strong class="total-needed">${formatCurrency(demandeData.valeurDemandee, config)}</strong></div>
                <div class="exchange-grid">
                    <div class="exchange-panel">
                        <h4><i class="fa-solid fa-arrow-up-from-bracket"></i> Donner à la caisse</h4>
                        <div class="form-group"><label>Dénomination</label><select name="denomination_vers_caisse" required>${denomOptions}</select></div>
                        <div class="form-group"><label>Quantité</label><input type="number" name="quantite_vers_caisse" min="0" required value="0"></div>
                        <div class="value-display">Total donné : <span id="total-vers-caisse">0,00 €</span></div>
                    </div>
                    <div class="exchange-panel">
                        <h4><i class="fa-solid fa-arrow-down-to-bracket"></i> Reprendre de la caisse</h4>
                        <div class="form-group"><label>Dénomination</label><select name="denomination_depuis_caisse" required>${denomOptions}</select></div>
                        <div class="form-group"><label>Quantité</label><input type="number" name="quantite_depuis_caisse" min="0" required value="0"></div>
                        <div class="value-display">Total repris : <span id="total-depuis-caisse">0,00 €</span></div>
                    </div>
                </div>
                <div class="balance-indicator" id="balance-indicator"><i class="fa-solid fa-scale-unbalanced"></i><span>La balance doit être égale à 0.00 €</span></div>
                <div class="form-group"><label for="notes">Notes (optionnel)</label><textarea id="notes" name="notes" rows="2" placeholder="Ex: Remplacement de 2x10€ par 1x20€"></textarea></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn delete-btn modal-cancel-btn">Annuler</button><button type="submit" class="btn save-btn" id="confirm-exchange-btn" disabled>Valider l'échange</button></div>
        </form>
    `;
}
