<?php
// templates/partials/footer.php
?>
    </div> <!-- Fin du .container principal -->

    <footer class="main-footer">
        <p>
            Développé par DEHER Rémi | 
            <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">Licence MIT</a> | 
            <a href="<?= htmlspecialchars(GIT_REPO_URL) ?>" target="_blank" rel="noopener noreferrer">Dépôt GitHub</a>
        </p>
        
        <!-- Section pour la mise à jour -->
        <div id="update-container" class="update-container">
            <span id="version-info">Vérification de la version...</span>
            <button id="update-button" class="update-btn" style="display: none;">Mettre à jour</button>
        </div>
    </footer>

    <!-- Inclusion du script JavaScript principal de l'application. -->
    <script src="js/app.js"></script>
</body>
</html>
