<?php
// templates/partials/header.php
$body_class = $body_class ?? '';
$page_css = $page_css ?? ''; // Fichier CSS spécifique à la page
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calculateur de Caisse</title>
    <!-- Fichiers CSS communs -->
    <link href="css/styles.css" rel="stylesheet">
    <link href="css/navbar.css" rel="stylesheet">
    <!-- Fichier CSS spécifique à la page -->
    <?php if ($page_css): ?>
        <link href="css/<?= htmlspecialchars($page_css) ?>" rel="stylesheet">
    <?php endif; ?>
    <!-- NOUVELLES BIBLIOTHÈQUES POUR L'EXPORT PDF ET LES ICÔNES -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body class="<?= htmlspecialchars($body_class) ?>">
