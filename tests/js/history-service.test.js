import { service as historyService } from '../../public/assets/js/logic/history-service.js';

const mockConfig = {
    nomsCaisses: { '1': 'Caisse Principale', '2': 'Boutique' },
    denominations: {
        billets: { b50: 50, b20: 20 },
        pieces:  { p2: 2, p1: 1 }
    }
};

describe('history-service', () => {

    // On teste maintenant la nouvelle fonction processClotureWithdrawalData
    describe('processClotureWithdrawalData', () => {

        it('devrait isoler chaque "Clôture Générale" comme un événement unique', () => {
            const mockComptages = [
                { // Clôture 1
                    id: 101,
                    nom_comptage: 'Clôture Générale du 26/10/2025 18:00',
                    date_comptage: '2025-10-26T18:00:00Z',
                    caisses_data: {
                        '1': { retraits: { b50: '2', b20: '1' } }, // 120€
                    }
                },
                { // Un comptage normal, qui doit être ignoré
                    id: 102,
                    nom_comptage: 'Comptage intermédiaire',
                    date_comptage: '2025-10-26T19:00:00Z',
                    caisses_data: {
                        '1': { retraits: { p1: '5' } }
                    }
                },
                { // Clôture 2 (même jour, mais événement séparé)
                    id: 103,
                    nom_comptage: 'Clôture Générale du 26/10/2025 22:00',
                    date_comptage: '2025-10-26T22:00:00Z',
                    caisses_data: {
                        '1': { retraits: { p2: '10' } } // 20€
                    }
                }
            ];

            const result = historyService.processClotureWithdrawalData(mockComptages, mockConfig.denominations, mockConfig.nomsCaisses);
            
            // On doit avoir 2 clôtures, pas 1 seul groupe par jour
            expect(result).toHaveLength(2);

            // Vérification de la première clôture
            const cloture1 = result.find(c => c.id === 101);
            expect(cloture1).toBeDefined();
            expect(cloture1.totalValue).toBe(120);
            expect(cloture1.totalItems).toBe(3); // 2 billets de 50 + 1 billet de 20

            // Vérification de la seconde clôture
            const cloture2 = result.find(c => c.id === 103);
            expect(cloture2).toBeDefined();
            expect(cloture2.totalValue).toBe(20);
            expect(cloture2.totalItems).toBe(10); // 10 pièces de 2
        });

        it('devrait calculer correctement les totaux de billets et pièces', () => {
             const mockComptages = [
                {
                    id: 201,
                    nom_comptage: 'Clôture Générale du 27/10/2025 18:00',
                    date_comptage: '2025-10-27T18:00:00Z',
                    caisses_data: {
                        '1': { retraits: { b50: '1', p2: '5' } }, // 50€ billets, 10€ pièces
                        '2': { retraits: { b20: '2', p1: '3' } }  // 40€ billets, 3€ pièces
                    }
                }
            ];

            const result = historyService.processClotureWithdrawalData(mockComptages, mockConfig.denominations, mockConfig.nomsCaisses);
            
            expect(result).toHaveLength(1);
            const cloture = result[0];
            expect(cloture.totalValue).toBe(103); // 50+10+40+3
            expect(cloture.totalBillets).toBe(90); // 50+40
            expect(cloture.totalPieces).toBe(13);  // 10+3
            expect(cloture.totalItems).toBe(1 + 5 + 2 + 3); // 11
        });
        
        it('devrait retourner un tableau vide si aucun comptage de clôture n\'est trouvé', () => {
            const mockComptages = [
                {
                    id: 301,
                    nom_comptage: 'Sauvegarde auto',
                    date_comptage: '2025-10-26T18:00:00Z',
                    caisses_data: { '1': { retraits: { b50: '1' } } }
                }
            ];
            
            const result = historyService.processClotureWithdrawalData(mockComptages, mockConfig.denominations, mockConfig.nomsCaisses);
            expect(result).toHaveLength(0);
        });
    });
});
