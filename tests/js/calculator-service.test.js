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
                        pieces: { p01: 0.01, p02: 0.02 }
                    }
                },
                calculatorData: {
                    caisse: {
                        '1': {
                            fond_de_caisse: '0',
                            ventes_especes: '0.03',
                            denominations: {
                                p01: '1', // 0.01€
                                p02: '1'  // 0.02€
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
});
