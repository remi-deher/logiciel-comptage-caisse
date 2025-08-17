// Fichier : public/js/stats.js
// Logique pour la page de statistiques en utilisant ApexCharts.
// Mise à jour pour le nouveau schéma de données.

document.addEventListener('DOMContentLoaded', function() {
    let kpiData = {};
    let caisses = [];
    let chartData = {};
    let mainChart;

    const chartTitleElement = document.getElementById('chart-title');
    const chartContainer = document.getElementById('mainChart');
    const chartTypeSelector = document.getElementById('chart-type-selector');
    const dataSelector = document.getElementById('data-selector');
    const modal = document.getElementById('details-modal');
    const modalContent = document.getElementById('modal-details-content');
    const closeModalBtn = modal ? modal.querySelector('.modal-close') : null;
    const kpiCards = document.querySelectorAll('.kpi-card');
    const filterForm = document.getElementById('stats-filter-form');
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    const resetBtn = document.getElementById('reset-filter-btn');

    const chartColors = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
    ];
    
    // Fonction principale de mise à jour des graphiques
    function updateChart() {
        if (!chartContainer) {
            console.error("Élément conteneur 'mainChart' introuvable.");
            return;
        }

        const selectedData = dataSelector.value;
        const selectedChartType = chartTypeSelector.value;
        const dataToDisplay = chartData[selectedData];
        let title = dataSelector.options[dataSelector.selectedIndex].text;
        
        if (!dataToDisplay || (dataToDisplay.labels && dataToDisplay.labels.length === 0)) {
            if (mainChart) {
                mainChart.destroy();
                mainChart = null;
            }
            chartTitleElement.textContent = title + " (pas de données)";
            return;
        }
        
        let apexChartType = selectedChartType;
        if (selectedChartType === 'doughnut') {
            apexChartType = 'pie';
        }

        let series;
        let labels;
        let categories;

        if (selectedData === 'radar') {
            series = dataToDisplay.series;
            labels = dataToDisplay.labels;
            categories = dataToDisplay.labels;
        } else if (selectedChartType === 'doughnut') {
            series = dataToDisplay.data;
            labels = dataToDisplay.labels;
            categories = null;
        } else {
            series = [{
                name: title,
                data: dataToDisplay.data
            }];
            categories = dataToDisplay.labels;
            labels = null;
        }

        const options = {
            chart: {
                type: apexChartType,
                height: 350
            },
            series: series,
            labels: labels,
            colors: chartColors,
            title: {
                text: title
            },
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: { width: 200 },
                    legend: { position: 'bottom' }
                }
            }],
            theme: {
                mode: document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
            },
            yaxis: {
                labels: {
                    formatter: function (value) {
                        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                    }
                }
            },
            xaxis: {
                categories: categories,
                labels: {
                    style: {
                        colors: getComputedStyle(document.body).getPropertyValue('--color-text-secondary')
                    }
                }
            },
            legend: {
                labels: {
                    colors: getComputedStyle(document.body).getPropertyValue('--color-text-primary')
                }
            }
        };

        // Gérer les cas spécifiques
        if (selectedChartType === 'doughnut' || selectedChartType === 'funnel' || selectedChartType === 'pie') {
            delete options.xaxis;
            delete options.yaxis;
        }

        if (mainChart) {
            mainChart.updateOptions(options);
        } else {
            mainChart = new ApexCharts(chartContainer, options);
            mainChart.render();
        }

        chartTitleElement.textContent = title;
    }

    function updateChartTypeOptions() {
        const selectedData = dataSelector.value;
        const availableChartTypes = {
            'evolution': ['line', 'bar'],
            'repartition': ['bar', 'doughnut'],
            'comparaison': ['line', 'bar'],
            'funnel': ['bar'], // ApexCharts n'a pas de type 'funnel', 'bar' est la meilleure alternative
            'radar': ['radar']
        };

        const availableOptions = availableChartTypes[selectedData];
        chartTypeSelector.innerHTML = '';
        availableOptions.forEach(option => {
            const el = document.createElement('option');
            el.value = option;
            el.textContent = option.charAt(0).toUpperCase() + option.slice(1);
            if (option === 'doughnut') {
                el.textContent = 'Graphique en secteurs';
            } else if (option === 'funnel') {
                 el.textContent = 'Graphique entonnoir';
            } else if (option === 'radar') {
                 el.textContent = 'Graphique radar';
            }
            chartTypeSelector.appendChild(el);
        });

        const firstAvailable = chartTypeSelector.querySelector('option');
        if (firstAvailable) {
            chartTypeSelector.value = firstAvailable.value;
        }
        updateChart();
    }


    function updateKpi(kpis) {
        const totalComptagesEl = document.getElementById('total-comptages');
        if(totalComptagesEl) totalComptagesEl.textContent = kpis.total_comptages;
        
        const totalVentesEl = document.getElementById('total-ventes');
        if(totalVentesEl) totalVentesEl.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.total_ventes);
        
        const ventesMoyennesEl = document.getElementById('ventes-moyennes');
        if(ventesMoyennesEl) ventesMoyennesEl.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.ventes_moyennes);
        
        const totalRetrocessionEl = document.getElementById('total-retrocession');
        if(totalRetrocessionEl) totalRetrocessionEl.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.total_retrocession);
        
        kpiData = kpis;
    }

    // Charge les données de l'API et met à jour les graphiques et KPI
    function loadStats(dateDebut = '', dateFin = '') {
        let url = new URL('index.php?action=get_stats_data', window.location.origin);
        if (dateDebut) { url.searchParams.append('date_debut', dateDebut); }
        if (dateFin) { url.searchParams.append('date_fin', dateFin); }
    
        fetch(url)
            .then(response => {
                if (!response.ok) { throw new Error('Réponse du serveur non valide.'); }
                return response.json();
            })
            .then(data => {
                if (data && data.kpis && data.caisses) {
                    kpiData = data.kpis;
                    caisses = data.caisses;
                    
                    // Mise à jour de la structure des données pour correspondre au nouveau format
                    chartData = {
                        evolution: {
                            labels: data.evolution.labels,
                            data: data.evolution.data
                        },
                        repartition: {
                            labels: data.repartition.labels,
                            data: data.repartition.data
                        },
                        comparaison: { 
                            labels: data.caisses.map(c => c.nom), 
                            data: data.caisses.map(c => c.total_ventes) 
                        },
                        funnel: data.funnel,
                        radar: data.radar
                    };
                    updateKpi(kpiData);
                    updateChartTypeOptions();
                } else {
                    console.error('Données de statistiques invalides reçues:', data);
                }
            })
            .catch(error => {
                console.error('Erreur lors de la récupération des données de statistiques:', error);
                
                const totalComptagesEl = document.getElementById('total-comptages');
                if(totalComptagesEl) totalComptagesEl.textContent = "Erreur";

                const totalVentesEl = document.getElementById('total-ventes');
                if(totalVentesEl) totalVentesEl.textContent = "Erreur";

                const ventesMoyennesEl = document.getElementById('ventes-moyennes');
                if(ventesMoyennesEl) ventesMoyennesEl.textContent = "Erreur";

                const totalRetrocessionEl = document.getElementById('total-retrocession');
                if(totalRetrocessionEl) totalRetrocessionEl.textContent = "Erreur";
            });
    }

    kpiCards.forEach(card => {
        card.addEventListener('click', function() {
            const kpi = this.dataset.kpi;
            const title = this.dataset.title;
            let html = `<div class="modal-header"><h3>Détails pour "${title}"</h3></div>`;
            html += `<table class="modal-details-table"><thead><tr><th>Caisse</th><th>Valeur</th></tr></thead><tbody>`;
            caisses.forEach(caisse => {
                let value = caisse[kpi] !== undefined ? caisse[kpi] : 'Non applicable';
                html += `<tr><td>${caisse.nom}</td><td>${value !== 'Non applicable' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value) : value}</td></tr>`;
            });
            html += `</tbody></table>`;
            document.getElementById('modal-details-content').innerHTML = html;
            modal.style.display = 'flex';
        });
    });

    if (closeModalBtn) {
        closeModalBtn.onclick = function() { modal.style.display = 'none'; };
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            loadStats(document.getElementById('date_debut').value, document.getElementById('date_fin').value);
        });
    }
    
    dataSelector.addEventListener('change', updateChartTypeOptions);
    chartTypeSelector.addEventListener('change', updateChart);

    quickFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Retirer la classe 'active' de tous les boutons
            quickFilterBtns.forEach(b => b.classList.remove('active'));
            // Ajouter la classe 'active' au bouton cliqué
            this.classList.add('active');
            
            const days = parseInt(this.dataset.days);
            const today = new Date();
            const startDate = new Date();
            if (days > 0) { startDate.setDate(today.getDate() - days); }
            const formatDate = (date) => date.toISOString().split('T')[0];
            document.getElementById('date_debut').value = formatDate(startDate);
            document.getElementById('date_fin').value = formatDate(today);
            loadStats(formatDate(startDate), formatDate(today));
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            // Retirer la classe active de tous les boutons
            quickFilterBtns.forEach(b => b.classList.remove('active'));
            document.getElementById('date_debut').value = '';
            document.getElementById('date_fin').value = '';
            loadStats();
        });
    }

    loadStats();

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
        
        // Données du graphique actuellement affiché
        const currentChartData = chartData[dataSelector.value];
        const chartTitle = chartTitleElement.textContent;
        doc.setFontSize(14);
        doc.text(chartTitle, 14, y);
        y += 10;
        const chartTableData = [
            ['Label', 'Valeur'],
        ];
        currentChartData.labels.forEach((label, index) => {
            chartTableData.push([
                label,
                new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(currentChartData.data[index])
            ]);
        });
        doc.autoTable({
            startY: y,
            head: [chartTableData[0]],
            body: chartTableData.slice(1),
            theme: 'striped'
        });
        y = doc.autoTable.previous.finalY + 15;

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

        // Données du graphique actuellement affiché
        const currentChartData = chartData[dataSelector.value];
        const chartTitle = chartTitleElement.textContent;
        csvContent += `${chartTitle}\r\n`;
        csvContent += "Label;Valeur\r\n";
        currentChartData.labels.forEach((label, index) => {
            csvContent += `"${label}";"${currentChartData.data[index]} €"\r\n`;
        });
        csvContent += "\r\n";
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
