// Fichier : public/assets/js/pages/AidePage.js

import { initializeAideLogic } from '../logic/aide-logic.js';

export function renderAidePage(element) {
  // Le contenu de la page d'aide est principalement statique.
  // Nous copions ici le HTML de l'ancien template 'aide.php'.
  element.innerHTML = `
    <div class="container" id="help-page">
        <div class="help-header">
            <h2><i class="fa-solid fa-circle-question" style="color: #3498db;"></i> Guide d'Utilisation</h2>
            <p style="font-size: 1.1em;">Cliquez sur une section pour obtenir des explications détaillées.</p>
        </div>

        <div class="help-search-container">
            <i class="fa-solid fa-search"></i>
            <input type="text" id="help-search-input" placeholder="Rechercher une aide...">
        </div>

        <h3 class="help-category-title">Fonctionnalités Utilisateur</h3>
        <div class="help-grid">
            <div class="help-card"
                 data-title="Le Calculateur"
                 data-icon="fa-solid fa-calculator"
                 data-content="<h4>Une interface intuitive et complète</h4><p>La page du calculateur est organisée en onglets pour chaque caisse, et chaque caisse dispose de plusieurs sections pour une saisie claire et rapide...</p><h4>Indicateur d'écart en temps réel</h4><p>Situé en haut de la page, cet encadré est votre guide...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-calculator"></i></div>
                    <h3>Le Calculateur</h3>
                </div>
                <p>La page principale pour saisir vos comptages et voir les résultats en direct.</p>
                <div class="help-card-footer">
                    <a href="/calculateur" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
                </div>
            </div>

            <div class="help-card"
                 data-title="L'Historique"
                 data-icon="fa-solid fa-history"
                 data-content="<h4>Retrouvez et analysez vos comptages</h4><p>La page d'historique affiche tous vos comptages passés sous forme de cartes interactives...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-history"></i></div>
                    <h3>L'Historique</h3>
                </div>
                <p>Consultez, filtrez et exportez tous vos comptages enregistrés.</p>
                <div class="help-card-footer">
                    <a href="/historique" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
                </div>
            </div>
            
            <div class="help-card"
             data-title="Les Statistiques"
             data-icon="fa-solid fa-chart-pie"
             data-content="<h4>Analysez vos données</h4><p>La page de statistiques vous offre un tableau de bord complet pour analyser vos données de comptage...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-chart-pie"></i></div>
                    <h3>Les Statistiques</h3>
                </div>
                <p>Visualisez la répartition des ventes et des indicateurs clés via un tableau de bord complet.</p>
                <div class="help-card-footer">
                    <a href="/statistiques" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
                </div>
            </div>
        </div>

        <h3 class="help-category-title">Administration & Maintenance</h3>
        <div class="help-grid">
             <div class="help-card"
                 data-title="Collaboration en Temps Réel"
                 data-icon="fa-solid fa-wifi"
                 data-content="<h4>Comment ça marche ?</h4><p>Grâce à une technologie appelée WebSocket, l'application maintient une connexion permanente avec le serveur...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-wifi"></i></div>
                    <h3>Collaboration en Temps Réel</h3>
                </div>
                <p>Travaillez à plusieurs sur le même comptage et voyez les modifications instantanément.</p>
            </div>
            <div class="help-card"
                 data-title="Processus de Clôture"
                 data-icon="fa-solid fa-lock"
                 data-content="<h4>Pourquoi la clôture ?</h4><p>Le bouton 'Clôture' dans la barre de navigation est un outil de collaboration qui permet de sauvegarder l'état des caisses de manière sécurisée...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-lock"></i></div>
                    <h3>Processus de Clôture</h3>
                </div>
                <p>Découvrez le processus sécurisé pour finaliser les comptages de la journée.</p>
            </div>
            <div class="help-card"
                 data-title="Panneau d'Administration"
                 data-icon="fa-solid fa-toolbox"
                 data-content="<p>Cette section, accessible via un compte sécurisé, est le centre de contrôle de l'application...</p>">
                <div class="help-card-header">
                    <div class="help-card-icon"><i class="fa-solid fa-toolbox"></i></div>
                    <h3>Panneau d'Administration</h3>
                </div>
                <p>Gérez les paramètres techniques et la sécurité de l'application.</p>
                <div class="help-card-footer">
                    <a href="/admin" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
                </div>
            </div>
        </div>
    </div>

    <div id="help-modal" class="modal">
        <div class="modal-content">
            <span class="modal-close">&times;</span>
            <div id="help-modal-content">
                </div>
        </div>
    </div>
  `;

  // Une fois le HTML en place, on lance la logique JavaScript associée
  initializeAideLogic();
}
