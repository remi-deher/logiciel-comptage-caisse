// Fichier : public/assets/js/logic/reserve-service.js

/**
 * Récupère toutes les données nécessaires pour la page de la réserve.
 * @returns {Promise<object>}
 */
export async function fetchReserveData() {
    const response = await fetch('index.php?route=reserve/get_data');
    if (!response.ok) throw new Error('Impossible de charger les données de la réserve.');
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Réponse invalide de l\'API de la réserve.');
    return data;
}

/**
 * Soumet une nouvelle demande de monnaie à l'API.
 * @param {FormData} formData - Les données du formulaire de demande.
 * @returns {Promise<object>}
 */
export async function submitDemande(formData) {
    const response = await fetch('index.php?route=reserve/submit_demande', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}

/**
 * Soumet les données de traitement d'une demande à l'API.
 * @param {FormData} formData - Les données du formulaire de la modale de traitement.
 * @returns {Promise<object>}
 */
export async function submitProcessDemande(formData) {
    const response = await fetch('index.php?route=reserve/process_demande', {
        method: 'POST',
        body: formData
    });
    return await response.json();
}
