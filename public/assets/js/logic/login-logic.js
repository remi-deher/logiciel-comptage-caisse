// Fichier : public/assets/js/logic/login-logic.js (Corrigé)

import { handleRouting } from '../router.js';

/**
 * Gère la soumission du formulaire de connexion à l'API.
 * @param {Event} event L'événement de soumission du formulaire.
 */
async function handleLoginSubmit(event) {
    event.preventDefault(); // Empêche le rechargement de la page
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const errorContainer = document.getElementById('login-error-message');

    // Affiche un état de chargement
    submitButton.disabled = true;
    submitButton.innerHTML = 'Connexion...';
    if (errorContainer) errorContainer.style.display = 'none';

    try {
        const formData = new FormData(form);
        const response = await fetch('index.php?route=auth/login', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Identifiants incorrects.');
        }

        // --- DÉBUT DE LA CORRECTION ---
        // Connexion réussie !
        // On utilise le routeur de la SPA pour naviguer vers la page admin.
        // Cela évite un rechargement complet de la page.
        console.log('Connexion réussie, redirection vers /admin');
        history.pushState(null, '', '/admin'); // Change l'URL dans la barre d'adresse
        handleRouting(); // Demande au routeur de charger la page /admin
        // --- FIN DE LA CORRECTION ---

    } catch (error) {
        if (errorContainer) {
            errorContainer.textContent = error.message;
            errorContainer.style.display = 'block';
        }
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Se connecter';
    }
}

/**
 * Initialise la logique de la page de connexion.
 */
export function initializeLoginLogic() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
}
