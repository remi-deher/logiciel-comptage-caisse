// Fichier : public/js/stats.js
// Mise à jour pour récupérer et afficher les KPI et un nouveau graphique.

document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour dessiner le graphique en barres
    function drawVentesChart(data) {
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

    // Fonction pour dessiner le graphique en secteurs
    function drawRepartitionChart(data) {
        const ctx = document.getElementById('repartitionChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Répartition des ventes',
                    data: data.data,
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
                }]
            },
            options: {
                responsive: true,
            }
        });
    }
    
    // Fonction pour mettre à jour les KPI dans le HTML
    function updateKpi(kpis) {
        document.getElementById('total-comptages').textContent = kpis.total_comptages;
        document.getElementById('total-ventes').textContent = kpis.total_ventes + ' €';
        document.getElementById('ventes-moyennes').textContent = kpis.ventes_moyennes + ' €';
        document.getElementById('total-retrocession').textContent = kpis.total_retrocession + ' €';
    }


    // Correction : Le script de la bibliothèque Chart.js doit être chargé dans le header
    // pour être disponible avant que ce script ne s'exécute.
    // Une fois que le DOM est chargé, on peut récupérer les données et les afficher.
    fetch('index.php?action=get_stats_data')
        .then(response => response.json())
        .then(data => {
            if (data) {
                // Afficher le graphique des ventes si les données existent
                if (data.labels && data.datasets) {
                    drawVentesChart(data);
                } else {
                    console.error('Données de graphiques des ventes invalides reçues:', data);
                }

                // Afficher le graphique de répartition si les données existent
                if (data.repartition) {
                    drawRepartitionChart(data.repartition);
                } else {
                    console.error('Données de répartition invalides reçues:', data);
                }

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
            document.getElementById('total-retrocession').textContent = "Erreur";
        });
});
