<?php
// templates/aide.php

$page_css = 'aide.css'; // Définit la feuille de style spécifique à cette page
$page_js = 'help.js'; // Définit le script JS spécifique à cette page

require 'partials/header.php';
require 'partials/navbar.php';
?>

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
             data-content="<h4>Une interface intuitive et complète</h4><p>La page du calculateur est organisée en onglets pour chaque caisse, et chaque caisse dispose de plusieurs sections pour une saisie claire et rapide :</p>
             <ol>
                <li><strong><span class='highlight'>Informations Générales</span> :</strong> Saisissez ici le fond de caisse, le total des ventes théoriques de la journée et les éventuelles rétrocessions (prélèvements).</li>
                <li><strong><span class='highlight'>Détail par mode de paiement</span> :</strong>
                    <ul>
                        <li><strong>Espèces :</strong> Renseignez le nombre de billets et de pièces comptés. Le total se calcule automatiquement.</li>
                        <li><strong>Carte Bancaire :</strong> Entrez les montants de chaque terminal de paiement. L'application calcule l'écart par rapport au total attendu.</li>
                        <li><strong>Chèques :</strong> Ajoutez autant de chèques que nécessaire. Le total est calculé automatiquement.</li>
                    </ul>
                </li>
             </ol>
             <h4>Indicateur d'écart en temps réel</h4>
             <p>Situé en haut de la page, cet encadré est votre guide. Il change de couleur et de message pour vous informer de l'état de la caisse active :</p>
             <ul>
                <li><strong style='color: #27ae60;'>Vert :</strong> Félicitations ! L'écart est nul, votre caisse est juste.</li>
                <li><strong style='color: #f39c12;'>Orange :</strong> Il y a un surplus d'argent. Vérifiez vos saisies.</li>
                <li><strong style='color: #c0392b;'>Rouge :</strong> Il manque de l'argent. Un recomptage est conseillé.</li>
             </ul>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-calculator"></i></div>
                <h3>Le Calculateur</h3>
            </div>
            <p>La page principale pour saisir vos comptages et voir les résultats en direct.</p>
            <div class="help-card-footer">
                <a href="index.php?page=calculateur" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
            </div>
        </div>

        <div class="help-card"
             data-title="L'Historique"
             data-icon="fa-solid fa-history"
             data-content="<h4>Retrouvez et analysez vos comptages</h4><p>La page d'historique affiche tous vos comptages passés sous forme de cartes interactives.</p>
             <ul>
                <li class='list-item-with-icon'><i class='fa-solid fa-filter'></i> <span><strong><span class='highlight'>Filtrage puissant</span> :</strong> Utilisez les champs en haut pour rechercher un comptage par nom ou pour filtrer par une période spécifique. Des boutons de filtre rapide sont également disponibles pour 'Aujourd'hui', 'Hier', '7 derniers jours', et '30 derniers jours'.</span></li>
                <li class='list-item-with-icon'><i class='fa-solid fa-chart-bar'></i> <span><strong><span class='highlight'>Graphiques par carte</span> :</strong> Chaque carte de comptage inclut un mini-graphique en barres pour visualiser rapidement la répartition des ventes entre vos différentes caisses.</span></li>
                <li class='list-item-with-icon'><i class='fa-solid fa-file-export'></i> <span><strong><span class='highlight'>Détails et Exports</span> :</strong> Sur chaque carte, cliquez sur le nom d'une caisse pour voir son décompte détaillé. Cliquez sur 'Ensemble' pour une vue complète avec une synthèse globale. Depuis cette fenêtre, vous pouvez exporter les détails en PDF ou Excel.</span></li>
             </ul>
             <h4>Mode Consultation</h4>
             <p>En cliquant sur un comptage depuis l'historique, vous passez en <strong><span class='highlight'>Mode Consultation</span></strong>. Dans ce mode, toutes les modifications en temps réel et la sauvegarde automatique sont désactivées pour vous permettre de consulter les données sans risque de les modifier. Un bandeau spécial vous l'indique en haut de la page.</p>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-history"></i></div>
                <h3>L'Historique</h3>
            </div>
            <p>Consultez, filtrez et exportez tous vos comptages enregistrés.</p>
            <div class="help-card-footer">
                <a href="index.php?page=historique" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
            </div>
        </div>

        <div class="help-card"
             data-title="Les Statistiques"
             data-icon="fa-solid fa-chart-pie"
             data-content="<h4>Analysez vos données</h4><p>La page de statistiques vous offre un tableau de bord complet pour analyser vos données de comptage. Elle se divise en plusieurs sections :</p>
             <ul>
                <li class='list-item-with-icon'><i class='fa-solid fa-calendar-days'></i> <span><strong><span class='highlight'>Filtres</span> :</strong> Vous pouvez filtrer les données par période grâce à des boutons de raccourci ou en choisissant une période personnalisée.</span></li>
                <li class='list-item-with-icon'><i class='fa-solid fa-gauge-high'></i> <span><strong><span class='highlight'>Indicateurs Clés (KPI)</span> :</strong> Une série de cartes vous donne des informations importantes en un coup d'œil, comme le nombre total de comptages, les ventes totales et les ventes moyennes.</span></li>
                <li class='list-item-with-icon'><i class='fa-solid fa-chart-line'></i> <span><strong><span class='highlight'>Graphiques interactifs</span> :</strong> Visualisez l'évolution des ventes, la répartition par caisse, et d'autres analyses grâce à des graphiques dynamiques (lignes, barres, secteurs, etc.).</span></li>
                <li class='list-item-with-icon'><i class='fa-solid fa-file-export'></i> <span><strong><span class='highlight'>Exports</span> :</strong> Exportez l'ensemble du tableau de bord au format PDF ou CSV en un clic.</span></li>
             </ul>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-chart-pie"></i></div>
                <h3>Les Statistiques</h3>
            </div>
            <p>Visualisez la répartition des ventes et des indicateurs clés via un tableau de bord complet.</p>
            <div class="help-card-footer">
                <a href="index.php?page=statistiques" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
            </div>
        </div>
    </div>

    <h3 class="help-category-title">Administration & Maintenance</h3>
    <div class="help-grid">
        <div class="help-card"
             data-title="Collaboration en Temps Réel"
             data-icon="fa-solid fa-wifi"
             data-content="<h4>Comment ça marche ?</h4><p>Grâce à une technologie appelée <strong class='highlight'>WebSocket</strong>, l'application maintient une connexion permanente avec le serveur. L'indicateur de connexion en haut à droite vous confirme que cette fonctionnalité est active.</p>
             <p><strong>Exemple concret :</strong> Vous êtes sur la page du calculateur et vous saisissez '5' dans la case des billets de 10€. Si un de vos collègues a la même page ouverte, il verra le chiffre '5' apparaître dans la case correspondante sur son écran, sans avoir besoin de rafraîchir la page. Tous les calculs se mettront à jour simultanément pour tout le monde.</p>
             <p><strong>Mode Consultation :</strong> Si vous chargez un ancien comptage depuis l'historique, vous passez en '<strong><span class='highlight'>Mode Consultation</span></strong>'. Le temps réel est alors désactivé pour éviter d'écraser le comptage en cours.</p>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-wifi"></i></div>
                <h3>Collaboration en Temps Réel</h3>
            </div>
            <p>Travaillez à plusieurs sur le même comptage et voyez les modifications instantanément.</p>
        </div>

        <div class="help-card"
             data-title="Processus de Clôture"
             data-icon="fa-solid fa-lock"
             data-content="<h4><span class='highlight'>Pourquoi la clôture ?</span></h4><p>Le bouton 'Clôture' dans la barre de navigation est un outil de collaboration qui permet de sauvegarder l'état des caisses de manière sécurisée et coordonnée en fin de journée. Il permet de figer les comptages avant un retrait d'argent et une réinitialisation pour le lendemain.</p>
             <h4><span class='highlight'>Étapes du processus</span></h4>
             <ol>
                <li class='list-item-with-icon'><i class='fa-solid fa-lock'></i> <strong>Verrouillage :</strong> La première étape consiste à 'Verrouiller' une caisse depuis la fenêtre de gestion de la clôture. Cela empêche les autres utilisateurs de la modifier. Seul l'utilisateur qui a verrouillé la caisse (ou un administrateur) peut la déverrouiller.</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-check-circle'></i> <strong>Confirmation :</strong> Une fois le comptage d'une caisse terminé et vérifié, l'utilisateur la 'Confirme'. Cette action enregistre un comptage final dans l'historique et marque la caisse comme 'clôturée'. Elle ne peut plus être modifiée (sauf si un administrateur la 'Réouvre').</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-flag-checkered'></i> <strong>Clôture Générale :</strong> Lorsque toutes les caisses ont été confirmées, une fenêtre de 'Clôture Générale' apparaît. Elle affiche une synthèse finale des montants à retirer. Confirmer cette étape réinitialise toutes les caisses pour le lendemain (le fond de caisse est conservé, les autres champs sont remis à zéro).</li>
             </ol>
             <h4><span class='highlight'>Sécurité et Temps Réel</span></h4><p>Le système de WebSockets informe tous les clients en temps réel de l'état des caisses (Libre, Verrouillée, Clôturée), garantissant ainsi que tous les utilisateurs voient la même chose au même moment.</p>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-lock"></i></div>
                <h3>Processus de Clôture</h3>
            </div>
            <p>Découvrez le processus sécurisé et collaboratif pour finaliser les comptages de la journée.</p>
        </div>

        <div class="help-card"
             data-title="Panneau d'Administration"
             data-icon="fa-solid fa-toolbox"
             data-content="<p>Cette section, accessible via un compte sécurisé, est le centre de contrôle de l'application.</p>
             <h4><span class='highlight'>Fonctions principales</span> :</h4>
             <ul>
                <li class='list-item-with-icon'><i class='fa-solid fa-cash-register'></i> <strong>Gestion des Caisses :</strong> Ajoutez, renommez ou supprimez des caisses.</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-credit-card'></i> <strong>Gestion des Terminaux de Paiement :</strong> Ajoutez, renommez et associez des terminaux de paiement à des caisses spécifiques.</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-users-cog'></i> <strong>Gestion des Administrateurs :</strong> Gérez les comptes des autres administrateurs et mettez à jour leur mot de passe.</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-coins'></i> <strong>Configuration des Devises :</strong> Choisissez la devise de l'application (EUR, USD, etc.) et personnalisez les billets et pièces correspondants.</li>
                <li class='list-item-with-icon'><i class='fa-solid fa-database'></i> <strong>Sauvegardes :</strong> Créez et téléchargez des sauvegardes complètes de votre base de données en un clic.</li>
             </ul>"
             >
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-toolbox"></i></div>
                <h3>Panneau d'Administration</h3>
            </div>
            <p>Gérez les paramètres techniques et la sécurité de l'application.</p>
            <div class="help-card-footer">
                <a href="index.php?page=admin" class="btn help-btn-link"><i class="fa-solid fa-arrow-right"></i> Accéder à la page</a>
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

<?php
require 'partials/footer.php';
?>
