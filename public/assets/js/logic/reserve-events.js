// Fichier : public/assets/js/logic/reserve-events.js

import { sendWsMessage } from './websocket-service.js';
import * as service from './reserve-service.js';
import * as ui from './reserve-ui.js';
import { formatCurrency } from '../utils/formatters.js';

/**
 * Attache tous les écouteurs d'événements pour la page de la réserve.
 */
export function attachEventListeners(pageElement, state, loadAndRender) {
    const showFormBtn = document.getElementById('show-demande-form-btn');
    const demandeForm = document.getElementById('new-demande-form');
    const demandesListContainer = document.getElementById('demandes-en-attente-list');
    const processModal = document.getElementById('process-demande-modal');

    // --- Gestion du formulaire de nouvelle demande ---

    showFormBtn.addEventListener('click', () => {
        demandeForm.classList.remove('hidden');
        showFormBtn.classList.add('hidden');
    });

    demandeForm.addEventListener('click', (e) => {
        if (e.target.id === 'cancel-demande-btn') {
            demandeForm.classList.add('hidden');
            showFormBtn.classList.remove('hidden');
            demandeForm.reset();
            document.getElementById('demande-valeur').textContent = formatCurrency(0, state.config);
        }
    });

    demandeForm.addEventListener('input', () => {
        const quantite = parseInt(document.getElementById('demande-quantite').value) || 0;
        const denomName = document.getElementById('demande-denomination').value;
        const allDenominations = { ...state.config.denominations.billets, ...state.config.denominations.pieces };
        const denomValue = allDenominations[denomName] || 0;
        document.getElementById('demande-valeur').textContent = formatCurrency(quantite * denomValue, state.config);
    });

    demandeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = demandeForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'Envoi...';
        try {
            const result = await service.submitDemande(new FormData(demandeForm));
            if (!result.success) throw new Error(result.message);
            alert('Demande envoyée avec succès !');
            sendWsMessage({ type: 'nouvelle_demande_reserve' });
            demandeForm.querySelector('#cancel-demande-btn').click();
            loadAndRender();
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = 'Envoyer';
        }
    });

    // --- Gestion de la modale de traitement ---

    demandesListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('process-demande-btn')) {
            const card = e.target.closest('.demande-card');
            const demandeData = {
                id: card.dataset.demandeId,
                caisseId: card.dataset.caisseId,
                caisseNom: card.dataset.caisseNom,
                valeurDemandee: parseFloat(card.dataset.valeurDemandee)
            };
            ui.renderProcessModal(demandeData, state.config);
            processModal.classList.add('visible');
        }
    });

    processModal.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close, .modal-cancel-btn, .modal')) {
            processModal.classList.remove('visible');
        }
    });

    processModal.addEventListener('input', (e) => {
        if (e.target.matches('input[type="number"], select')) {
            const form = document.getElementById('process-demande-form');
            const allDenominations = { ...state.config.denominations.billets, ...state.config.denominations.pieces };
            const qteVers = parseInt(form.elements.quantite_vers_caisse.value) || 0;
            const denomVers = form.elements.denomination_vers_caisse.value;
            const totalVers = qteVers * parseFloat(allDenominations[denomVers] || 0);
            const qteDepuis = parseInt(form.elements.quantite_depuis_caisse.value) || 0;
            const denomDepuis = form.elements.denomination_depuis_caisse.value;
            const totalDepuis = qteDepuis * parseFloat(allDenominations[denomDepuis] || 0);

            document.getElementById('total-vers-caisse').textContent = formatCurrency(totalVers, state.config);
            document.getElementById('total-depuis-caisse').textContent = formatCurrency(totalDepuis, state.config);

            const balance = totalVers - totalDepuis;
            const balanceIndicator = document.getElementById('balance-indicator');
            const confirmBtn = document.getElementById('confirm-exchange-btn');
            balanceIndicator.querySelector('span').textContent = `Balance : ${formatCurrency(balance, state.config)}`;
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
        submitBtn.disabled = true; submitBtn.textContent = 'Traitement...';
        try {
            const result = await service.submitProcessDemande(new FormData(form));
            if (!result.success) throw new Error(result.message);
            alert('Échange validé avec succès !');
            sendWsMessage({ type: 'nouvelle_demande_reserve' });
            processModal.classList.remove('visible');
            loadAndRender();
        } catch (error) {
            alert(`Erreur : ${error.message}`);
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = 'Valider l\'échange';
        }
    });
}
