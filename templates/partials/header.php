<?php
// Fichier : templates/partials/header.php
// CORRIGÉ : Ce fichier ne contient plus de require_once vers d'autres partials.
// Il ne fait qu'ouvrir la structure de la page.

$body_class = $body_class ?? '';
$page_css = $page_css ?? '';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculateur de Caisse</title>
    <link href="css/styles.css" rel="stylesheet">
    <link href="css/navbar.css" rel="stylesheet">
    <?php if ($page_css): ?>
        <link href="css/<?= htmlspecialchars($page_css) ?>" rel="stylesheet">
    <?php endif; ?>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
</head>
<body class="<?= htmlspecialchars($body_class) ?>">
<?php
