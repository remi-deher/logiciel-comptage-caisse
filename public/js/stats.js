// Fichier : public/js/stats.js
// Mise à jour pour améliorer l'apparence des graphiques et les KPI.

document.addEventListener('DOMContentLoaded', function() {
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
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
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
        document.getElementById('total-retrocession').textContent = kpis.total_retrocession + ' €';
    }


    fetch('index.php?action=get_stats_data')
        .then(response => response.json())
        .then(data => {
            if (data) {
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
            document.getElementById('total-comptages').textContent = "Erreur";
            document.getElementById('total-ventes').textContent = "Erreur";
            document.getElementById('ventes-moyennes').textContent = "Erreur";
            document.getElementById('total-retrocession').textContent = "Erreur";
        });

    // Logique pour le style accordéon
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.parentNode;
            const content = header.nextElementSibling;
            
            const isExpanded = header.getAttribute('aria-expanded') === 'true' || false;
            header.setAttribute('aria-expanded', !isExpanded);
            
            if (isExpanded) {
                content.style.maxHeight = 0;
                content.style.padding = '0 20px';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                content.style.padding = '20px';
            }
        });
    });
    // CORRIGÉ : Au lieu de simuler un clic, on définit directement l'état initial
    const firstAccordionHeader = document.querySelector('.accordion-item');
    if (firstAccordionHeader) {
        const content = firstAccordionHeader.querySelector('.accordion-content');
        const header = firstAccordionHeader.querySelector('.accordion-header');
        header.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.padding = '20px';
    }
});
