// Fichier : public/assets/js/logic/stats-logic.js (Corrigé)

// La variable est déclarée UNE SEULE FOIS ici, au scope du module.
let mainChart = null; 

// --- Fonctions Utilitaires ---
const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

// --- API ---
async function fetchStatsData(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`index.php?route=stats/get_data&${query}`);
    if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status} lors de la récupération des statistiques.`);
    }
    const data = await response.json();
    if (data.repartition.labels.length === 0) {
        throw new Error('Aucune donnée de comptage trouvée pour la période sélectionnée.');
    }
    return data;
}

// --- Rendu (Affichage) ---

function renderKPIs(kpis) {
    const kpiContainer = document.querySelector('.kpi-container');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
        <div class="kpi-card">
            <h3>Nombre de comptages</h3>
            <p>${kpis.total_comptages}</p>
        </div>
        <div class="kpi-card">
            <h3>Ventes totales</h3>
            <p>${formatCurrency(kpis.total_ventes)}</p>
        </div>
        <div class="kpi-card">
            <h3>Ventes moyennes</h3>
            <p>${formatCurrency(kpis.ventes_moyennes)}</p>
        </div>
        <div class="kpi-card">
            <h3>Rétrocessions totales</h3>
            <p>${formatCurrency(kpis.total_retrocession)}</p>
        </div>
    `;
}

function renderChart(data) {
    const chartContainer = document.getElementById('mainChart');
    if (!chartContainer) return;
    
    // Détruit l'instance précédente du graphique s'il existe
    if (mainChart) {
        mainChart.destroy();
    }

    const options = {
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: true }
        },
        series: [{
            name: 'Ventes par caisse',
            data: data.repartition.data
        }],
        xaxis: {
            categories: data.repartition.labels
        },
        yaxis: {
            labels: {
                formatter: (value) => formatCurrency(value)
            }
        },
        tooltip: {
            y: {
                formatter: (value) => formatCurrency(value)
            }
        },
        theme: {
            mode: document.body.dataset.theme === 'dark' ? 'dark' : 'light'
        }
    };
    
    // CORRECTION : On assigne une nouvelle instance à la variable existante,
    // SANS la redéclarer avec 'let' or 'const'.
    mainChart = new ApexCharts(chartContainer, options);
    mainChart.render();
}


// --- Point d'entrée de la logique de la page ---
export async function initializeStatsLogic() {
    const statsPage = document.getElementById('stats-page');
    const filterForm = document.getElementById('stats-filter-form');
    
    if (!statsPage || !filterForm) return;

    // Fonction pour charger et afficher les données
    async function loadAndRender(params = {}) {
        const kpiContainer = document.querySelector('.kpi-container');
        const chartContainer = document.getElementById('mainChart');
        
        try {
            kpiContainer.innerHTML = '<p>Chargement des indicateurs...</p>';
            chartContainer.innerHTML = '<p>Chargement du graphique...</p>';

            const data = await fetchStatsData(params);
            renderKPIs(data.kpis);
            renderChart(data);

        } catch (error) {
            kpiContainer.innerHTML = '';
            chartContainer.innerHTML = `<p class="error">${error.message}</p>`;
        }
    }

    // Événements
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filterForm);
        const params = Object.fromEntries(formData.entries());
        loadAndRender(params);
    });

    // Chargement initial des données
    loadAndRender();
}
