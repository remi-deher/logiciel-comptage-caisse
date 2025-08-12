// Fichier : public/js/stats.js
// Mise à jour pour récupérer et afficher les KPI.

document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour dessiner le graphique
    function drawChart(data) {
        const ctx = document.getElementById('ventesChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: data.datasets.map(dataset => ({
                    ...dataset,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }))
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // Fonction pour mettre à jour les KPI dans le HTML
    function updateKpi(kpis) {
        document.getElementById('total-comptages').textContent = kpis.total_comptages;
        document.getElementById('total-ventes').textContent = kpis.total_ventes + ' €';
        document.getElementById('ventes-moyennes').textContent = kpis.ventes_moyennes + ' €';
    }


    // Correction : Le script de la bibliothèque Chart.js doit être chargé dans le header
    // pour être disponible avant que ce script ne s'exécute.
    // Une fois que le DOM est chargé, on peut récupérer les données et les afficher.
    fetch('index.php?action=get_stats_data')
        .then(response => response.json())
        .then(data => {
            if (data && data.labels && data.datasets) {
                drawChart(data);
                // Appel de la nouvelle fonction pour mettre à jour les KPI
                if (data.kpis) {
                    updateKpi(data.kpis);
                }
            } else {
                console.error('Données de statistiques invalides reçues:', data);
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des données de statistiques:', error);
            // Si la requête échoue, on peut mettre à jour les emplacements avec un message d'erreur
            document.getElementById('total-comptages').textContent = "Erreur";
            document.getElementById('total-ventes').textContent = "Erreur";
            document.getElementById('ventes-moyennes').textContent = "Erreur";
        });
});
