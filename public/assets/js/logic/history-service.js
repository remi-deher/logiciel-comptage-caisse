// Fichier : public/assets/js/logic/history-service.js

/**
 * Récupère les données de configuration et l'historique des comptages depuis l'API.
 */
async function fetchHistoriqueData(params) {
    const configPromise = fetch('index.php?route=calculateur/config').then(res => res.json());
    const historyPromise = fetch(`index.php?route=historique/get_data&${new URLSearchParams(params)}`).then(res => res.json());

    const [config, history] = await Promise.all([configPromise, historyPromise]);

    if (!history.success || !history.historique) {
        throw new Error(history.message || "La réponse de l'API pour l'historique est invalide.");
    }
    
    // On retourne la config en plus de l'historique
    return { config, history };
}

/**
 * Traite les données de retraits pour les agréger par comptage de clôture.
 */
function processClotureWithdrawalData(comptages, denominations, nomsCaisses) {
    if (!comptages) return [];

    const allDenomsValueMap = { ...(denominations.billets || {}), ...(denominations.pieces || {}) };

    // 1. On filtre pour ne garder que les clôtures générales
    const clotures = comptages.filter(c => c.nom_comptage && c.nom_comptage.toLowerCase().startsWith('clôture générale'));
    
    // 2. On traite chaque clôture individuellement
    return clotures.map(comptage => {
        const clotureData = {
            id: comptage.id,
            nom_comptage: comptage.nom_comptage,
            date_comptage: comptage.date_comptage,
            totalValue: 0,
            totalItems: 0,
            totalBillets: 0,
            totalPieces: 0,
            details: []
        };

        if (!comptage.caisses_data) return clotureData;

        for (const [caisse_id, caisse] of Object.entries(comptage.caisses_data)) {
            if (!caisse.retraits || Object.keys(caisse.retraits).length === 0) continue;
            
            for (const [denom, qtyStr] of Object.entries(caisse.retraits)) {
                const qty = parseInt(qtyStr, 10);
                const value = parseFloat(allDenomsValueMap[denom]);

                if (!isNaN(qty) && !isNaN(value) && qty > 0) {
                    const amount = qty * value;
                    clotureData.totalValue += amount;
                    clotureData.totalItems += qty;
                    if (denom.startsWith('b')) {
                        clotureData.totalBillets += amount;
                    } else {
                        clotureData.totalPieces += amount;
                    }
                    clotureData.details.push({
                        caisse_id,
                        caisse_nom: nomsCaisses[caisse_id] || `Caisse ${caisse_id}`,
                        denomination: denom,
                        quantite: qty,
                        valeur: amount
                    });
                }
            }
        }
        return clotureData;
    }).sort((a, b) => new Date(b.date_comptage) - new Date(a.date_comptage));
}


// On exporte un objet `service`
export const service = {
    fetchHistoriqueData,
    processClotureWithdrawalData
};
