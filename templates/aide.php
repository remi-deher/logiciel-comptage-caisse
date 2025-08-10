<?php
// templates/aide.php

$page_css = 'aide.css'; // On lie la feuille de style
require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <div class="help-header">
        <h2><i class="fa-solid fa-circle-question" style="color: #3498db;"></i> Guide d'Utilisation</h2>
        <p style="font-size: 1.1em;">Cliquez sur une section pour obtenir des explications détaillées.</p>
    </div>

    <div class="help-grid">
        <!-- Carte Calculateur -->
        <div class="help-card" 
             data-title="Le Calculateur" 
             data-icon="fa-solid fa-calculator"
             data-content="<h4>Comprendre l'interface</h4><p>La page du calculateur est divisée en trois zones principales :</p><ol><li><strong>Les onglets de caisse :</strong> En haut, vous pouvez basculer entre les différentes caisses que vous gérez.</li><li><strong>La saisie :</strong> C'est ici que vous entrez toutes les informations. Remplissez les champs 'Fond de Caisse', 'Ventes', et 'Rétrocessions', puis détaillez le nombre de billets et de pièces comptés.</li><li><strong>Les résultats :</strong> En bas de la page, les totaux se calculent et s'affichent en temps réel, vous montrant les écarts pour chaque caisse et pour le total combiné.</li></ol><h4>L'indicateur d'écart intelligent</h4><p>Cet encadré en haut de la page est votre meilleur allié. Il change de couleur et de message pour vous guider :</p><ul><li><strong style='color: #27ae60;'>Vert :</strong> Félicitations ! L'écart est nul, votre caisse est juste.</li><li><strong style='color: #f39c12;'>Orange :</strong> Il y a un surplus d'argent. Vérifiez vos saisies et les rendus de monnaie de la journée.</li><li><strong style='color: #c0392b;'>Rouge :</strong> Il manque de l'argent. Il est conseillé de recompter la caisse.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-calculator"></i></div>
                <h3>Le Calculateur</h3>
            </div>
            <p>La page principale pour saisir vos comptages et voir les résultats en direct.</p>
        </div>

        <!-- Carte Historique -->
        <div class="help-card"
             data-title="L'Historique"
             data-icon="fa-solid fa-history"
             data-content="<h4>Explorer vos comptages</h4><p>La page d'historique vous donne accès à tous vos enregistrements passés sous forme de cartes claires et lisibles.</p><ul><li><strong>Filtrage puissant :</strong> Utilisez les champs en haut pour rechercher un comptage par nom ou pour filtrer par une période spécifique (date de début et de fin).</li><li><strong>Détails à la demande :</strong> Sur chaque carte, cliquez sur le nom d'une caisse pour ouvrir une fenêtre avec le décompte détaillé (billets et pièces) de cette caisse. Cliquez sur 'Ensemble' pour voir les détails de toutes les caisses et une synthèse globale.</li><li><strong>Exports faciles :</strong> Dans la fenêtre de détails, vous pouvez exporter la vue actuelle en PDF ou en fichier Excel (CSV) pour vos archives ou votre comptabilité.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-history"></i></div>
                <h3>L'Historique</h3>
            </div>
            <p>Consultez, filtrez et exportez tous vos comptages enregistrés.</p>
        </div>

        <!-- Carte Temps Réel -->
        <div class="help-card"
             data-title="Collaboration en Temps Réel"
             data-icon="fa-solid fa-wifi"
             data-content="<h4>Comment ça marche ?</h4><p>Grâce à une technologie appelée WebSocket, l'application maintient une connexion permanente avec le serveur. L'indicateur 'Connecté en temps réel' en haut à droite vous confirme que cette connexion est active.</p><p><strong>Exemple concret :</strong> Vous êtes sur la page du calculateur et vous saisissez '5' dans la case des billets de 10€. Si un de vos collègues a la même page ouverte, il verra le chiffre '5' apparaître dans la case correspondante sur son écran, sans avoir besoin de rafraîchir la page. Tous les calculs se mettront à jour simultanément pour tout le monde.</p><p>C'est la fonctionnalité parfaite pour effectuer un comptage à quatre mains ou pour qu'un manager puisse superviser l'avancement d'un comptage depuis son bureau.</p>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-wifi"></i></div>
                <h3>Collaboration en Temps Réel</h3>
            </div>
            <p>Travaillez à plusieurs sur le même comptage et voyez les modifications instantanément.</p>
        </div>

        <!-- Carte Fonctionnalités Avancées -->
        <div class="help-card"
             data-title="Fonctionnalités Avancées"
             data-icon="fa-solid fa-star"
             data-content="<h4>Ne perdez jamais votre travail</h4><ul><li><strong>Sauvegarde Automatique :</strong> Lorsque vous êtes sur la page du calculateur, l'application détecte si vous avez fait des modifications. Si vous arrêtez de taper pendant plus de 2.5 secondes, une sauvegarde est automatiquement effectuée. Un message discret apparaît sous le bouton 'Enregistrer' pour vous en informer. De plus, si vous fermez accidentellement la page, une dernière sauvegarde est tentée. Si vous revenez plus tard, cette dernière sauvegarde sera chargée par défaut.</li><li><strong>Mises à jour intelligentes :</strong> Le pied de page vérifie régulièrement si une nouvelle version de l'application est disponible sur GitHub. Si c'est le cas, un message apparaît et vous pouvez lancer la mise à jour en un seul clic. Vous pouvez aussi forcer cette vérification à tout moment avec le bouton de rafraîchissement <i class='fa-solid fa-arrows-rotate'></i>.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-star"></i></div>
                <h3>Fonctionnalités Avancées</h3>
            </div>
            <p>Découvrez la sauvegarde automatique et le système de mise à jour intégré.</p>
        </div>

        <!-- Carte Changelog -->
        <div class="help-card"
             data-title="Journal des Modifications"
             data-icon="fa-solid fa-rocket"
             data-content="<p>La page 'Changelog' est directement connectée au dépôt GitHub du projet. Elle récupère et affiche la liste de toutes les versions officielles de l'application.</p><p>Pour chaque version, vous verrez les notes de version telles qu'elles ont été rédigées par le développeur, y compris les listes de nouveautés, les corrections de bugs, et même les captures d'écran si elles ont été incluses. C'est le meilleur moyen de rester informé des évolutions de l'outil que vous utilisez.</p>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-rocket"></i></div>
                <h3>Journal des Modifications</h3>
            </div>
            <p>Suivez l'évolution de l'application et les dernières nouveautés.</p>
        </div>

        <!-- Carte Administration -->
        <div class="help-card"
             data-title="Panneau d'Administration"
             data-icon="fa-solid fa-toolbox"
             data-content="<p>Cette section, accessible via un compte sécurisé, est le centre de contrôle technique de l'application. Elle est réservée aux utilisateurs ayant les droits d'administration.</p><h4>Fonctions principales :</h4><ul><li><strong>Gestion des Caisses :</strong> Vous pouvez ajouter de nouvelles caisses, renommer celles qui existent, ou en supprimer. La suppression d'une caisse entraîne la suppression de toutes les données associées.</li><li><strong>Configuration :</strong> Modifiez les paramètres de connexion à la base de données et choisissez le fuseau horaire de l'application pour que toutes les dates soient correctes.</li><li><strong>Sécurité :</strong> Gérez les comptes des autres administrateurs et créez des sauvegardes complètes de votre base de données en un clic.</li></ul>">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-toolbox"></i></div>
                <h3>Panneau d'Administration</h3>
            </div>
            <p>Gérez les paramètres techniques et la sécurité de l'application.</p>
        </div>
    </div>
</div>

<!-- Fenêtre Modale pour les détails de l'aide -->
<div id="help-modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <div id="help-modal-content">
            <!-- Le contenu des détails sera injecté ici par JavaScript -->
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
