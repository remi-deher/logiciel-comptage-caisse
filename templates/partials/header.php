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
</head>
<body class="<?= htmlspecialchars($body_class) ?>">
