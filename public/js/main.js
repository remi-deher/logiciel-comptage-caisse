/**
 * Fichier JavaScript principal de l'application.
 */
document.addEventListener('DOMContentLoaded', function() {

    const Global = {
        init: function() {
            this.initNavbar();
            this.initThemeSwitcher();
            this.initVersionCheck();
        },

        initNavbar: function() {
            const navbarToggler = document.getElementById('navbar-toggler');
            const navbarCollapse = document.getElementById('navbar-collapse');
            if (navbarToggler && navbarCollapse) {
                navbarToggler.addEventListener('click', () => navbarCollapse.classList.toggle('show'));
            }
        },

        initThemeSwitcher: function() {
            const switcher = document.getElementById('theme-switcher');
            if (!switcher) return;

            const applyTheme = (theme) => {
                document.body.dataset.theme = theme;
                localStorage.setItem('theme', theme);
            };

            switcher.addEventListener('click', () => {
                const currentTheme = document.body.dataset.theme || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                applyTheme(newTheme);
            });

            // Appliquer le thème au chargement
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
            applyTheme(defaultTheme);
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
                    console.error("Détails de l'erreur de l'API:", data);
                    return;
                }

                if (releaseInfoContainer && data.formatted_release_date && data.release_url) {
                    releaseInfoContainer.innerHTML = `Dernière release : <a href="${data.release_url}" target="_blank" rel="noopener noreferrer">${data.remote_version}</a> le ${data.formatted_release_date}`;
                }

                if (data.update_available) {
                    versionInfo.innerHTML = `Version <strong>${data.local_version}</strong>. 
                        <span style="color: #e67e22;">Mise à jour vers ${data.remote_version} disponible.</span>`;
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
                        if (force && icon) {
                            setTimeout(() => icon.classList.remove('fa-spin'), 500);
                        }
                    })
                    .catch(error => {
                        versionInfo.textContent = "Impossible de vérifier la version.";
                        if (releaseInfoContainer) releaseInfoContainer.innerHTML = 'Dernière release : N/A';
                        console.error('Erreur lors de la vérification de la version:', error);
                        if (force && icon) icon.classList.remove('fa-spin');
                    });
            };

            performVersionCheck();

            if (forceCheckBtn) {
                forceCheckBtn.addEventListener('click', () => performVersionCheck(true));
            }

            updateButton.addEventListener('click', function(e) {
                e.preventDefault(); 
                
                const confirmationMessage = `
Une nouvelle version est disponible !

--- NOTES DE VERSION ---
${window.releaseNotes || 'Non disponible'}
-------------------------

Voulez-vous mettre à jour l'application maintenant ?`;

                if (confirm(confirmationMessage)) {
                    window.location.href = this.href;
                }
            });
        }
    };

    Global.init();
});
