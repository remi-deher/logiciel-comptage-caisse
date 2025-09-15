// Fichier : public/assets/js/utils/formatters.js

export const formatCurrency = (amount, config = { currencyCode: 'EUR' }) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: config.currencyCode || 'EUR' }).format(amount);

export const parseLocaleFloat = (str) => 
    parseFloat(String(str || '0').replace(',', '.')) || 0;

export const formatDateFr = (dateString, options = { dateStyle: 'long', timeStyle: 'short' }) => 
    new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString));

export const getEcartClass = (ecart) => {
    if (Math.abs(ecart) < 0.01) return 'ecart-ok';
    return ecart > 0 ? 'ecart-positif' : 'ecart-negatif';
};
