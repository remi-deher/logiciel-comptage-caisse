// public/js/history/comparison.js
// Ce module gère l'état et l'interface de la fonctionnalité de comparaison.

import * as dom from './dom.js';
import { state } from './state.js'; // Importe l'état partagé

/**
 * Met à jour la barre d'outils de comparaison (visibilité, compteur, état du bouton).
 */
export function updateComparisonToolbar() {
    const count = state.selectedForComparison.length; // Utilise l'état partagé
    
    if (dom.comparisonCounter) {
        dom.comparisonCounter.textContent = `${count} comptage(s) sélectionné(s)`;
    }

    if (dom.comparisonToolbar) {
        if (count > 0) {
            dom.comparisonToolbar.classList.add('visible');
        } else {
            dom.comparisonToolbar.classList.remove('visible');
        }
    }

    if (dom.compareBtn) {
        dom.compareBtn.disabled = count < 2;
    }
}

/**
 * Gère le changement d'état d'une checkbox de sélection.
 * Ajoute ou retire un ID de la liste de comparaison et met à jour l'UI.
 * @param {Event} event - L'événement 'change' de la checkbox.
 */
export function handleSelectionChange(event) {
    const checkbox = event.target;
    if (!checkbox.classList.contains('comparison-checkbox')) return;

    const card = checkbox.closest('.history-card');
    if (!card) return;

    const comptageId = card.dataset.id;

    if (checkbox.checked) {
        if (!state.selectedForComparison.includes(comptageId)) {
            state.selectedForComparison.push(comptageId); // Modifie l'état partagé
        }
        card.classList.add('selected');
    } else {
        const index = state.selectedForComparison.indexOf(comptageId);
        if (index > -1) {
            state.selectedForComparison.splice(index, 1); // Modifie l'état partagé
        }
        card.classList.remove('selected');
    }
    
    updateComparisonToolbar();
}
