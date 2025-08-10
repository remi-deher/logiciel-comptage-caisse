<?php
// templates/aide.php

$page_css = 'aide.css'; // On lie la nouvelle feuille de style
require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <div class="help-header">
        <h2><i class="fa-solid fa-circle-question" style="color: #3498db;"></i> Guide d'Utilisation</h2>
        <p style="font-size: 1.1em;">Bienvenue sur l'application de comptage de caisse ! Voici comment utiliser ses fonctionnalités clés.</p>
    </div>

    <div class="help-grid">
        <!-- Carte Calculateur -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-calculator"></i></div>
                <h3>Le Calculateur</h3>
            </div>
            <p>C'est la page principale pour vos comptages. Saisissez simplement le nombre de billets et de pièces, et les totaux se mettent à jour en temps réel.</p>
            <p><strong>L'indicateur d'écart</strong> en haut vous guide :</p>
            <ul>
                <li><strong style="color: #27ae60;">Vert :</strong> Parfait ! La caisse est bonne.</li>
                <li><strong style="color: #f39c12;">Orange :</strong> Attention, il y a un surplus d'argent.</li>
                <li><strong style="color: #c0392b;">Rouge :</strong> Attention, il manque de l'argent.</li>
            </ul>
        </div>

        <!-- Carte Historique -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-history"></i></div>
                <h3>L'Historique</h3>
            </div>
            <p>Retrouvez tous vos comptages passés. Chaque comptage est présenté sous forme de carte pour une lecture facile.</p>
            <ul>
                <li><strong>Filtrez</strong> vos recherches par date ou par nom.</li>
                <li>Cliquez sur les boutons pour voir les <strong>détails par caisse</strong> ou la <strong>synthèse globale</strong>.</li>
                <li><strong>Exportez</strong> la vue d'ensemble ou les détails en PDF et Excel (CSV).</li>
            </ul>
        </div>

        <!-- Carte Temps Réel -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-wifi"></i></div>
                <h3>Collaboration en Temps Réel</h3>
            </div>
            <p>L'indicateur "Connecté" signifie que vous pouvez travailler à plusieurs. Si un collègue modifie une valeur sur la page du calculateur, vous la verrez se mettre à jour instantanément sur votre écran.</p>
            <p>C'est idéal pour compter une caisse à deux ou pour superviser un comptage à distance.</p>
        </div>

        <!-- Carte Fonctionnalités Avancées -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-star"></i></div>
                <h3>Fonctionnalités Avancées</h3>
            </div>
            <p>L'application inclut des outils pour vous simplifier la vie :</p>
            <ul>
                <li><strong>Sauvegarde Automatique :</strong> Si vous modifiez un comptage, il est sauvegardé automatiquement après quelques secondes d'inactivité. Un message vous l'indique.</li>
                <li><strong>Mises à jour :</strong> Le pied de page vous informe si une nouvelle version est disponible. Vous pouvez mettre à jour l'application en un clic.</li>
            </ul>
        </div>

        <!-- Carte Changelog -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-rocket"></i></div>
                <h3>Journal des Modifications</h3>
            </div>
            <p>La page "Changelog" vous présente, sous forme de frise chronologique, toutes les nouvelles fonctionnalités et corrections apportées à chaque mise à jour, avec les images et les détails directement depuis GitHub.</p>
        </div>

        <!-- Carte Administration -->
        <div class="help-card">
            <div class="help-card-header">
                <div class="help-card-icon"><i class="fa-solid fa-toolbox"></i></div>
                <h3>Panneau d'Administration</h3>
            </div>
            <p>La section "Administration" est réservée aux responsables techniques. Elle permet de :</p>
            <ul>
                <li>Gérer les caisses (ajouter, renommer, supprimer).</li>
                <li>Configurer la base de données et le fuseau horaire.</li>
                <li>Gérer les comptes administrateurs.</li>
                <li>Créer des sauvegardes de sécurité.</li>
            </ul>
        </div>
    </div>
</div>

<?php
require 'partials/footer.php';
?>
