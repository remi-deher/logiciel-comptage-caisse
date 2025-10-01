import { formatCurrency, parseLocaleFloat, formatDateFr, getEcartClass } from '../../public/assets/js/utils/formatters.js';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format a number to a currency string', () => {
      expect(formatCurrency(1234.56)).toBe('1 234,56 €');
    });
  });

  describe('parseLocaleFloat', () => {
    it('should parse a string with a comma to a float', () => {
      expect(parseLocaleFloat('123,45')).toBe(123.45);
    });
  });

  describe('formatDateFr', () => {
    it('should format a date string to a French date string', () => {
      // Note: le résultat peut varier légèrement en fonction de l'environnement d'exécution
      const date = new Date('2025-10-26T10:00:00Z');
      const formatted = formatDateFr(date);
      expect(formatted).toContain('26 octobre 2025');
    });
  });

  describe('getEcartClass', () => {
    it('should return "ecart-ok" for a zero ecart', () => {
      expect(getEcartClass(0)).toBe('ecart-ok');
    });

    it('should return "ecart-positif" for a positive ecart', () => {
      expect(getEcartClass(10)).toBe('ecart-positif');
    });

    it('should return "ecart-negatif" for a negative ecart', () => {
      expect(getEcartClass(-10)).toBe('ecart-negatif');
    });
  });
});
