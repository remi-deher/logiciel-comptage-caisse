// tests/js/calculator-service.test.js

import { calculateEcartsForCaisse, calculateWithdrawalSuggestion } from '../../public/assets/js/logic/calculator-service.js';

// On simule un objet de configuration pour nos tests
const mockConfig = {
    denominations: {
        billets: { b50: 50, b20: 20, b10: 10, b5: 5 },
        pieces: { p2: 2, p1: 1 }
    }
};

describe('calculator-service', () => {

    describe('calculateEcartsForCaisse', () => {

        it('devrait retourner un écart de 0 quand la caisse est juste', () => {
            const mockState = {
                config: mockConfig,
                calculatorData: {
                    caisse: {
                        '1': {
                            fond_de_caisse: '100.00',
                            ventes_especes: '55.00',
                            denominations: {
                                b50: '3', // 150€
                                b5: '1'   // 5€
                            }
                        }
                    }
                }
            };
            
            const result = calculateEcartsForCaisse('1', mockState);
            // Total compté: 155€. Recette réelle: 155 - 100 = 55€. Recette théorique: 55€.
            expect(result.ecartEspeces).toBe(0);
        });

        it('devrait retourner un écart négatif quand il manque de l argent', () => {
            const mockState = {
                config: mockConfig,
                calculatorData: {
                    caisse: {
                        '1': {
                            fond_de_caisse: '100.00',
                            ventes_especes: '55.00',
                            denominations: {
                                b50: '3' // 150€. Il manque 5€
                            }
                        }
                    }
                }
            };

            const result = calculateEcartsForCaisse('1', mockState);
            expect(result.ecartEspeces).toBe(-5);
        });
        
        // Ce test est très important pour éviter les bugs de calcul avec les nombres à virgule
        it('devrait gérer correctement les calculs avec centimes', () => {
             const mockState = {
                config: {
                    denominations: {
                        billets: {},
                        pieces: { p001: 0.01, p002: 0.02 }
                    }
                },
                calculatorData: {
                    caisse: {
                        '1': {
                            fond_de_caisse: '0',
                            ventes_especes: '0.03',
                            denominations: {
                                p001: '1', // 0.01€
                                p002: '1'  // 0.02€
                            }
                        }
                    }
                }
            };
            const result = calculateEcartsForCaisse('1', mockState);
            expect(result.ecartEspeces).toBe(0);
        });
    });

    describe('calculateWithdrawalSuggestion', () => {
        it('devrait suggérer un retrait simple avec les plus grosses coupures', () => {
            const caisseData = {
                ventes_especes: '85',
                retrocession: '0',
                denominations: { b50: '2', b20: '1', b10: '1', b5: '1' } // Total 135€
            };

            const result = calculateWithdrawalSuggestion(caisseData, mockConfig);
            
            // On s'attend à retirer 85€
            expect(result.totalToWithdraw).toBe(85);
            // En utilisant 1x50, 1x20, 1x10, 1x5
            expect(result.suggestions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'b50', qty: 1 }),
                    expect.objectContaining({ name: 'b20', qty: 1 }),
                    expect.objectContaining({ name: 'b10', qty: 1 }),
                    expect.objectContaining({ name: 'b5', qty: 1 })
                ])
            );
        });
    });

    // NOUVEAU BLOC DE TEST POUR LA PRÉCISION
    describe('calculateWithdrawalSuggestion with high precision', () => {

        // On étend la configuration pour inclure toutes les pièces en euros
        const mockConfigWithCents = {
            denominations: {
                billets: { b50: 50, b20: 20, b10: 10, b5: 5 },
                pieces: { p2: 2, p1: 1, p050: 0.5, p020: 0.2, p010: 0.1, p005: 0.05, p002: 0.02, p001: 0.01 }
            }
        };

        it('devrait calculer un retrait avec une précision parfaite, même avec de nombreux centimes', () => {
            const caisseData = {
                // Un montant de vente qui forcera l'utilisation de nombreuses petites pièces
                ventes_especes: '12.38',
                retrocession: '0',
                // On s'assure d'avoir assez de chaque dénomination pour le test
                denominations: { 
                    b10: '1',  // 10€
                    p2: '1',   // 2€
                    p020: '1', // 0.20€
                    p010: '1', // 0.10€
                    p005: '1', // 0.05€
                    p002: '1', // 0.02€
                    p001: '1'  // 0.01€
                    // Total en caisse: 12.38€
                }
            };

            const result = calculateWithdrawalSuggestion(caisseData, mockConfigWithCents);

            // Le montant total à retirer doit être EXACTEMENT 12.38
            // Le test échouera ici si le calcul en virgule flottante produit une imprécision
            // comme 12.379999999999999
            expect(result.totalToWithdraw).toBe(12.38);

            // On vérifie que la suggestion est correcte et utilise bien les pièces disponibles
            expect(result.suggestions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'b10', qty: 1 }),
                    expect.objectContaining({ name: 'p2', qty: 1 }),
                    expect.objectContaining({ name: 'p020', qty: 1 }),
                    expect.objectContaining({ name: 'p010', qty: 1 }),
                    expect.objectContaining({ name: 'p005', qty: 1 }),
                    expect.objectContaining({ name: 'p002', qty: 1 }),
                    expect.objectContaining({ name: 'p001', qty: 1 })
                ])
            );
        });
    });
});
