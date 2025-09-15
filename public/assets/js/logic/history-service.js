// Fichier : public/assets/js/logic/history-service.js

/**
 * Récupère les données de configuration et l'historique des comptages depuis l'API.
 */
export async function fetchHistoriqueData(params) {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());

    const [config, history] = await Promise.all([configPromise, historyPromise]);

    if (!history.success || !history.historique) {
        throw new Error(history.message || "La réponse de l'API pour l'historique est invalide.");
    }

    // On stocke la config dans une variable globale accessible par les autres fonctions du service
    // C'est un petit raccourci pour éviter de passer la config à chaque fonction
    service.config = config;

    return { config, history };
}

/**
 * Traite les données de retraits pour les agréger par jour.
 */
export function processWithdrawalData(comptages, denominations, nomsCaisses) {
    const withdrawalsByDay = {};
    const allDenomsValueMap = { ...(denominations.billets || {}), ...(denominations.pieces || {}) };

    if (!comptages) return {};

    for (const comptage of comptages) {
        const dateKey = new Date(comptage.date_comptage).toISOString().split('T')[0];
        if (!withdrawalsByDay[dateKey]) {
            withdrawalsByDay[dateKey] = { totalValue: 0, totalItems: 0, details: [] };
        }
        if (!comptage.caisses_data) continue;
        for (const [caisse_id, caisse] of Object.entries(comptage.caisses_data)) {
            if (!caisse.retraits || Object.keys(caisse.retraits).length === 0) continue;
            for (const [denom, qtyStr] of Object.entries(caisse.retraits)) {
                const qty = parseInt(qtyStr, 10);
                const value = parseFloat(allDenomsValueMap[denom]);
                if (!isNaN(qty) && !isNaN(value) && qty > 0) {
                    const amount = qty * value;
                    if (!isNaN(amount)) {
                        withdrawalsByDay[dateKey].totalValue += amount;
                        withdrawalsByDay[dateKey].totalItems += qty;
                        withdrawalsByDay[dateKey].details.push({ caisse_id, caisse_nom: nomsCaisses[caisse_id] || `Caisse ${caisse_id}`, denomination: denom, quantite: qty, valeur: amount });
                    }
                }
            }
        }
    }
    return withdrawalsByDay;
}

// On exporte un objet `service` pour pouvoir y attacher la config
export const service = {
    fetchHistoriqueData,
    processWithdrawalData,
    config: {}
};
