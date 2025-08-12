// Fichier : public/js/stats.js
// NOUVEAU SCRIPT JavaScript pour gérer les graphiques.
// Il utilise Chart.js pour dessiner l'histogramme.

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

    // Charger la bibliothèque Chart.js via CDN
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = () => {
        // Une fois que Chart.js est chargé, on récupère les données
        fetch('index.php?action=get_stats_data')
            .then(response => response.json())
            .then(data => {
                if (data && data.labels && data.datasets) {
                    drawChart(data);
                } else {
                    console.error('Données de statistiques invalides reçues:', data);
                }
            })
            .catch(error => {
                console.error('Erreur lors de la récupération des données de statistiques:', error);
            });
    };
    document.head.appendChild(script);
});
