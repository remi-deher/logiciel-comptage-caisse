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

    <div class="help-grid">
        <div class="help-card"
             data-title="Le Calculateur"
             data-icon="fa-solid fa-calculator"
             data-content="<h4>Une interface intuitive</h4><p>La page du calculateur est organisée en sections déroulantes (accordéons) pour une meilleure clarté :</p><ol><li><strong>Informations Caisse :</strong> Saisissez ici le fond de caisse, le total des ventes de la journée et les éventuelles rétrocessions (prélèvements).</li><li><strong>Détail des Espèces :</strong> Renseignez le nombre de billets et de pièces comptés. Le total se calcule automatiquement.</li></ol><h4>Indicateur d'écart en temps réel</h4><p>Situé en haut de la page, cet encadré est votre guide. Il change de couleur et de message pour vous informer de l'état de la caisse active :</p><ul><li><strong style='color: #27ae60;'>Vert :</strong> Félicitations ! L'écart est nul, votre caisse est juste. Un accordéon <strong>Suggestion de retrait</strong> apparaîtra pour vous indiquer la composition exacte de l'argent à retirer pour clôturer la caisse.</li><li><strong style='color: #f39c12;'>Orange :</strong> Il y a un surplus d'argent. Vérifiez vos saisies.</li><li><strong style='color: #c0392b;'>Rouge :</strong> Il manque de l'argent. Un recomptage est conseillé.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-calculator"></i></div>
                <h3>Le Calculateur</h3>
            </div>
            <p>La page principale pour saisir vos comptages et voir les résultats en direct.</p>
        </div>

        <div class="help-card"
             data-title="L'Historique"
             data-icon="fa-solid fa-history"
             data-content="<h4>Retrouvez et analysez vos comptages</h4><p>La page d'historique affiche par défaut les comptages du jour pour un accès rapide. Vous pouvez basculer sur la vue 'Tous les comptages' grâce aux onglets.</p><ul><li><strong>Filtrage puissant :</strong> Utilisez les champs en haut pour rechercher un comptage par nom ou pour filtrer par une période spécifique. Des boutons de filtre rapide sont également disponibles pour 'Aujourd'hui', 'Hier', '7 derniers jours', et '30 derniers jours'.</li><li><strong>Nouveau : Graphiques par carte :</strong> Pour chaque comptage, un graphique en barres est désormais affiché pour visualiser rapidement la répartition des ventes entre vos différentes caisses.</li><li><strong>Pagination :</strong> Naviguez facilement entre les pages de résultats grâce aux contrôles en haut et en bas de la liste.</li><li><strong>Détails et Exports :</strong> Sur chaque carte, cliquez sur le nom d'une caisse pour voir son décompte détaillé. Cliquez sur 'Ensemble' pour une vue complète avec une synthèse globale. Depuis cette fenêtre, vous pouvez exporter les détails en PDF ou Excel.</li></ul><h4>Mode Consultation</h4><p>En cliquant sur un comptage depuis l'historique, vous passez en <strong>Mode Consultation</strong>. Dans ce mode, toutes les modifications en temps réel et la sauvegarde automatique sont désactivées pour vous permettre de consulter les données sans risque de les modifier. Un bandeau spécial vous l'indique en haut de la page.</p>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-history"></i></div>
                <h3>L'Historique</h3>
            </div>
            <p>Consultez, filtrez et exportez tous vos comptages enregistrés.</p>
        </div>
        
        <div class="help-card"
             data-title="Les Statistiques"
             data-icon="fa-solid fa-chart-pie"
             data-content="<h4>Analysez vos données</h4><p>La page de statistiques vous offre un tableau de bord complet pour analyser vos données de comptage. Elle se divise en plusieurs sections :</p><ul><li><strong>Filtres :</strong> Vous pouvez filtrer les données par période grâce à des boutons de raccourci ('Aujourd'hui', '7 derniers jours', etc.) ou en choisissant une période personnalisée.</li><li><strong>Indicateurs Clés (KPI) :</strong> Une série de cartes vous donne des informations importantes en un coup d'œil, comme le nombre total de comptages, les ventes totales et les ventes moyennes. En cliquant sur ces cartes, vous obtenez un détail par caisse dans une fenêtre modale.</li><li><strong>Graphiques :</strong> Un graphique en secteurs vous montre la répartition des ventes entre vos différentes caisses, vous aidant à visualiser les performances de chacune.</li><li><strong>Exports :</strong> Exportez l'ensemble du tableau de bord au format PDF ou CSV en un clic.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-chart-pie"></i></div>
                <h3>Les Statistiques</h3>
            </div>
            <p>Visualisez la répartition des ventes et des indicateurs clés via un tableau de bord complet.</p>
        </div>

        <div class="help-card"
             data-title="Collaboration en Temps Réel"
             data-icon="fa-solid fa-wifi"
             data-content="<h4>Comment ça marche ?</h4><p>Grâce à une technologie appelée WebSocket, l'application maintient une connexion permanente avec le serveur. L'indicateur 'Connecté en temps réel' en haut à droite vous confirme que cette connexion est active.</p><p><strong>Exemple concret :</strong> Vous êtes sur la page du calculateur et vous saisissez '5' dans la case des billets de 10€. Si un de vos collègues a la même page ouverte, il verra le chiffre '5' apparaître dans la case correspondante sur son écran, sans avoir besoin de rafraîchir la page. Tous les calculs se mettront à jour simultanément pour tout le monde.</p><p><strong>Mode Consultation :</strong> Si vous chargez un ancien comptage depuis l'historique, vous passez en 'Mode Consultation'. Le temps réel est alors désactivé pour éviter d'écraser le comptage en cours.</p>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-wifi"></i></div>
                <h3>Collaboration en Temps Réel</h3>
            </div>
            <p>Travaillez à plusieurs sur le même comptage et voyez les modifications instantanément.</p>
        </div>

        <div class="help-card"
             data-title="Fonctionnalités Avancées"
             data-icon="fa-solid fa-star"
             data-content="<h4>Ne perdez jamais votre travail</h4><ul><li><strong>Sauvegarde de Sécurité :</strong> Si vous avez des modifications non enregistrées et que vous fermez accidentellement la page, l'application effectue une dernière sauvegarde. Lorsque vous reviendrez sur le calculateur, cette sauvegarde sera chargée automatiquement.</li><li><strong>Nommage Automatique :</strong> Si vous laissez le champ 'Nom du comptage' vide et que vous cliquez sur 'Enregistrer', l'application lui donnera automatiquement un nom basé sur la date et l'heure actuelles.</li><li><strong>Mises à jour intelligentes :</strong> Le pied de page vous informe si une nouvelle version est disponible. En cliquant sur 'Mettre à jour', vous accédez à une page dédiée qui vous montre les notes de version et les modifications de base de données avant de lancer le processus.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-star"></i></div>
                <h3>Fonctionnalités Avancées</h3>
            </div>
            <p>Découvrez la sauvegarde de sécurité et le système de mise à jour intelligent.</p>
        </div>

        <div class="help-card"
             data-title="Journal des Modifications"
             data-icon="fa-solid fa-rocket"
             data-content="<p>La page 'Changelog' est directement connectée au dépôt GitHub du projet. Elle récupère et affiche la liste de toutes les versions officielles de l'application dans une interface claire et moderne.</p><p>Pour chaque version, vous verrez les notes de version telles qu'elles ont été rédigées par le développeur, y compris les listes de nouveautés, les corrections de bugs, et même les captures d'écran si elles ont été incluses. C'est le meilleur moyen de rester informé des évolutions de l'outil que vous utilisez.</p>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-rocket"></i></div>
                <h3>Journal des Modifications</h3>
            </div>
            <p>Suivez l'évolution de l'application et les dernières nouveautés.</p>
        </div>

        <div class="help-card"
             data-title="Panneau d'Administration"
             data-icon="fa-solid fa-toolbox"
             data-content="<p>Cette section, accessible via un compte sécurisé, est le centre de contrôle technique de l'application. Elle est réservée aux utilisateurs ayant les droits d'administration.</p><h4>Fonctions principales :</h4><ul><li><strong>Gestion des Caisses :</strong> Vous pouvez ajouter de nouvelles caisses, renommer celles qui existent, ou en supprimer. L'ajout et la suppression de caisses entraînent des modifications directes sur la structure de la base de données (ajout ou suppression de colonnes).</li><li><strong>Configuration :</strong> Modifiez les paramètres de connexion à la base de données et choisissez le fuseau horaire de l'application pour que toutes les dates soient correctes.</li><li><strong>Sécurité :</strong> Gérez les comptes des autres administrateurs, mettez à jour leur mot de passe et créez des sauvegardes complètes de votre base de données en un clic.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-toolbox"></i></div>
                <h3>Panneau d'Administration</h3>
            </div>
            <p>Gérez les paramètres techniques et la sécurité de l'application.</p>
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
