// public/js/history/utils.js
// Ce module contient des fonctions utilitaires pures pour le formatage et les calculs.

// --- CONFIGURATION ---
// On récupère la configuration globale qui est injectée dans le HTML.
// Cela évite de devoir passer cette configuration à chaque fonction.
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};


/**
 * Formate un montant numérique en une chaîne de caractères monétaire (ex: 123,45 €).
 * @param {number} montant Le montant à formater.
 * @returns {string} Le montant formaté en euros.
 */
export const formatEuros = (montant) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);

/**
 * Formate une chaîne de date ISO en un format français lisible (ex: "lundi 1 janvier 2024, 14:30").
 * @param {string} dateString La date à formater.
 * @returns {string} La date formatée.
 */
export const formatDateFr = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));
};

/**
 * Calcule tous les totaux pour un comptage donné.
 * C'est la fonction de calcul principale qui était dans votre fichier original.
 * @param {object} comptageData Les données complètes d'un comptage.
 * @returns {object} Un objet structuré avec les résultats par caisse et les totaux combinés.
 */
export function calculateResults(comptageData) {
    const results = {
        caisses: {},
        combines: {
            total_compté: 0,
            recette_reelle: 0,
            ecart: 0,
            recette_theorique: 0,
            fond_de_caisse: 0,
            ventes: 0,
            retrocession: 0,
            denominations: {},
            retraits: {}
        }
    };
    const denominations = globalConfig.denominations;

    for (const caisseId in comptageData.caisses_data) {
        if (!comptageData.caisses_data.hasOwnProperty(caisseId)) continue;
        const caisseData = comptageData.caisses_data[caisseId];
        let total_compte = 0;

        if (denominations && caisseData.denominations) {
            for (const type in denominations) {
                for (const name in denominations[type]) {
                    const quantite = (parseFloat(caisseData.denominations[name]) || 0);
                    total_compte += quantite * denominations[type][name];
                    results.combines.denominations[name] = (results.combines.denominations[name] || 0) + quantite;
                }
            }
        }

        if (caisseData.retraits) {
            for (const name in caisseData.retraits) {
                const quantite = (parseFloat(caisseData.retraits[name]) || 0);
                results.combines.retraits[name] = (results.combines.retraits[name] || 0) + quantite;
            }
        }

        const fond_de_caisse = parseFloat(caisseData.fond_de_caisse) || 0;
        const ventes = parseFloat(caisseData.ventes) || 0;
        const retrocession = parseFloat(caisseData.retrocession) || 0;
        const recette_theorique = ventes + retrocession;
        const recette_reelle = total_compte - fond_de_caisse;
        const ecart = recette_reelle - recette_theorique;

        results.caisses[caisseId] = {
            total_compte,
            fond_de_caisse,
            ventes,
            retrocession,
            recette_theorique,
            recette_reelle,
            ecart
        };
        results.combines.total_compté += total_compte;
        results.combines.recette_reelle += recette_reelle;
        results.combines.recette_theorique += recette_theorique;
        results.combines.ecart += ecart;
        results.combines.fond_de_caisse += fond_de_caisse;
        results.combines.ventes += ventes;
        results.combines.retrocession += retrocession;
    }
    return results;
}
