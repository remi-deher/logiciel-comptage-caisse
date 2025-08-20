/**
 * Fichier JavaScript principal de l'application.
 * Contient la logique globale, y compris la navigation, le thème et les WebSockets.
 */
document.addEventListener('DOMContentLoaded', function() {

    // --- Fonctions utilitaires ---
    const formatDateTimeFr = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('fr-FR', options).format(now).replace(/^\w/, c => c.toUpperCase());
    };

    let isClotureMode = false;

    const Global = {
        init: function() {
            this.initNavbar();
            this.initThemeSwitcher();
            this.initVersionCheck();
            this.initClotureButton();
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
        },
        
        initClotureButton: function() {
            const clotureBtn = document.getElementById('cloture-btn');
            const clotureModal = document.getElementById('cloture-modal');
            const cancelClotureBtn = document.getElementById('cancel-cloture-btn');
            const confirmClotureBtn = document.getElementById('confirm-cloture-btn');
            const statusIndicator = document.getElementById('websocket-status-indicator');

            if (!clotureBtn || !clotureModal) return;

            clotureBtn.addEventListener('click', () => {
                console.log("Clic sur le bouton de clôture détecté.");
                const isCalculatorPage = window.location.search.includes('page=calculateur') || (window.location.pathname.endsWith('index.php') && !window.location.search);
                const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');

                if (isCalculatorPage && !isLoadedFromHistory) {
                    if (isClotureMode) {
                        // 2ème clic: Confirmation finale
                        document.querySelector('#cloture-modal h3').textContent = "Confirmer la clôture finale";
                        document.querySelector('#cloture-modal p').textContent = "Souhaitez-vous valider la clôture des caisses et les réinitialiser ?";
                        confirmClotureBtn.textContent = "Confirmer la clôture";
                        clotureModal.classList.add('visible');
                    } else {
                        // 1er clic: Lancement du mode clôture
                        document.querySelector('#cloture-modal h3').textContent = "Commencer la clôture";
                        document.querySelector('#cloture-modal p').textContent = "Voulez-vous passer en mode clôture pour vérifier le comptage avant de valider ?";
                        confirmClotureBtn.textContent = "Passer en mode clôture";
                        clotureModal.classList.add('visible');
                    }
                } else if (isLoadedFromHistory) {
                    alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                } else {
                    alert("La clôture est une fonctionnalité de la page 'Calculateur'.");
                }
            });

            cancelClotureBtn.addEventListener('click', () => {
                clotureModal.classList.remove('visible');
            });

            confirmClotureBtn.addEventListener('click', () => {
                clotureModal.classList.remove('visible');

                if (!isClotureMode) {
                    // C'est le 1er clic, on passe en mode clôture
                    isClotureMode = true;
                    if (statusIndicator) {
                        statusIndicator.classList.remove('connected', 'disconnected');
                        statusIndicator.classList.add('cloture');
                        statusIndicator.querySelector('.status-text').textContent = 'Mode Clôture';
                    }
                    const inputs = document.querySelectorAll('form#caisse-form input, form#caisse-form textarea, form#caisse-form button[type="submit"]');
                    inputs.forEach(input => {
                        input.setAttribute('disabled', 'disabled');
                    });
                    alert("Vous êtes maintenant en mode clôture. Vérifiez vos totaux et cliquez à nouveau sur 'Clôture' pour valider.");
                } else {
                    // C'est le 2ème clic, on lance la procédure finale
                    if (statusIndicator) {
                        statusIndicator.classList.remove('cloture');
                        statusIndicator.classList.add('connected');
                        statusIndicator.querySelector('.status-text').textContent = 'Clôture en cours...';
                    }
                    
                    const caisseForm = document.getElementById('caisse-form');
                    if (!caisseForm) {
                        alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
                        return;
                    }
                    const formData = new FormData(caisseForm);
                    
                    fetch('index.php?action=cloture', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Erreur réseau lors de la clôture');
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            alert(data.message);
                            window.location.reload();
                        } else {
                            throw new Error(data.message || 'Erreur inconnue');
                        }
                    })
                    .catch(error => {
                        console.error("Erreur lors de la clôture:", error);
                        alert("Une erreur est survenue lors de la clôture: " + error.message);
                        if (statusIndicator) {
                            statusIndicator.classList.remove('cloture');
                            statusIndicator.classList.add('connected');
                            statusIndicator.querySelector('.status-text').textContent = 'Connecté en temps réel';
                        }
                    });
                }
            });
        }
    };

    Global.init();
});
