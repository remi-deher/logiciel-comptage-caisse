<?php
// templates/aide.php

require 'partials/header.php';
require 'partials/navbar.php';
?>

<div class="container">
    <h2>Page d'Aide - Comment utiliser l'application</h2>

    <p style="font-size: 1.1em;">Bienvenue sur l'application de comptage de caisse ! Cet outil est conçu pour vous aider à compter votre caisse rapidement, facilement, et même à plusieurs en même temps.</p>

    <h3>1. Le Calculateur : Compter votre caisse</h3>
    <p>C'est la page principale de l'application. Voici comment l'utiliser :</p>
    <ul>
        <li><strong>Changer de caisse :</strong> Cliquez sur les onglets en haut (ex: "Caisse centre ville") pour passer d'une caisse à l'autre.</li>
        <li><strong>Saisir les valeurs :</strong> Remplissez simplement les cases avec le nombre de billets et de pièces que vous avez comptés. Les totaux se mettent à jour automatiquement en bas de la page.</li>
        <li><strong>L'indicateur d'écart :</strong> Juste sous les onglets, un cadre de couleur vous indique l'état de votre caisse en temps réel.
            <ul>
                <li><strong style="color: #27ae60;">Vert :</strong> Parfait ! La caisse est bonne.</li>
                <li><strong style="color: #f39c12;">Orange :</strong> Attention, il y a un surplus d'argent.</li>
                <li><strong style="color: #c0392b;">Rouge :</strong> Attention, il manque de l'argent.</li>
            </ul>
        </li>
        <li><strong>Enregistrer :</strong> Une fois votre comptage terminé, donnez-lui un nom (ex: "Comptage du soir - 08/08") et cliquez sur le bouton vert "Enregistrer le Comptage".</li>
    </ul>

    <h3>2. L'Historique : Retrouver vos anciens comptages</h3>
    <p>La page "Historique" vous permet de consulter tous les comptages que vous avez enregistrés. Vous pouvez les filtrer par date ou rechercher un nom spécifique pour retrouver facilement une information.</p>

    <h3>3. La Magie du Temps Réel : Travailler à plusieurs</h3>
    <p>Vous avez peut-être remarqué l'indicateur "Connecté en temps réel" en haut de la page. Qu'est-ce que cela signifie ?</p>
    <p>Imaginez que vous êtes au téléphone avec un collègue et que vous lisez tous les deux le même document. Si votre collègue écrit quelque chose, vous le voyez instantanément, sans avoir besoin de raccrocher et de rappeler. C'est exactement ce que fait notre application !</p>
    <ul>
        <li>Grâce à une technologie appelée "WebSocket", la page est connectée en permanence au serveur.</li>
        <li>Si vous entrez le nombre de billets de 10€, votre collègue qui a la même page ouverte verra la case se mettre à jour sur son écran en une fraction de seconde.</li>
        <li>Cela vous permet de compter la même caisse à deux, ou de surveiller l'avancement du comptage d'une autre caisse en direct.</li>
    </ul>

    <h3>4. La Sauvegarde Automatique : Ne perdez jamais votre travail</h3>
    <p>Nous savons qu'une coupure de courant ou une fermeture accidentelle de la page peut arriver. C'est pourquoi l'application est dotée d'une sauvegarde automatique intelligente.</p>
    <ul>
        <li>Si vous avez commencé à saisir des valeurs et que vous quittez la page, l'application enregistre automatiquement votre travail.</li>
        <li>Cette sauvegarde apparaîtra dans l'historique avec le nom "Sauvegarde auto du..." suivi de la date et de l'heure. Vous pouvez ensuite la "Charger" pour reprendre là où vous vous étiez arrêté.</li>
    </ul>
    <p>Nous espérons que cet outil vous sera utile !</p>

</div>

<?php
require 'partials/footer.php';
?>
