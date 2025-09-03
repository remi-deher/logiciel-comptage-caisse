// Fichier : public/assets/js/pages/CalculateurPage.js

export function renderCalculateurPage(element) {
  // Pour le moment, nous utilisons des données statiques pour l'affichage.
  // Plus tard, nous les récupérerons via un appel API.
  const nomsCaisses = { 1: "Caisse 1", 2: "Caisse 2" };
  const denominations = {
      'billets': {'b500': 500, 'b200': 200, 'b100': 100, 'b50': 50, 'b20': 20, 'b10': 10, 'b5': 5},
      'pieces':  {'p200': 2, 'p100': 1, 'p050': 0.50, 'p020': 0.20, 'p010': 0.10, 'p005': 0.05, 'p002': 0.02, 'p001': 0.01}
  };
  const currencySymbol = '€';

  let caissesTabsHtml = '';
  let caissesContentHtml = '';
  let ecartDisplaysHtml = '';

  Object.entries(nomsCaisses).forEach(([id, nom], index) => {
    const isActive = index === 0 ? 'active' : '';
    caissesTabsHtml += `<button type="button" class="tab-link ${isActive}" data-tab="caisse${id}">${nom}</button>`;
    ecartDisplaysHtml += `
        <div id="ecart-display-caisse${id}" class="ecart-display ${isActive}">
            Écart Caisse Actuelle : <span class="ecart-value">0,00 ${currencySymbol}</span>
        </div>`;
    
    let billetsHtml = Object.entries(denominations.billets).map(([name, valeur]) => `
        <div class="form-group">
            <label>${valeur} ${currencySymbol}</label>
            <input type="number" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" step="1" placeholder="0">
            <span class="total-line" id="total_${name}_${id}">0,00 ${currencySymbol}</span>
        </div>
    `).join('');

    let piecesHtml = Object.entries(denominations.pieces).map(([name, valeur]) => `
        <div class="form-group">
            <label>${valeur >= 1 ? valeur + ' ' + currencySymbol : (valeur * 100) + ' cts'}</label>
            <input type="number" id="${name}_${id}" name="caisse[${id}][${name}]" min="0" step="1" placeholder="0">
            <span class="total-line" id="total_${name}_${id}">0,00 ${currencySymbol}</span>
        </div>
    `).join('');

    caissesContentHtml += `
        <div id="caisse${id}" class="caisse-tab-content ${isActive}">
            <div class="grid grid-3">
                <div class="form-group">
                    <label>Fond de Caisse (${currencySymbol})</label>
                    <input type="text" id="fond_de_caisse_${id}" name="caisse[${id}][fond_de_caisse]" placeholder="0,00">
                </div>
                <div class="form-group">
                    <label>Ventes du Jour (${currencySymbol})</label>
                    <input type="text" id="ventes_${id}" name="caisse[${id}][ventes]" placeholder="0,00">
                </div>
                <div class="form-group">
                    <label>Rétrocessions (${currencySymbol})</label>
                    <input type="text" id="retrocession_${id}" name="caisse[${id}][retrocession]" placeholder="0,00">
                </div>
            </div>
            <h4 style="margin-top: 20px;">Billets</h4>
            <div class="grid">${billetsHtml}</div>
            <h4 style="margin-top: 20px;">Pièces</h4>
            <div class="grid">${piecesHtml}</div>
        </div>
    `;
  });

  element.innerHTML = `
    <div class="container" id="calculator-page">
        <form id="caisse-form" action="#" method="post">
            <div class="tab-selector">${caissesTabsHtml}</div>
            <div class="ecart-display-container">${ecartDisplaysHtml}</div>
            ${caissesContentHtml}
            <div class="save-section">
                <h3>Enregistrer le comptage</h3>
                <div class="form-group">
                    <label for="nom_comptage">Donnez un nom à ce comptage</label>
                    <input type="text" id="nom_comptage" name="nom_comptage">
                </div>
                <button type="submit" class="save-btn" style="margin-top: 15px;">Enregistrer</button>
            </div>
        </form>
    </div>
  `;
  
  // À FAIRE : Intégrer la logique JS de calculator.js, realtime.js, cloture.js ici
  // et remplacer les données statiques par des appels à l'API.
}
