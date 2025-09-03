// Fichier : public/assets/js/pages/LoginPage.js

import { initializeLoginLogic } from '../logic/login-logic.js';

export function renderLoginPage(element) {
  element.innerHTML = `
    <div class="container">
        <div class="admin-card login-card">
            <div class="login-header">
                <h2><i class="fa-solid fa-toolbox"></i>Panneau d'Administration</h2>
                <p>Connectez-vous pour continuer</p>
            </div>

            <div id="login-error-message" class="error" style="display: none;"></div>

            <form id="login-form">
                <div class="form-group with-icon">
                    <i class="fa-solid fa-user input-icon"></i>
                    <input type="text" id="username" name="username" placeholder="Nom d'utilisateur" required autofocus>
                </div>
                <div class="form-group with-icon">
                    <i class="fa-solid fa-lock input-icon"></i>
                    <input type="password" id="password" name="password" placeholder="Mot de passe" required>
                </div>
                <button type="submit" class="save-btn" style="width: 100%;">Se connecter</button>
            </form>
        </div>
    </div>
  `;

  // On lance la logique associée au formulaire
  initializeLoginLogic();
}
