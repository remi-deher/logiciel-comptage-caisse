// Fichier: public/assets/js/components/Footer.js (Mis à jour avec des URL propres)

export function renderFooter(element) {
  const currentYear = new Date().getFullYear();
  element.innerHTML = `
    <footer class="main-footer">
        <div class="footer-content">
            <div class="footer-section footer-links">
                <h4>Ressources</h4>
                <a href="https://github.com/remi-deher/logiciel-comptage-caisse/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">... Licence MIT</a>
                <a href="https://github.com/remi-deher/logiciel-comptage-caisse" target="_blank" rel="noopener noreferrer">... Dépôt GitHub</a>
                <a href="/aide"><i class="fa-solid fa-circle-question"></i> Guide d'utilisation</a>
            </div>
            </div>
        <div class="footer-bottom">
            <p>&copy; ${currentYear} - Développé par DEHER Rémi. Tous droits réservés.</p>
        </div>
    </footer>
  `;
}
