document.addEventListener('DOMContentLoaded', function() {
    const page = document.getElementById('reserve-page');
    if (!page) return;

    const config = JSON.parse(document.getElementById('reserve-data').dataset.config);
    const allDenominations = { ...config.denominations.billets, ...config.denominations.pieces };

    // --- DOM Elements ---
    const showFormBtn = document.getElementById('show-demande-form-btn');
    const demandeForm = document.getElementById('new-demande-form');
    const cancelDemandeBtn = document.getElementById('cancel-demande-btn');
    const demandeDenomSelect = document.getElementById('demande-denomination');

    // --- Functions ---
    const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

    const populateDenominationSelect = (selectElement) => {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
        for (const [name, value] of sortedDenoms) {
            const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
            const type = config.denominations.billets[name] ? 'Billet' : 'Pièce';
            const option = new Option(`${type} de ${label}`, name);
            selectElement.add(option);
        }
    };

    const updateDemandeValue = () => {
        const quantite = parseInt(document.getElementById('demande-quantite').value) || 0;
        const denomValue = allDenominations[demandeDenomSelect.value] || 0;
        document.getElementById('demande-valeur').textContent = formatCurrency(quantite * denomValue);
    };

    const fetchAndRenderAll = async () => {
        try {
            // CORRECTION: Utilisation de la nouvelle route spécifique
            const response = await fetch('index.php?action=get_reserve_data');
            if (!response.ok) {
                throw new Error(`Le serveur a répondu avec une erreur: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.success) {
                renderReserveStatus(data.reserve_status);
                renderDemandes(data.demandes_en_attente);
                renderHistorique(data.historique);
            } else {
                throw new Error(data.message || "Une erreur inconnue est survenue.");
            }
        } catch (error) {
            console.error("Erreur de chargement des données de la réserve:", error);
            document.getElementById('reserve-page').innerHTML = `<div class="error">Impossible de charger les données de la réserve. Assurez-vous d'avoir mis à jour la base de données.</div>`;
        }
    };

    const renderReserveStatus = (status) => {
        document.getElementById('reserve-total-value').textContent = formatCurrency(status.total);
        const grid = document.getElementById('reserve-denominations-grid');
        grid.innerHTML = '';
        const sortedDenoms = Object.entries(allDenominations).sort((a, b) => b[1] - a[1]);
        for (const [name, value] of sortedDenoms) {
            const quantite = status.denominations[name] || 0;
            const label = value >= 1 ? `${value} ${config.currencySymbol}` : `${value * 100} cts`;
            const card = `
                <div class="denom-card">
                    <h4>${label}</h4>
                    <div class="quantite">${quantite}</div>
                    <div class="valeur">${formatCurrency(quantite * value)}</div>
                </div>`;
            grid.innerHTML += card;
        }
    };

    const renderDemandes = (demandes) => {
        const list = document.getElementById('demandes-en-attente-list');
        list.innerHTML = '';
        if (demandes.length === 0) {
            list.innerHTML = '<p>Aucune demande en attente.</p>';
            return;
        }
        demandes.forEach(d => {
            const denomValue = allDenominations[d.denomination_demandee];
            const label = denomValue >= 1 ? `${denomValue} ${config.currencySymbol}` : `${denomValue * 100} cts`;
            const type = config.denominations.billets[d.denomination_demandee] ? 'Billet' : 'Pièce';
            const card = document.createElement('div');
            card.className = 'card demande-card';
            card.id = `demande-${d.id}`;
            card.dataset.demandeJson = JSON.stringify(d);

            card.innerHTML = `
                <div class="demande-header">
                    <h5>Demande de ${d.caisse_nom}</h5>
                    <span class="date">${new Date(d.date_demande).toLocaleString('fr-FR')}</span>
                </div>
                <div class="demande-body">
                    <div><i class="fa-solid fa-arrow-down-long echange-arrow"></i> <strong>Besoin de:</strong> ${d.quantite_demandee} x ${type} de ${label}</div>
                    <div class="valeur-display">${formatCurrency(d.valeur_demandee)}</div>
                    ${d.notes_demandeur ? `<div class="demande-notes">${d.notes_demandeur}</div>` : ''}
                </div>
                ${config.isAdmin ? `
                <form class="traitement-form" data-demande-id="${d.id}" data-caisse-id="${d.caisse_id}">
                    <hr>
                    <h5><i class="fa-solid fa-arrow-up-long"></i> En échange, prendre dans la caisse :</h5>
                    <div class="form-group">
                        <select name="denomination_depuis_caisse" class="depuis-caisse-denom" required></select>
                    </div>
                     <div class="form-group">
                        <input type="number" name="quantite_depuis_caisse" class="depuis-caisse-qte" min="1" placeholder="Quantité" required>
                    </div>
                    <div class="balance-display error">Balance: -${formatCurrency(d.valeur_demandee)}</div>
                    <div class="form-actions">
                        <button type="submit" class="btn save-btn" disabled>Valider l'échange</button>
                    </div>
                    <input type="hidden" name="denomination_vers_caisse" value="${d.denomination_demandee}">
                    <input type="hidden" name="quantite_vers_caisse" value="${d.quantite_demandee}">
                </form>
                ` : ''}`;
            list.appendChild(card);
        });
        document.querySelectorAll('.traitement-form .depuis-caisse-denom').forEach(populateDenominationSelect);
    };

    const renderHistorique = (historique) => {
        const list = document.getElementById('historique-list');
        list.innerHTML = '';
         if (historique.length === 0) {
            list.innerHTML = '<p>Aucune opération récente.</p>';
            return;
        }
        historique.forEach(h => {
             const labelVers = allDenominations[h.denomination_vers_caisse] >= 1 ? `${allDenominations[h.denomination_vers_caisse]} ${config.currencySymbol}` : `${allDenominations[h.denomination_vers_caisse] * 100} cts`;
             const labelDepuis = allDenominations[h.denomination_depuis_caisse] >= 1 ? `${allDenominations[h.denomination_depuis_caisse]} ${config.currencySymbol}` : `${allDenominations[h.denomination_depuis_caisse] * 100} cts`;

            const item = `
            <div class="card">
                <div class="historique-item-header">
                    <span>Par ${h.approbateur_nom || 'Admin'}</span>
                    <span>${new Date(h.date_operation).toLocaleString('fr-FR')}</span>
                </div>
                <div class="historique-item-body">
                    <div class="donne">
                        <strong>Donné à ${h.caisse_nom}</strong>
                        <span class="montant">${h.quantite_vers_caisse} x ${labelVers}</span>
                    </div>
                    <div class="echange-direction"><i class="fa-solid fa-right-left"></i></div>
                    <div class="recu">
                        <strong>Reçu de la caisse</strong>
                         <span class="montant">${h.quantite_depuis_caisse} x ${labelDepuis}</span>
                    </div>
                </div>
            </div>`;
            list.innerHTML += item;
        });
    };

    // --- Event Listeners ---
    if(showFormBtn) {
        showFormBtn.addEventListener('click', () => {
            demandeForm.classList.remove('hidden');
            showFormBtn.classList.add('hidden');
        });
    }

    if(cancelDemandeBtn) {
        cancelDemandeBtn.addEventListener('click', () => {
            demandeForm.classList.add('hidden');
            showFormBtn.classList.remove('hidden');
            demandeForm.reset();
        });
    }

    if(demandeForm) {
        demandeForm.addEventListener('input', updateDemandeValue);
        demandeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            try {
                // CORRECTION: Utilisation de la nouvelle route spécifique
                const response = await fetch('index.php?action=submit_reserve_demande', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    alert('Demande envoyée !');
                    this.reset();
                    cancelDemandeBtn.click();
                    fetchAndRenderAll();
                    window.wsConnection?.send(JSON.stringify({ type: 'nouvelle_demande_reserve' }));
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        });
    }

    document.getElementById('demandes-en-attente-list').addEventListener('input', function(e){
        const form = e.target.closest('.traitement-form');
        if (form) {
            const qteInput = form.querySelector('.depuis-caisse-qte');
            const denomSelect = form.querySelector('.depuis-caisse-denom');
            const balanceDisplay = form.querySelector('.balance-display');
            const submitBtn = form.querySelector('button[type="submit"]');

            const demandeCard = form.closest('.demande-card');
            const demande = JSON.parse(demandeCard.dataset.demandeJson || '{}');
            
            const valeurDemandee = parseFloat(demande.valeur_demandee);
            const qtePrise = parseInt(qteInput.value) || 0;
            const denomPriseValue = allDenominations[denomSelect.value] || 0;
            const valeurPrise = qtePrise * denomPriseValue;

            const balance = valeurPrise - valeurDemandee;

            balanceDisplay.textContent = `Balance: ${formatCurrency(balance)}`;
            if (Math.abs(balance) < 0.01) {
                balanceDisplay.className = 'balance-display ok';
                submitBtn.disabled = false;
            } else {
                balanceDisplay.className = 'balance-display error';
                submitBtn.disabled = true;
            }
        }
    });
    
    document.getElementById('demandes-en-attente-list').addEventListener('submit', async function(e){
        e.preventDefault();
        const form = e.target;
        if(form.classList.contains('traitement-form')) {
            const formData = new FormData(form);
            formData.append('demande_id', form.dataset.demandeId);
            formData.append('caisse_id', form.dataset.caisseId);

            try {
                 // CORRECTION: Utilisation de la nouvelle route spécifique
                const response = await fetch('index.php?action=process_reserve_demande', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if(result.success) {
                    alert('Échange validé !');
                    fetchAndRenderAll();
                    window.wsConnection?.send(JSON.stringify({ type: 'demande_reserve_traitee' }));
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        }
    });

    // --- WebSocket Logic ---
    if (window.wsConnection) {
        const originalOnMessage = window.wsConnection.onmessage;
        window.wsConnection.onmessage = function(e) {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'nouvelle_demande_reserve' || data.type === 'demande_reserve_traitee') {
                    fetchAndRenderAll();
                }
            } catch (error) { /* Pas un JSON, on ignore */ }
            
            if (originalOnMessage) {
                originalOnMessage(e);
            }
        };
    }

    // --- Initial Load ---
    populateDenominationSelect(demandeDenomSelect);
    fetchAndRenderAll();
});
