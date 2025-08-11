/**
 * Fichier JavaScript principal de l'application.
 * Contient la logique globale (navbar, version check) chargée sur toutes les pages.
 */
document.addEventListener('DOMContentLoaded', function() {

    // --- MODULE GLOBAL (s'applique à toutes les pages) ---
    const Global = {
        init: function() {
            this.initNavbar();
            this.initVersionCheck();
        },

        initNavbar: function() {
            const navbarToggler = document.getElementById('navbar-toggler');
            const navbarCollapse = document.getElementById('navbar-collapse');
            if (navbarToggler && navbarCollapse) {
                navbarToggler.addEventListener('click', () => navbarCollapse.classList.toggle('show'));
            }
        },

        initVersionCheck: function() {
            const versionInfo = document.getElementById('version-info');
            const updateButton = document.getElementById('update-button');
            const releaseInfoContainer = document.getElementById('release-info-container');
            const forceCheckBtn = document.getElementById('force-version-check');

            if (!versionInfo || !updateButton || !releaseInfoContainer) return;

            const handleVersionData = (data) => {
                if (data.error) {
                    versionInfo.textContent = "Erreur de vérification.";
                    if (releaseInfoContainer) releaseInfoContainer.innerHTML = 'Dernière release : N/A';
                    return;
                }
                if (releaseInfoContainer && data.formatted_release_date && data.release_url) {
                    releaseInfoContainer.innerHTML = `Dernière release : <a href="${data.release_url}" target="_blank" rel="noopener noreferrer">${data.remote_version}</a> le ${data.formatted_release_date}`;
                }
                if (data.update_available) {
                    versionInfo.innerHTML = `Version <strong>${data.local_version}</strong>. <span style="color: #e67e22;">Mise à jour vers ${data.remote_version} disponible.</span>`;
                    updateButton.style.display = 'inline-block';
                    window.releaseNotes = data.release_notes;
                } else {
                    versionInfo.innerHTML = `Version <strong>${data.local_version}</strong>. Vous êtes à jour.`;
                }
            };

            const performVersionCheck = (force = false) => {
                const endpoint = force ? 'index.php?action=force_git_release_check' : 'index.php?action=git_release_check';
                const icon = force ? forceCheckBtn.querySelector('i') : null;

                if (force && icon) icon.classList.add('fa-spin');
                versionInfo.textContent = force ? 'Vérification forcée...' : 'Vérification de la version...';
                
                fetch(endpoint)
                    .then(response => response.json())
                    .then(data => {
                        handleVersionData(data);
                        if (force && icon) setTimeout(() => icon.classList.remove('fa-spin'), 500);
                    })
                    .catch(() => {
                        versionInfo.textContent = "Impossible de vérifier la version.";
                        if (releaseInfoContainer) releaseInfoContainer.innerHTML = 'Dernière release : N/A';
                        if (force && icon) icon.classList.remove('fa-spin');
                    });
            };

            performVersionCheck();
            if (forceCheckBtn) forceCheckBtn.addEventListener('click', () => performVersionCheck(true));

            updateButton.addEventListener('click', function(e) {
                // On empêche le comportement par défaut si c'est un lien <a>
                e.preventDefault(); 
                
                const confirmationMessage = `Une nouvelle version est disponible !\n\n--- NOTES DE VERSION ---\n${window.releaseNotes || 'Non disponible'}\n-------------------------\n\nVoulez-vous mettre à jour l'application maintenant ?`;
                if (confirm(confirmationMessage)) {
                    // On redirige vers la page de mise à jour dédiée
                    window.location.href = this.href;
                }
            });
        }
    };

    // Initialisation du module global
    Global.init();
});
