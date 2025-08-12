// Fichier : public/js/stats.js
// Ajout de la logique pour les exports de données (Impression, PDF, CSV).

document.addEventListener('DOMContentLoaded', function() {
    // Fonction pour dessiner le graphique en secteurs
    let repartitionChart;
    let kpiData = {}; // Variable pour stocker les données des KPI
    let caisses = []; // Variable pour stocker les noms des caisses

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
        kpiData = kpis; // Sauvegarde des données KPI
    }


    // Fonction principale pour charger les données et les graphiques
    function loadStats(dateDebut = '', dateFin = '') {
        // Construction de l'URL avec les paramètres de filtre
        let url = new URL('index.php?action=get_stats_data', window.location.origin);
        if (dateDebut) {
            url.searchParams.append('date_debut', dateDebut);
        }
        if (dateFin) {
            url.searchParams.append('date_fin', dateFin);
        }
    
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data) {
                    if (data.repartition) {
                        drawRepartitionChart(data.repartition);
                    } else {
                        console.error('Données de répartition invalides reçues:', data);
                    }
    
                    if (data.kpis) {
                        updateKpi(data.kpis);
                    }

                    if (data.caisses) {
                        caisses = data.caisses;
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

    // Gérer le clic sur les cartes KPI
    const kpiCards = document.querySelectorAll('.kpi-card');
    const modal = document.getElementById('details-modal');
    const modalContent = document.getElementById('modal-details-content');
    const closeModalBtn = modal.querySelector('.modal-close');

    kpiCards.forEach(card => {
        card.addEventListener('click', function(event) {
            const kpi = card.dataset.kpi;
            const title = card.dataset.title;
            
            let html = `<div class="modal-header"><h3>Détails pour "${title}"</h3></div>`;
            html += `<table class="modal-details-table"><thead><tr><th>Caisse</th><th>Valeur</th></tr></thead><tbody>`;

            caisses.forEach(caisse => {
                let value = 'N/A';
                if (kpi === 'total_comptages') {
                    value = 'Non applicable';
                } else if (kpi === 'total_ventes') {
                    value = caisse.total_ventes;
                } else if (kpi === 'ventes_moyennes') {
                    value = caisse.moyenne_ventes;
                } else if (kpi === 'total_retrocession') {
                    value = caisse.total_retrocession;
                }
                
                html += `<tr><td>${caisse.nom}</td><td>${value !== 'Non applicable' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value) : value}</td></tr>`;
            });
            html += `</tbody></table>`;
            
            modalContent.innerHTML = html;
            modal.style.display = 'flex';
        });
    });

    if(closeModalBtn) {
        closeModalBtn.onclick = function() { modal.style.display = 'none'; }
    }

    // Gestion du formulaire de filtre
    const filterForm = document.getElementById('stats-filter-form');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const dateDebut = document.getElementById('date_debut').value;
            const dateFin = document.getElementById('date_fin').value;
            loadStats(dateDebut, dateFin);
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

                loadStats(formatDate(startDate), formatDate(today));
            });
        });
    }

    // Gestion du bouton de réinitialisation
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            document.getElementById('date_debut').value = '';
            document.getElementById('date_fin').value = '';
            loadStats();
        });
    }

    // Logique pour le style accordéon
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
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
    
    // NOUVEAU: Logique pour les boutons d'exportation
    document.getElementById('print-stats-btn').addEventListener('click', () => window.print());

    document.getElementById('pdf-stats-btn').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const dateDebut = document.getElementById('date_debut').value;
        const dateFin = document.getElementById('date_fin').value;

        const formatDate = (dateString) => {
            if (!dateString) return 'Toutes les dates';
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR');
        };
        const fileName = `statistiques_${formatDate(dateDebut)}_${formatDate(dateFin)}.pdf`;

        let y = 15;
        doc.setFontSize(18);
        doc.text("Tableau de bord des statistiques", 14, y);
        y += 10;
        doc.setFontSize(12);
        doc.text(`Analyse des données du ${formatDate(dateDebut)} au ${formatDate(dateFin)}`, 14, y);
        y += 15;

        // KPI
        doc.setFontSize(14);
        doc.text("Indicateurs de performance (KPI)", 14, y);
        y += 10;

        const kpiTableData = [
            ["Indicateur", "Valeur"],
            ["Nombre total de comptages", kpiData.total_comptages],
            ["Ventes totales", new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpiData.total_ventes)],
            ["Ventes moyennes", new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpiData.ventes_moyennes)],
            ["Rétrocessions totales", new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpiData.total_retrocession)],
        ];

        doc.autoTable({
            startY: y,
            head: [kpiTableData[0]],
            body: kpiTableData.slice(1),
            theme: 'striped'
        });
        y = doc.autoTable.previous.finalY + 15;

        // Détails par caisse
        doc.setFontSize(14);
        doc.text("Détails par caisse", 14, y);
        y += 10;

        const detailsTableData = [
            ["Caisse", "Ventes totales", "Ventes moyennes", "Rétrocessions totales"],
        ];
        
        caisses.forEach(caisse => {
            detailsTableData.push([
                caisse.nom,
                new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(caisse.total_ventes),
                new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(caisse.moyenne_ventes),
                new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(caisse.total_retrocession),
            ]);
        });

        doc.autoTable({
            startY: y,
            head: [detailsTableData[0]],
            body: detailsTableData.slice(1),
            theme: 'striped'
        });
        y = doc.autoTable.previous.finalY + 15;

        // Graphique de répartition
        doc.setFontSize(14);
        doc.text("Répartition des ventes par caisse", 14, y);
        y += 10;

        const repartitionTableData = [
            ['Caisse', 'Ventes'],
        ];
        
        const repartitionLabels = repartitionChart.data.labels;
        const repartitionValues = repartitionChart.data.datasets[0].data;

        repartitionLabels.forEach((label, index) => {
            repartitionTableData.push([
                label,
                new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(repartitionValues[index])
            ]);
        });

        doc.autoTable({
            startY: y,
            head: [repartitionTableData[0]],
            body: repartitionTableData.slice(1),
            theme: 'striped'
        });

        doc.save(fileName);
    });

    document.getElementById('excel-stats-btn').addEventListener('click', () => {
        const dateDebut = document.getElementById('date_debut').value;
        const dateFin = document.getElementById('date_fin').value;
        const formatDate = (dateString) => {
            if (!dateString) return 'Toutes les dates';
            return dateString;
        };
        const fileName = `statistiques_${formatDate(dateDebut)}_${formatDate(dateFin)}.csv`;

        let csvContent = "data:text/csv;charset=utf-8,";
        
        // KPI
        csvContent += "Indicateurs de performance (KPI)\r\n";
        csvContent += "Indicateur;Valeur\r\n";
        csvContent += `Nombre total de comptages;${kpiData.total_comptages}\r\n`;
        csvContent += `Ventes totales;${kpiData.total_ventes} €\r\n`;
        csvContent += `Ventes moyennes;${kpiData.ventes_moyennes} €\r\n`;
        csvContent += `Rétrocessions totales;${kpiData.total_retrocession} €\r\n\r\n`;
        
        // Détails par caisse
        csvContent += "Détails par caisse\r\n";
        csvContent += "Caisse;Ventes totales;Ventes moyennes;Rétrocessions totales\r\n";
        caisses.forEach(caisse => {
            csvContent += `"${caisse.nom}";"${caisse.total_ventes} €";"${caisse.moyenne_ventes} €";"${caisse.total_retrocession} €"\r\n`;
        });
        csvContent += "\r\n";

        // Graphique de répartition
        csvContent += "Répartition des ventes par caisse\r\n";
        csvContent += "Caisse;Ventes\r\n";
        const repartitionLabels = repartitionChart.data.labels;
        const repartitionValues = repartitionChart.data.datasets[0].data;
        repartitionLabels.forEach((label, index) => {
            csvContent += `"${label}";"${repartitionValues[index]} €"\r\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
