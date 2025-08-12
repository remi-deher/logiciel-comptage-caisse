// Fichier : public/js/stats.js
// CORRIGÉ : La fonction loadStats est mise à jour pour gérer les filtres correctement.

document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour dessiner le graphique en secteurs
    let repartitionChart;
    function drawRepartitionChart(data) {
        const ctx = document.getElementById('repartitionChart').getContext('2d');
        if (repartitionChart) {
            repartitionChart.destroy();
        }
        repartitionChart = new Chart(ctx, {
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


    // Fonction principale pour charger les données et les graphiques
    function loadStats(dateDebut = '', dateFin = '', caisse = '') {
        // Construction de l'URL avec les paramètres de filtre
        let url = new URL('index.php?action=get_stats_data', window.location.origin);
        if (dateDebut) {
            url.searchParams.append('date_debut', dateDebut);
        }
        if (dateFin) {
            url.searchParams.append('date_fin', dateFin);
        }
        if (caisse) {
            url.searchParams.append('caisse', caisse);
        }

        fetch(url)
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
    }

    // Gestion du formulaire de filtre
    const filterForm = document.getElementById('stats-filter-form');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const dateDebut = document.getElementById('date_debut').value;
            const dateFin = document.getElementById('date_fin').value;
            const caisse = document.getElementById('caisse_filter').value;
            loadStats(dateDebut, dateFin, caisse);
        });
    }

    // Gestion des boutons de filtre rapide
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    if (quickFilterBtns) {
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const days = parseInt(this.dataset.days);
                const today = new Date();
                const startDate = new Date();
                startDate.setDate(today.getDate() - days);

                const formatDate = (date) => date.toISOString().split('T')[0];

                document.getElementById('date_debut').value = formatDate(startDate);
                document.getElementById('date_fin').value = formatDate(today);

                loadStats(formatDate(startDate), formatDate(today), document.getElementById('caisse_filter').value);
            });
        });
    }

    // Gestion du bouton de réinitialisation
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            document.getElementById('date_debut').value = '';
            document.getElementById('date_fin').value = '';
            document.getElementById('caisse_filter').value = '';
            loadStats();
        });
    }

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
    const firstAccordionItem = document.querySelector('.accordion-item');
    if (firstAccordionItem) {
        const content = firstAccordionItem.querySelector('.accordion-content');
        const header = firstAccordionItem.querySelector('.accordion-header');
        header.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.padding = '20px';
    }

    // Chargement initial des statistiques
    loadStats();
});
