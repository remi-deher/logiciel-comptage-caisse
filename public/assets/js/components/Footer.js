// Fichier: public/assets/js/components/Footer.js (Version améliorée)

/**
 * Récupère la version de l'application depuis l'API et l'affiche dans le pied de page.
 */
async function updateVersionInfo() {
    const versionElement = document.getElementById('app-version');
    if (!versionElement) return;

    try {
        const response = await fetch('index.php?route=version/get_local');
        if (!response.ok) {
            throw new Error('La réponse du serveur n\'est pas valide.');
        }
        const data = await response.json();
        if (data.success && data.version) {
            versionElement.textContent = `Version ${data.version}`;
        }
    } catch (error) {
        console.error("Impossible de récupérer la version de l'application:", error);
        versionElement.textContent = ''; // Cache le texte en cas d'erreur
    }
}


export function renderFooter(element) {
  const currentYear = new Date().getFullYear();
  element.innerHTML = `
    <footer class="main-footer">
        <div class="footer-content">

            <div class="footer-section footer-about">
                <h4><i class="fa-solid fa-cash-register"></i> Comptage Caisse</h4>
                <p>Un outil web simple et efficace pour réaliser et suivre vos comptages de caisse au quotidien. Conçu pour être rapide, collaboratif et open-source.</p>
            </div>

            <div class="footer-section footer-links">
                <h4>Navigation</h4>
                <ul>
                    <li><a href="/calculateur"><i class="fa-solid fa-calculator fa-fw"></i> Calculateur</a></li>
                    <li><a href="/historique"><i class="fa-solid fa-history fa-fw"></i> Historique</a></li>
                    <li><a href="/statistiques"><i class="fa-solid fa-chart-pie fa-fw"></i> Statistiques</a></li>
                    <li><a href="/reserve"><i class="fa-solid fa-vault fa-fw"></i> Réserve</a></li>
                </ul>
            </div>

            <div class="footer-section footer-resources">
                <h4>Ressources</h4>
                <ul>
                    <li><a href="/aide"><i class="fa-solid fa-circle-question fa-fw"></i> Guide d'utilisation</a></li>
                    <li><a href="/changelog"><i class="fa-solid fa-rocket fa-fw"></i> Journal des modifications</a></li>
                    <li><a href="https://github.com/remi-deher/logiciel-comptage-caisse" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github fa-fw"></i> Code Source (GitHub)</a></li>
                    <li><a href="https://github.com/remi-deher/logiciel-comptage-caisse/issues" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-bug fa-fw"></i> Signaler un problème</a></li>
                </ul>
            </div>

        </div>
        <div class="footer-bottom">
            <p>&copy; ${currentYear} - Développé par DEHER Rémi.</p>
            <p id="app-version" class="app-version">Chargement...</p>
        </div>
    </footer>
  `;

  // Une fois le HTML affiché, on lance la récupération de la version
  updateVersionInfo();
}
