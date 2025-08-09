<?php
// templates/aide.php

$page_css = ''; // Pas de CSS spécifique pour cette page
require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <h2>Page d'Aide - Comment utiliser l'application</h2>

    <p style="font-size: 1.1em;">Bienvenue sur l'application de comptage de caisse ! Cet outil est conçu pour vous aider à compter votre caisse rapidement, facilement, et même à plusieurs en même temps.</p>

    <h3>1. Le Calculateur : La page principale</h3>
    <p>C'est ici que vous passez le plus de temps. Voici comment l'utiliser :</p>
    <ul>
        <li><strong>Changer de caisse :</strong> Cliquez sur les onglets en haut (ex: "Caisse centre ville") pour passer d'une caisse à l'autre.</li>
        <li><strong>Saisir les valeurs :</strong> Remplissez simplement les cases avec le nombre de billets et de pièces que vous avez comptés. Les totaux se mettent à jour automatiquement en bas de la page.</li>
    </ul>

    <h4>L'indicateur intelligent en haut de la page</h4>
    <p>Juste sous les onglets, un cadre de couleur vous guide en deux étapes :</p>
    <ol>
        <li><strong>Vérification du Fond de Caisse :</strong> Tant que vous n'avez pas entré de ventes, cet indicateur vous aide à vérifier que votre fond de caisse est juste. Il vous montre la différence entre l'argent compté et le fond de caisse attendu.</li>
        <li><strong>Calcul de l'Écart Final :</strong> Dès que vous renseignez les ventes, l'indicateur change et vous montre l'écart réel de la journée.
            <ul>
                <li><strong style="color: #27ae60;">Vert :</strong> Parfait ! La caisse est bonne. Le message vous indiquera le montant à retirer pour la clôture.</li>
                <li><strong style="color: #f39c12;">Orange :</strong> Attention, il y a un surplus d'argent.</li>
                <li><strong style="color: #c0392b;">Rouge :</strong> Attention, il manque de l'argent.</li>
            </ul>
        </li>
    </ol>
    
    <h3>2. L'Historique : Retrouver et exporter vos comptages</h3>
    <p>La page "Historique" vous permet de consulter tous les comptages que vous avez enregistrés. Vous pouvez les filtrer par date ou rechercher un nom spécifique.</p>
    <ul>
        <li><strong>Exporter et Imprimer :</strong> Grâce aux boutons en haut de la page, vous pouvez facilement imprimer votre historique ou le télécharger en format PDF ou Excel (CSV) pour votre comptabilité.</li>
    </ul>

    <h3>3. La Magie du Temps Réel : Travailler à plusieurs</h3>
    <p>Vous avez peut-être remarqué l'indicateur "Connecté en temps réel" en haut à droite. Qu'est-ce que cela signifie ?</p>
    <p>Imaginez que vous êtes au téléphone avec un collègue et que vous lisez tous les deux le même document. Si votre collègue écrit quelque chose, vous le voyez instantanément. C'est exactement ce que fait notre application !</p>
    <ul>
        <li>Grâce à une technologie appelée "WebSocket", si vous entrez le nombre de billets de 10€, votre collègue qui a la même page ouverte verra la case se mettre à jour sur son écran en une fraction de seconde.</li>
        <li>Cela vous permet de compter la même caisse à deux, ou de surveiller l'avancement du comptage d'une autre caisse en direct.</li>
    </ul>

    <h3>4. La Sauvegarde Automatique et les Mises à Jour</h3>
    <ul>
        <li><strong>Sauvegarde :</strong> Si vous avez commencé à saisir des valeurs et que vous quittez la page, l'application enregistre automatiquement votre travail. Vous retrouverez ce comptage dans l'historique avec le nom "Sauvegarde auto du...".</li>
        <li><strong>Mises à jour :</strong> Dans le pied de page, vous pouvez voir la version actuelle de l'application. Si une nouvelle version est disponible, un message apparaîtra avec un bouton pour lancer la mise à jour facilement.</li>
    </ul>
    
    <h3>5. Le Panneau d'Administration</h3>
    <p>L'application dispose d'une section "Administration" accessible via le lien "Connexion". Cette page est réservée aux responsables techniques et permet de :</p>
    <ul>
        <li>Configurer la connexion à la base de données.</li>
        <li>Créer et télécharger des sauvegardes de sécurité.</li>
        <li>Gérer les comptes des administrateurs.</li>
    </ul>

    <p>Nous espérons que cet outil vous sera utile !</p>

</div>

<?php
require 'partials/footer.php';
?>
