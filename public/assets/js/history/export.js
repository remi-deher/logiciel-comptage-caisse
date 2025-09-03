// public/js/history/export.js
// Ce module gère la génération des fichiers PDF et CSV.

import * as utils from './utils.js';

// Récupère la configuration globale depuis l'élément du DOM.
const configElement = document.getElementById('history-data');
const globalConfig = configElement ? JSON.parse(configElement.dataset.config) : {};

/**
 * Génère un fichier PDF pour un comptage spécifique.
 * @param {object} comptageData - Les données du comptage à exporter.
 */
export async function generateComptagePdf(comptageData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const calculated = utils.calculateResults(comptageData);
    let y = 15;

    // --- Titre principal ---
    doc.setFontSize(18);
    doc.text(comptageData.nom_comptage, 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(utils.formatDateFr(comptageData.date_comptage), 14, y);
    y += 15;

    // --- Fonction interne pour dessiner une section (caisse ou globale) ---
    const drawCaisseSection = (caisseId, isGlobal = false) => {
        const caisseNom = isGlobal ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];
        const caisseCalculated = isGlobal ? calculated.combines : calculated.caisses[caisseId];
        const caisseDetails = isGlobal ? null : comptageData.caisses_data[caisseId];
        const retraitsDetails = isGlobal ? calculated.combines.retraits : caisseDetails?.retraits;

        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text(`Résumé pour : ${caisseNom}`, 14, y);
        y += 8;

        // Tableau de résumé financier
        const summaryData = [
            ['Fond de caisse', utils.formatEuros(caisseCalculated.fond_de_caisse)],
            ['Ventes Théoriques', utils.formatEuros(caisseCalculated.ventes)],
            ['Rétrocessions', utils.formatEuros(caisseCalculated.retrocession)],
            ['Total Compté', utils.formatEuros(caisseCalculated.total_compte)],
            ['Recette Réelle', utils.formatEuros(caisseCalculated.recette_reelle)],
            ['Écart Final', utils.formatEuros(caisseCalculated.ecart)]
        ];

        doc.autoTable({
            startY: y,
            body: summaryData,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });
        y = doc.autoTable.previous.finalY + 10;

        // Tableau des retraits (si présents)
        if (retraitsDetails && Object.keys(retraitsDetails).length > 0) {
            doc.setFontSize(12);
            doc.text(`Retraits effectués pour : ${caisseNom}`, 14, y);
            y += 8;
            const retraitsData = [];
            Object.entries(retraitsDetails).forEach(([name, quantite]) => {
                let valeur = 0;
                if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                const label = valeur >= 1 ? `${valeur} ${globalConfig.currencySymbol}` : `${valeur * 100} cts`;
                retraitsData.push([`${globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce'} de ${label}`, quantite, utils.formatEuros(quantite * valeur)]);
            });
            doc.autoTable({
                startY: y,
                head: [['Dénomination', 'Quantité Retirée', 'Total Retiré']],
                body: retraitsData,
                theme: 'striped',
                headStyles: { fillColor: [231, 76, 60] } // Rouge pour les retraits
            });
            y = doc.autoTable.previous.finalY + 10;
        }

        // Tableau de détail des espèces
        doc.setFontSize(12);
        doc.text(`Détail des espèces pour : ${caisseNom}`, 14, y);
        y += 8;
        
        const denominationsData = [];
        const denominationsSource = isGlobal ? calculated.combines.denominations : (caisseDetails ? caisseDetails.denominations : {});
        if (globalConfig.denominations && denominationsSource) {
            for (const type in globalConfig.denominations) {
                for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                    const quantite = denominationsSource[name] || 0;
                    if (quantite > 0) {
                        const label = value >= 1 ? `${value} ${globalConfig.currencySymbol}` : `${value * 100} cts`;
                        denominationsData.push([
                            `${type === 'billets' ? 'Billet' : 'Pièce'} de ${label}`,
                            quantite,
                            utils.formatEuros(quantite * value)
                        ]);
                    }
                }
            }
        }
        
        if(denominationsData.length > 0){
            doc.autoTable({
                startY: y,
                head: [['Dénomination', 'Quantité', 'Total']],
                body: denominationsData,
                theme: 'striped',
                headStyles: { fillColor: [52, 152, 219] }
            });
            y = doc.autoTable.previous.finalY + 15;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text('Aucune dénomination en espèces pour cette caisse.', 14, y);
            y += 15;
        }
    };
    
    // --- Logique principale de génération ---
    if (comptageData.isGlobal) { // 'isGlobal' est une propriété qu'on ajoutera dynamiquement
        drawCaisseSection(null, true);
    } else {
        for (const caisseId in comptageData.caisses_data) {
            drawCaisseSection(caisseId, false);
        }
    }

    doc.save(`comptage_${comptageData.nom_comptage.replace(/ /g, '_')}.pdf`);
}
    
/**
 * Génère une chaîne de caractères au format CSV pour un comptage spécifique.
 * @param {object} comptageData - Les données du comptage à exporter.
 */
export function generateComptageCsv(comptageData) {
    const calculated = utils.calculateResults(comptageData);
    let csvContent = "data:text/csv;charset=utf-8,";
    
    csvContent += `Comptage;${comptageData.nom_comptage}\r\n`;
    csvContent += `Date;${utils.formatDateFr(comptageData.date_comptage)}\r\n\r\n`;

    // --- Fonction interne pour traiter une caisse ---
    const processCaisse = (caisseId, isGlobal = false) => {
        const caisseNom = isGlobal ? "Synthèse Globale" : globalConfig.nomsCaisses[caisseId];
        const caisseCalculated = isGlobal ? calculated.combines : calculated.caisses[caisseId];
        const caisseDetails = isGlobal ? null : comptageData.caisses_data[caisseId];
        const retraitsDetails = isGlobal ? calculated.combines.retraits : caisseDetails?.retraits;
        
        csvContent += `Résumé pour;${caisseNom}\r\n`;
        csvContent += "Élément;Valeur\r\n";
        csvContent += `Fond de caisse;${caisseCalculated.fond_de_caisse}\r\n`;
        csvContent += `Ventes Théoriques;${caisseCalculated.ventes}\r\n`;
        csvContent += `Rétrocessions;${caisseCalculated.retrocession}\r\n`;
        csvContent += `Total Compté;${caisseCalculated.total_compte}\r\n`;
        csvContent += `Recette Réelle;${caisseCalculated.recette_reelle}\r\n`;
        csvContent += `Écart Final;${caisseCalculated.ecart}\r\n\r\n`;
        
        if (retraitsDetails && Object.keys(retraitsDetails).length > 0) {
            csvContent += `Retraits effectués pour;${caisseNom}\r\n`;
            csvContent += "Dénomination;Quantité Retirée;Total Retiré\r\n";
            Object.entries(retraitsDetails).forEach(([name, quantite]) => {
                let valeur = 0;
                if(globalConfig.denominations.billets[name]) valeur = globalConfig.denominations.billets[name];
                if(globalConfig.denominations.pieces[name]) valeur = globalConfig.denominations.pieces[name];
                const label = valeur >= 1 ? `${valeur} EUR` : `${valeur * 100} cts`;
                csvContent += `${globalConfig.denominations.billets[name] ? 'Billet' : 'Pièce'} de ${label};${quantite};${quantite * valeur}\r\n`;
            });
            csvContent += "\r\n";
        }
        
        csvContent += `Détail des espèces pour;${caisseNom}\r\n`;
        csvContent += "Dénomination;Quantité;Total\r\n";

        const denominationsToProcess = isGlobal ? calculated.combines.denominations : (caisseDetails ? caisseDetails.denominations : {});
        
        if (globalConfig.denominations && denominationsToProcess) {
             for (const type in globalConfig.denominations) {
                for (const [name, value] of Object.entries(globalConfig.denominations[type])) {
                    const quantite = denominationsToProcess[name] || 0;
                    if (quantite > 0) {
                        const label = value >= 1 ? `${value} EUR` : `${value * 100} cts`;
                        csvContent += `${type === 'billets' ? 'Billet' : 'Pièce'} de ${label};${quantite};${quantite * value}\r\n`;
                    }
                }
            }
        }
        csvContent += "\r\n";
    };
    
    // --- Logique principale de génération ---
    if (comptageData.isGlobal) {
        processCaisse(null, true);
    } else {
        for (const caisseId in comptageData.caisses_data) {
            processCaisse(caisseId);
        }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `comptage_${comptageData.nom_comptage.replace(/ /g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
