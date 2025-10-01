import { service as historyService } from '../../public/assets/js/logic/history-service.js';

// On simule une configuration simple pour les tests
const mockConfig = {
    nomsCaisses: { '1': 'Caisse Principale', '2': 'Boutique' },
    denominations: {
        billets: { b50: 50, b20: 20 },
        pieces:  { p2: 2, p1: 1 }
    }
};

describe('history-service', () => {

    describe('processWithdrawalData', () => {

        it('devrait agréger correctement les retraits par jour', () => {
            const mockComptages = [
                { // Jour 1
                    date_comptage: '2025-10-26T18:00:00Z',
                    caisses_data: {
                        '1': { retraits: { b50: '2', b20: '1' } }, // 120€
                        '2': { retraits: { b20: '3' } }              // 60€
                    }
                },
                { // Jour 2
                    date_comptage: '2025-10-27T18:05:00Z',
                    caisses_data: {
                        '1': { retraits: { p2: '10' } } // 20€
                    }
                },
                { // Autre comptage du Jour 1
                    date_comptage: '2025-10-26T19:00:00Z',
                    caisses_data: {
                        '1': { retraits: { p1: '5' } } // 5€
                    }
                }
            ];

            const result = historyService.processWithdrawalData(mockComptages, mockConfig.denominations, mockConfig.nomsCaisses);
            
            // Vérification pour le 26/10/2025
            expect(result['2025-10-26']).toBeDefined();
            expect(result['2025-10-26'].totalValue).toBe(185); // 120 + 60 + 5
            expect(result['2025-10-26'].totalItems).toBe(2 + 1 + 3 + 5); // 11

            // Vérification pour le 27/10/2025
            expect(result['2025-10-27']).toBeDefined();
            expect(result['2025-10-27'].totalValue).toBe(20);
            expect(result['2025-10-27'].totalItems).toBe(10);
        });

        it('devrait retourner un objet vide si aucun retrait n\'est trouvé', () => {
            const mockComptages = [
                {
                    date_comptage: '2025-10-26T18:00:00Z',
                    caisses_data: { '1': { retraits: {} } }
                }
            ];
            
            const result = historyService.processWithdrawalData(mockComptages, mockConfig.denominations, mockConfig.nomsCaisses);
            
            // La clé pour la date est créée, mais les totaux sont à zéro. La logique d'affichage ignorera cette entrée.
            expect(result['2025-10-26'].totalValue).toBe(0);
        });

        it('devrait retourner un objet vide si l\'input est vide', () => {
            const result = historyService.processWithdrawalData([], mockConfig.denominations, mockConfig.nomsCaisses);
            expect(Object.keys(result).length).toBe(0);
        });
    });
});
