/**
 * Module JavaScript pour la logique de clôture de caisse.
 * Ce script est chargé uniquement sur la page du calculateur.
 */
document.addEventListener('DOMContentLoaded', function() {
    const clotureBtn = document.getElementById('cloture-btn');
    const clotureModal = document.getElementById('cloture-modal');
    const cancelClotureBtn = document.getElementById('cancel-cloture-btn');
    const confirmClotureBtn = document.getElementById('confirm-cloture-btn');
    const statusIndicator = document.getElementById('websocket-status-indicator');

    if (!clotureBtn || !clotureModal) {
        // Le bouton de clôture et la modale n'existent pas sur cette page
        // ce qui est normal pour les pages autres que 'calculateur'
        return;
    }

    clotureBtn.addEventListener('click', () => {
        // La modale s'affiche si le bouton existe sur la page
        clotureModal.classList.add('visible');
    });

    cancelClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');
    });

    confirmClotureBtn.addEventListener('click', () => {
        clotureModal.classList.remove('visible');

        if (statusIndicator) {
            statusIndicator.classList.remove('connected', 'disconnected');
            statusIndicator.classList.add('cloture');
            statusIndicator.querySelector('.status-text').textContent = 'Clôture en cours...';
        }

        const caisseForm = document.getElementById('caisse-form');
        if (!caisseForm) {
            alert("Erreur: Le formulaire du calculateur n'a pas été trouvé.");
            return;
        }
        const formData = new FormData(caisseForm);
        
        fetch('index.php?action=cloture', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) throw new Error('Erreur réseau lors de la clôture');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(data.message);
                window.location.reload();
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        })
        .catch(error => {
            console.error("Erreur lors de la clôture:", error);
            alert("Une erreur est survenue lors de la clôture: " + error.message);
            if (statusIndicator) {
                statusIndicator.classList.remove('cloture');
                statusIndicator.classList.add('connected');
                statusIndicator.querySelector('.status-text').textContent = 'Connecté en temps réel';
            }
        });
    });
});
