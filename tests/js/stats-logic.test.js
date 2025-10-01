import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { initializeStatsLogic } from '../../public/assets/js/logic/stats-logic.js';

// --- Simulation de l'API fetch ---
global.fetch = jest.fn();

describe('stats-logic', () => {

    beforeEach(() => {
        fetch.mockClear();
        document.body.innerHTML = `
            <div id="stats-page">
                <form id="stats-filter-form"></form>
                <div class="kpi-container"></div>
                <div id="mainChart"></div>
            </div>
        `;
        global.ApexCharts = jest.fn(() => ({
            render: jest.fn(),
            destroy: jest.fn(),
        }));
    });

    it('devrait appeler l\'API et afficher les KPIs et le graphique en cas de succès', async () => {
        const mockStatsData = {
            repartition: { labels: ['Caisse 1'], data: [1500] },
            kpis: { total_comptages: 10, total_ventes: 15000, ventes_moyennes: 1500, total_retrocession: 200 }
        };
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockStatsData),
        });
        
        // On lance la fonction
        await initializeStatsLogic();
        
        // --- CORRECTION ---
        // On attend la fin de la file d'attente des microtâches (promesses)
        // C'est l'astuce qui permet de s'assurer que le .then() du fetch a eu le temps de s'exécuter
        await new Promise(process.nextTick);
        
        // Vérifications
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('route=stats/get_data'));
        
        const kpiContainer = document.querySelector('.kpi-container');
        expect(kpiContainer.textContent).toContain('10');
        // On vérifie une partie du formatage pour éviter les problèmes d'espaces insécables
        expect(kpiContainer.textContent).toContain('15 000,00'); 
        
        expect(ApexCharts).toHaveBeenCalled();
    });

    it('devrait afficher un message d\'erreur si l\'appel API échoue', async () => {
        fetch.mockRejectedValueOnce(new Error('Erreur réseau simulée'));

        await initializeStatsLogic();
        
        // --- CORRECTION ---
        await new Promise(process.nextTick);

        const chartContainer = document.getElementById('mainChart');
        expect(chartContainer.textContent).toContain('Erreur réseau simulée');
    });

    it('devrait afficher un message d\'erreur si aucune donnée n\'est trouvée', async () => {
        const mockEmptyData = {
            repartition: { labels: [], data: [] },
            kpis: {}
        };
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockEmptyData),
        });
        
        await initializeStatsLogic();
        
        // --- CORRECTION ---
        await new Promise(process.nextTick);

        const chartContainer = document.getElementById('mainChart');
        expect(chartContainer.textContent).toContain('Aucune donnée de comptage trouvée');
    });
});
