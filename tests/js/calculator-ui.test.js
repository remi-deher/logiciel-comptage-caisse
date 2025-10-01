import { renderCalculatorUI } from '../../public/assets/js/logic/calculator-ui.js';

describe('calculator-ui', () => {

    const mockConfig = {
        currencySymbol: '€',
        nomsCaisses: {
            '1': 'Caisse Principale'
        },
        denominations: {
            billets: { b50: 50, b10: 10 },
            pieces: { p2: 2, p050: 0.5 }
        },
        tpeParCaisse: {}
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="calculator-page">
                <div class="tab-selector"></div>
                <div class="ecart-display-container"></div>
                <div id="caisses-content-container"></div>
            </div>
        `;
    });

    describe('renderCalculatorUI', () => {

        it('devrait générer un onglet pour chaque caisse configurée', () => {
            const pageElement = document.getElementById('calculator-page');
            renderCalculatorUI(pageElement, mockConfig);

            const tabLink = pageElement.querySelector('.tab-link');
            expect(tabLink).not.toBeNull();
            expect(tabLink.textContent).toBe('Caisse Principale');
            expect(tabLink.dataset.caisseId).toBe('1');
        });

        it('devrait générer les cartes de dénomination pour les billets et les pièces', () => {
            const pageElement = document.getElementById('calculator-page');
            renderCalculatorUI(pageElement, mockConfig);

            const caisseContent = pageElement.querySelector('#caisse1');
            
            // Vérifie la carte pour le billet de 50€
            const inputB50 = caisseContent.querySelector('#b50_1');
            const cardB50 = inputB50.closest('.denom-card');
            const headerB50 = cardB50.querySelector('.denom-card-header');
            expect(headerB50.textContent).toBe('50 €');
            expect(inputB50.name).toBe('caisse[1][denominations][b50]');

            // --- CORRECTION CI-DESSOUS ---
            // On cible l'input unique de la pièce de 50cts pour trouver sa carte parente
            const inputP050 = caisseContent.querySelector('#p050_1');
            const cardP050 = inputP050.closest('.denom-card'); // On remonte au parent .denom-card
            const headerP050 = cardP050.querySelector('.denom-card-header'); // On trouve le header DANS cette carte
            
            expect(headerP050.textContent).toBe('50 cts');
            expect(cardP050.classList.contains('is-piece')).toBe(true);
        });

        it('devrait créer les champs de saisie pour les montants théoriques', () => {
            const pageElement = document.getElementById('calculator-page');
            renderCalculatorUI(pageElement, mockConfig);

            const ventesEspecesInput = pageElement.querySelector('#ventes_especes_1');
            expect(ventesEspecesInput).not.toBeNull();
            expect(ventesEspecesInput.name).toBe('caisse[1][ventes_especes]');

            const fondDeCaisseInput = pageElement.querySelector('#fond_de_caisse_1');
            expect(fondDeCaisseInput).not.toBeNull();
            expect(fondDeCaisseInput.name).toBe('caisse[1][fond_de_caisse]');
        });

    });

});
