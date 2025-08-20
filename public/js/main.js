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

    let clotureModal, cancelClotureBtn, confirmClotureBtn;
    let isClotureMode = sessionStorage.getItem('isClotureMode') === 'true';

    const Global = {
        init: function() {
            this.initNavbar();
            this.initThemeSwitcher();
            this.initVersionCheck();
            this.initClotureButton();
            this.checkClotureModeStatus(); 
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
        
        checkClotureModeStatus: function() {
            const statusIndicator = document.getElementById('websocket-status-indicator');
            const isCalculatorPage = window.location.search.includes('page=calculateur') || (window.location.pathname.endsWith('index.php') && !window.location.search);
            const caisseForm = document.getElementById('caisse-form');
            
            if (isCalculatorPage && isClotureMode) {
                document.body.classList.add('cloture-active');
                if (statusIndicator) {
                    statusIndicator.classList.remove('connected', 'disconnected');
                    statusIndicator.classList.add('cloture');
                    statusIndicator.querySelector('.status-text').textContent = 'Connecté en temps réel : Cloture'; // NOUVEAU: Texte mis à jour
                }
                if (caisseForm) {
                    const inputs = caisseForm.querySelectorAll('input, textarea, button[type="submit"]');
                    inputs.forEach(input => {
                        input.setAttribute('disabled', 'disabled');
                    });
                }
            } else {
                document.body.classList.remove('cloture-active');
                sessionStorage.removeItem('isClotureMode');
                if (statusIndicator) {
                     statusIndicator.classList.remove('cloture');
                }
            }
        },

        initClotureButton: function() {
            const clotureBtn = document.getElementById('cloture-btn');
            clotureModal = document.getElementById('cloture-modal');
            cancelClotureBtn = document.getElementById('cancel-cloture-btn');
            const startClotureBtn = document.getElementById('start-cloture-btn');
            const confirmFinalClotureBtn = document.getElementById('confirm-final-cloture-btn');
            const statusIndicator = document.getElementById('websocket-status-indicator');
            const caisseForm = document.getElementById('caisse-form');

            // --- NOUVEAU: Ajout de logs pour le diagnostic ---
            console.log("Initialisation du bouton de clôture...");
            if (!clotureBtn) {
                console.error("ERREUR: Le bouton avec l'ID 'cloture-btn' est introuvable.");
                return;
            }
            if (!clotureModal) {
                 console.error("ERREUR: La modale avec l'ID 'cloture-modal' est introuvable.");
                 return;
            }
            console.log("Bouton et modale de clôture trouvés. Attribution des écouteurs d'événements.");

            // Écouteur pour le bouton de la barre de navigation
            clotureBtn.addEventListener('click', () => {
                console.log("Clic sur le bouton de clôture détecté.");
                const isCalculatorPage = window.location.search.includes('page=calculateur') || (window.location.pathname.endsWith('index.php') && !window.location.search);
                const isLoadedFromHistory = document.getElementById('calculator-data')?.dataset.config.includes('isLoadedFromHistory":true');

                if (isCalculatorPage && !isLoadedFromHistory) {
                    // Si on est en mode clôture, on affiche la modale de confirmation finale
                    if (sessionStorage.getItem('isClotureMode') === 'true') {
                        document.querySelector('#cloture-modal h3').textContent = "Confirmer la clôture finale";
                        document.querySelector('#cloture-modal p').textContent = "Souhaitez-vous valider la clôture des caisses et les réinitialiser ?";
                        startClotureBtn.style.display = 'none';
                        confirmFinalClotureBtn.style.display = 'block';
                        clotureModal.classList.add('visible');
                        console.log("Affichage de la modale de confirmation finale.");
                    } else {
                        // Sinon, on affiche la modale de lancement du mode clôture
                        document.querySelector('#cloture-modal h3').textContent = "Commencer la clôture";
                        document.querySelector('#cloture-modal p').textContent = "Voulez-vous passer en mode clôture pour vérifier le comptage avant de valider ?";
                        startClotureBtn.style.display = 'block';
                        confirmFinalClotureBtn.style.display = 'none';
                        clotureModal.classList.add('visible');
                        console.log("Affichage de la modale de lancement de la clôture.");
                    }
                } else if (isLoadedFromHistory) {
                    alert("La clôture ne peut pas être lancée depuis le mode consultation de l'historique.");
                    console.warn("Échec de l'affichage de la modale: mode consultation.");
                } else {
                    alert("La clôture est une fonctionnalité de la page 'Calculateur'.");
                    console.warn("Échec de l'affichage de la modale: page incorrecte.");
                }
            });

            // Écouteur pour le bouton "Annuler"
            cancelClotureBtn.addEventListener('click', () => {
                clotureModal.classList.remove('visible');
                console.log("Modale de clôture annulée.");
            });

            // Écouteur pour le bouton "Passer en mode clôture" (premier clic)
            startClotureBtn.addEventListener('click', () => {
                 clotureModal.classList.remove('visible');
                console.log("Confirmation de l'entrée en mode clôture.");
                sessionStorage.setItem('isClotureMode', 'true');
                window.location.reload();
            });

            // Écouteur pour le bouton "Confirmer la clôture" (second clic)
            confirmFinalClotureBtn.addEventListener('click', () => {
                clotureModal.classList.remove('visible');
                console.log("Lancement de la procédure de clôture finale.");
                
                if (statusIndicator) {
                    statusIndicator.classList.remove('cloture');
                    statusIndicator.classList.add('connected');
                    statusIndicator.querySelector('.status-text').textContent = 'Clôture en cours...';
                }
                
                if (!caisseForm) {
                    alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
                    console.error("Erreur critique: Le formulaire de caisse est introuvable.");
                    return;
                }
                const formData = new FormData(caisseForm);
                
                console.log("Appel à l'API de clôture en cours...");
                fetch('index.php?action=cloture', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        console.error("Erreur réseau:", response.status, response.statusText);
                        throw new Error('Erreur réseau lors de la clôture');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Réponse de l'API:", data);
                    if (data.success) {
                        alert(data.message);
                        sessionStorage.removeItem('isClotureMode');
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
            });
        }
    };

    Global.init();
});
