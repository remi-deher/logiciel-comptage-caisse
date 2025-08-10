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
             data-content="<p>C'est la page principale pour vos comptages. Saisissez simplement le nombre de billets et de pièces, et les totaux se mettent à jour en temps réel dans la section 'Résultats' en bas de page.</p><p><strong>L'indicateur d'écart</strong> en haut vous guide :</p><ul><li><strong style='color: #27ae60;'>Vert :</strong> Parfait ! La caisse est bonne.</li><li><strong style='color: #f39c12;'>Orange :</strong> Attention, il y a un surplus d'argent.</li><li><strong style='color: #c0392b;'>Rouge :</strong> Attention, il manque de l'argent.</li></ul>">
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
             data-content="<p>Retrouvez tous vos comptages passés. Chaque comptage est présenté sous forme de carte pour une lecture facile.</p><ul><li><strong>Filtrez</strong> vos recherches par date ou par nom.</li><li>Cliquez sur les boutons pour voir les <strong>détails par caisse</strong> ou la <strong>synthèse globale</strong> dans une fenêtre.</li><li><strong>Exportez</strong> la vue d'ensemble ou les détails en PDF et Excel (CSV) directement depuis la fenêtre de détails.</li></ul>">
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
             data-content="<p>L'indicateur 'Connecté' signifie que vous pouvez travailler à plusieurs. Si un collègue modifie une valeur sur la page du calculateur, vous la verrez se mettre à jour instantanément sur votre écran.</p><p>C'est idéal pour compter une caisse à deux ou pour superviser un comptage à distance sans avoir à recharger la page.</p>">
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
             data-content="<p>L'application inclut des outils pour vous simplifier la vie :</p><ul><li><strong>Sauvegarde Automatique :</strong> Si vous modifiez un comptage, il est sauvegardé automatiquement après quelques secondes d'inactivité. Un message vous l'indique sous le bouton 'Enregistrer'.</li><li><strong>Mises à jour :</strong> Le pied de page vous informe si une nouvelle version est disponible. Vous pouvez mettre à jour l'application en un clic.</li></ul>">
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
             data-content="<p>La page 'Changelog' vous présente, sous forme de frise chronologique, toutes les nouvelles fonctionnalités et corrections apportées à chaque mise à jour, avec les images et les détails directement depuis GitHub.</p><p>Vous pouvez forcer la mise à jour de ces informations avec le bouton de rafraîchissement dans le pied de page.</p>">
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
             data-content="<p>La section 'Administration' est réservée aux responsables techniques. Elle permet de :</p><ul><li>Gérer les caisses (ajouter, renommer, supprimer).</li><li>Configurer la base de données et le fuseau horaire.</li><li>Gérer les comptes administrateurs.</li><li>Créer des sauvegardes de sécurité.</li></ul>">
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
