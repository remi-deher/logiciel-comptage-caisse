// public/js/history/dom.js
// Ce module centralise UNIQUEMENT la sélection des éléments du DOM.

// --- Éléments principaux de la page ---
export const historyPage = document.getElementById('history-page');
export const historyGrid = document.querySelector('.history-grid');
export const paginationNav = document.querySelector('.pagination-nav');
export const form = document.getElementById('history-filter-form');
export const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
export const globalChartContainer = document.getElementById('global-chart-container');
export const resetBtn = document.querySelector('a[href*="historique&vue=tout"]');
export const viewTabs = document.querySelector('.view-tabs');
export const comptagesView = document.getElementById('comptages-view');
export const retraitsView = document.getElementById('retraits-view');
export const withdrawalsSummaryTable = document.getElementById('withdrawals-summary-table');

// --- Éléments pour la comparaison ---
export const comparisonToolbar = document.getElementById('comparison-toolbar');
export const comparisonCounter = document.getElementById('comparison-counter');
export const compareBtn = document.getElementById('compare-btn');

// --- Éléments pour les modales ---
export const detailsModal = document.getElementById('details-modal');
export const detailsModalContent = document.getElementById('modal-details-content');
export const comparisonModal = document.getElementById('comparison-modal');
export const comparisonModalContent = document.getElementById('modal-comparison-content');

// --- Éléments pour l'export ---
export const printBtn = document.getElementById('print-btn');
export const excelBtn = document.getElementById('excel-btn');
export const pdfBtn = document.getElementById('pdf-btn');
