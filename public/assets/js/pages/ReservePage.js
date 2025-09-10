// Fichier : public/assets/js/pages/ReservePage.js (Version Complète et Corrigée)

import { initializeReserveLogic } from '../logic/reserve-logic.js';

export function renderReservePage(element) {
  element.innerHTML = `
    <div class="container" id="reserve-page">

        <section id="reserve-status-section" class="reserve-section">
            <div class="section-header">
                <h2><i class="fa-solid fa-vault"></i> État de la Réserve</h2>
                <div id="reserve-total-value" class="total-value-display">Chargement...</div>
            </div>
            <div id="reserve-denominations-grid" class="denominations-grid">
                </div>
        </section>

        <div class="interaction-panel">
            <section id="demandes-section" class="reserve-section">
                <div class="section-header">
                    <h3><i class="fa-solid fa-right-left"></i> Demandes & Traitement</h3>
                    <button id="show-demande-form-btn" class="btn new-btn"><i class="fa-solid fa-plus"></i> Nouvelle Demande</button>
                </div>
                
                <div id="demande-form-container"></div>
                
                <div id="demandes-en-attente-list">
                    </div>
            </section>

            <section id="historique-section" class="reserve-section">
                <div class="section-header">
                    <h3><i class="fa-solid fa-timeline"></i> Derniers Mouvements</h3>
                </div>
                <div id="historique-list">
                    </div>
            </section>
        </div>
    </div>

    <div id="process-demande-modal" class="modal">
        <div class="modal-content">
            <div id="process-demande-modal-content">
                </div>
        </div>
    </div>
  `;

  initializeReserveLogic();
}
