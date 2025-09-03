// Fichier : public/assets/js/logic/login-logic.js

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

        if (!result.success) {
            throw new Error(result.message || 'Identifiants incorrects.');
        }

        // Connexion réussie !
        // On redirige vers la page admin en utilisant le routeur de la SPA
        window.location.hash = '#/admin'; // Une façon simple de changer de page
        window.dispatchEvent(new PopStateEvent('popstate'));


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
