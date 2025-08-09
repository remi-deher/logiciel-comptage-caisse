// public/js/app.js

document.addEventListener('DOMContentLoaded', function() {
    const versionInfo = document.getElementById('version-info');
    const updateButton = document.getElementById('update-button');

    // S'assure que les éléments existent avant de continuer
    if (versionInfo && updateButton) {
        
        // --- VÉRIFICATION DE LA VERSION ---
        fetch('https://api.github.com/repos/remi-deher/logiciel-comptage-caisse/releases/latest', {
            headers: {
                // Ajouter un User-Agent est une bonne pratique pour éviter les blocages de l'API GitHub
                'User-Agent': 'Comptage-Caisse-App'
            }
        })
        .then(response => {
            // Si la réponse du serveur n'est pas "OK" (ex: 404, 500), on génère une erreur
            if (!response.ok) {
                throw new Error(`La requête a échoué avec le statut : ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const latestVersion = data && data.tag_name; // Récupère le tag de la dernière release (ex: "v1.1.0")
            const currentVersionElement = document.querySelector('.main-footer strong');
            
            // Vérifie si l'élément contenant la version actuelle a été trouvé
            if (!currentVersionElement) {
                versionInfo.textContent = 'Erreur : Impossible de trouver la version actuelle sur la page.';
                return;
            }
            const currentVersion = currentVersionElement.textContent;

            if (latestVersion) {
                // Compare la version actuelle avec la dernière version disponible
                if (latestVersion !== currentVersion) {
                    versionInfo.textContent = `Une nouvelle version (${latestVersion}) est disponible.`;
                    updateButton.style.display = 'inline-block'; // Affiche le bouton
                    // Au clic sur le bouton, redirige vers la page de la dernière release
                    updateButton.onclick = () => {
                        window.open('https://github.com/remi-deher/logiciel-comptage-caisse/releases/latest', '_blank');
                    };
                } else {
                    versionInfo.textContent = 'Votre application est à jour.';
                }
            } else {
                versionInfo.textContent = 'Impossible de vérifier la dernière version.';
            }
        })
        .catch(error => {
            // Affiche une erreur claire si la requête fetch échoue
            console.error('Erreur lors de la vérification de la version:', error);
            versionInfo.textContent = `Erreur lors de la vérification.`;
        });
    }
});
