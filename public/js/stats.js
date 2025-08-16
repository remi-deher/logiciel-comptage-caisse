// Fichier : public/js/stats.js
// Logique pour la page de statistiques.

document.addEventListener('DOMContentLoaded', function() {
    let kpiData = {};
    let caisses = [];
    let chartData = {};
    let mainChart;

    const chartTitleElement = document.getElementById('chart-title');
    const chartCanvas = document.getElementById('mainChart');
    const chartTypeSelector = document.getElementById('chart-type-selector');
    const dataSelector = document.getElementById('data-selector');
    const generateChartBtn = document.getElementById('generate-chart-btn');
    const modal = document.getElementById('details-modal');
    const modalContent = document.getElementById('modal-details-content');
    const closeModalBtn = modal ? modal.querySelector('.modal-close') : null;
    const kpiCards = document.querySelectorAll('.kpi-card');
    const filterForm = document.getElementById('stats-filter-form');
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    const resetBtn = document.getElementById('reset-filter-btn');

    const chartColors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];
    
    // Fonction principale de mise à jour des graphiques
    function updateChart() {
        if (!chartCanvas) {
            console.error("Élément canvas 'mainChart' introuvable. Le graphique ne sera pas affiché.");
            return;
        }

        const selectedData = dataSelector.value;
        const selectedChartType = chartTypeSelector.value;
        const dataToDisplay = chartData[selectedData];
        let title = dataSelector.options[dataSelector.selectedIndex].text;
        
        if (!dataToDisplay || !dataToDisplay.labels || dataToDisplay.data.length === 0) {
            if (mainChart) {
                mainChart.destroy();
            }
            chartTitleElement.textContent = title + " (pas de données)";
            return;
        }

        const ctx = chartCanvas.getContext('2d');
        if (mainChart) {
            mainChart.destroy();
        }

        const datasets = [];
        let labels = [];

        if (selectedData === 'evolution') {
            labels = dataToDisplay.labels;
            datasets.push({
                label: 'Ventes totales',
                data: dataToDisplay.data,
                borderColor: chartColors[1],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: true,
                tension: 0.4
            });
        } else if (selectedData === 'repartition' || selectedData === 'comparaison') {
            labels = dataToDisplay.labels;
             datasets.push({
                label: title,
                data: dataToDisplay.data,
                backgroundColor: chartColors,
                borderColor: selectedChartType === 'doughnut' ? '#fff' : chartColors,
                borderWidth: selectedChartType === 'doughnut' ? 2 : 1
            });
        }

        mainChart = new Chart(ctx, {
            type: selectedChartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: selectedChartType === 'doughnut' ? 'right' : 'top',
                        labels: {
                            usePointStyle: selectedChartType === 'doughnut',
                            boxWidth: 8,
                            padding: 15,
                            color: getComputedStyle(document.body).getPropertyValue('--color-text-primary')
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                const value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                                label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
                                return label;
                            }
                        }
                    }
                },
                scales: selectedChartType === 'doughnut' ? {} : {
                    x: {
                        grid: { color: getComputedStyle(document.body).getPropertyValue('--color-border') },
                        ticks: { color: getComputedStyle(document.body).getPropertyValue('--color-text-secondary') }
                    },
                    y: {
                        grid: { color: getComputedStyle(document.body).getPropertyValue('--color-border') },
                        ticks: { color: getComputedStyle(document.body).getPropertyValue('--color-text-secondary') }
                    }
                }
            }
        });
        chartTitleElement.textContent = title;
    }

    // Met à jour les options de type de graphique en fonction des données sélectionnées
    function updateChartTypeOptions() {
        const selectedData = dataSelector.value;
        const barOption = chartTypeSelector.querySelector('option[value="bar"]');
        const doughnutOption = chartTypeSelector.querySelector('option[value="doughnut"]');
        const lineOption = chartTypeSelector.querySelector('option[value="line"]');

        if (selectedData === 'repartition' || selectedData === 'comparaison') {
            doughnutOption.disabled = false;
            lineOption.disabled = (selectedData === 'repartition');
            if(chartTypeSelector.value === 'line' && selectedData === 'repartition') {
                chartTypeSelector.value = 'bar';
            }
        } else { // evolution
            doughnutOption.disabled = true;
            lineOption.disabled = false;
            if(chartTypeSelector.value === 'doughnut') {
                chartTypeSelector.value = 'line';
            }
        }
        updateChart();
    }


    function updateKpi(kpis) {
        document.getElementById('total-comptages').textContent = kpis.total_comptages;
        document.getElementById('total-ventes').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.total_ventes);
        document.getElementById('ventes-moyennes').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.ventes_moyennes);
        document.getElementById('total-retrocession').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis.total_retrocession);
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
                    chartData = {
                        evolution: data.evolution,
                        repartition: data.repartition,
                        comparaison: { labels: data.caisses.map(c => c.nom), data: data.caisses.map(c => c.total_ventes) }
                    };
                    updateKpi(kpiData);
                    updateChartTypeOptions();
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

    // Événements
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

    if (generateChartBtn) {
        generateChartBtn.addEventListener('click', updateChart);
    }
    
    if (dataSelector) {
        dataSelector.addEventListener('change', updateChartTypeOptions);
    }

    quickFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
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
