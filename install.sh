#!/bin/bash

# ==============================================================================
# | Installeur pour le Logiciel de Comptage de Caisse                          |
# | Auteur: DEHER Rémi                                                         |
# | Compatible: Debian 12 (Bookworm)                                           |
# ==============================================================================

# --- Variables et Couleurs ---
# Couleurs pour une meilleure lisibilité
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_BLUE='\033[0;34m'

# Emplacement par défaut de l'application
INSTALL_DIR="/var/www/logiciel-comptage-caisse"
REPO_URL="https://github.com/remi-deher/logiciel-comptage-caisse.git"
PHP_VERSION="8.2" # Version de PHP recommandée pour Debian 12

# --- Fonctions d'aide ---
function print_info() {
    echo -e "${C_BLUE}[INFO] $1${C_RESET}"
}

function print_success() {
    echo -e "${C_GREEN}[SUCCÈS] $1${C_RESET}"
}

function print_warning() {
    echo -e "${C_YELLOW}[AVERTISSEMENT] $1${C_RESET}"
}

function print_error() {
    echo -e "${C_RED}[ERREUR] $1${C_RESET}"
}

function check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Ce script doit être exécuté en tant que root. Essayez avec 'sudo ./install.sh'"
        exit 1
    fi
}

# --- Début du script ---
clear
check_root

echo -e "${C_BLUE}=====================================================${C_RESET}"
echo -e "${C_BLUE}|   Installation du Logiciel de Comptage de Caisse  |${C_RESET}"
echo -e "${C_BLUE}=====================================================${C_RESET}"
echo
print_info "Ce script va installer et configurer l'application sur votre serveur Debian 12."
read -p "Appuyez sur Entrée pour continuer ou Ctrl+C pour annuler..."

# --- 1. Installation des dépendances ---
print_info "Mise à jour du système et installation des dépendances de base..."
apt-get update > /dev/null 2>&1
apt-get upgrade -y > /dev/null 2>&1
apt-get install -y git curl unzip > /dev/null 2>&1
print_success "Dépendances de base installées."

# --- 2. Choix du serveur web ---
print_info "Choix du serveur web."
echo "Quel serveur web souhaitez-vous utiliser ?"
echo "  1) Nginx (recommandé)"
echo "  2) Apache2"
read -p "Votre choix [1]: " WEB_SERVER_CHOICE
WEB_SERVER_CHOICE=${WEB_SERVER_CHOICE:-1}

if [ "$WEB_SERVER_CHOICE" -eq 1 ]; then
    WEB_SERVER="nginx"
    print_info "Installation de Nginx et PHP-FPM..."
    apt-get install -y nginx php${PHP_VERSION}-fpm php${PHP_VERSION}-mysql php${PHP_VERSION}-curl > /dev/null 2>&1
else
    WEB_SERVER="apache2"
    print_info "Installation d'Apache2 et PHP..."
    apt-get install -y apache2 libapache2-mod-php${PHP_VERSION} php${PHP_VERSION}-mysql php${PHP_VERSION}-curl > /dev/null 2>&1
fi
print_success "$WEB_SERVER et PHP ${PHP_VERSION} installés."

# --- 3. Configuration de la base de données ---
print_info "Configuration de la base de données MariaDB."
read -p "La base de données est-elle sur ce serveur (local) ? [O/n]: " IS_DB_LOCAL
IS_DB_LOCAL=${IS_DB_LOCAL:-O}

if [[ "$IS_DB_LOCAL" =~ ^[Oo]$ ]]; then
    DB_HOST="127.0.0.1"
    print_info "Installation du serveur MariaDB..."
    apt-get install -y mariadb-server > /dev/null 2>&1
    print_success "Serveur MariaDB installé."
    
    print_warning "L'installation sécurisée de MariaDB va être lancée."
    echo "Il est fortement recommandé de définir un mot de passe root et de suivre les étapes."
    mysql_secure_installation

    print_info "Création de la base de données et de l'utilisateur."
    read -p "Nom de la base de données [comptabilite_prod]: " DB_NAME
    DB_NAME=${DB_NAME:-comptabilite_prod}
    read -p "Nom de l'utilisateur de la base de données [caisse_user]: " DB_USER
    DB_USER=${DB_USER:-caisse_user}
    echo "Veuillez entrer le mot de passe pour l'utilisateur '$DB_USER'."
    read -s DB_PASS
    
    # Création de la BDD et de l'utilisateur
    mysql -u root -p -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u root -p -e "CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
    mysql -u root -p -e "GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';"
    mysql -u root -p -e "FLUSH PRIVILEGES;"
    print_success "Base de données '$DB_NAME' et utilisateur '$DB_USER' créés."
else
    print_info "Installation du client MariaDB..."
    apt-get install -y mariadb-client > /dev/null 2>&1
    print_success "Client MariaDB installé."

    print_info "Veuillez fournir les informations de connexion à votre base de données distante."
    read -p "Adresse IP ou nom d'hôte du serveur de BDD: " DB_HOST
    read -p "Nom de la base de données: " DB_NAME
    read -p "Nom de l'utilisateur de la base de données: " DB_USER
    echo "Veuillez entrer le mot de passe pour l'utilisateur '$DB_USER'."
    read -s DB_PASS
fi

# --- 4. Installation de l'application ---
print_info "Installation de l'application depuis GitHub..."
mkdir -p $INSTALL_DIR
git clone $REPO_URL $INSTALL_DIR > /dev/null 2>&1
print_success "Application clonée dans $INSTALL_DIR."

# --- 5. Installation de Composer et des dépendances PHP ---
print_info "Installation de Composer..."
curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php
php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer > /dev/null 2>&1
rm /tmp/composer-setup.php
print_success "Composer installé."

print_info "Installation des dépendances PHP..."
cd $INSTALL_DIR
composer install --no-dev --optimize-autoloader > /dev/null 2>&1
print_success "Dépendances PHP installées."

# --- 6. Configuration de l'application ---
print_info "Configuration du fichier config.php..."
cp $INSTALL_DIR/config/config-example.php $INSTALL_DIR/config/config.php

# Remplacement des variables dans le fichier de configuration
sed -i "s/define('DB_HOST', '.*');/define('DB_HOST', '$DB_HOST');/" $INSTALL_DIR/config/config.php
sed -i "s/define('DB_NAME', '.*');/define('DB_NAME', '$DB_NAME');/" $INSTALL_DIR/config/config.php
sed -i "s/define('DB_USER', '.*');/define('DB_USER', '$DB_USER');/" $INSTALL_DIR/config/config.php
sed -i "s/define('DB_PASS', '.*');/define('DB_PASS', '$DB_PASS');/" $INSTALL_DIR/config/config.php
print_success "Fichier de configuration créé."

# --- 7. Import du schéma SQL et création de l'admin ---
print_info "Importation du schéma de la base de données..."
if [[ "$IS_DB_LOCAL" =~ ^[Oo]$ ]]; then
    mysql -u $DB_USER -p$DB_PASS $DB_NAME < $INSTALL_DIR/config/schema.sql
else
    mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < $INSTALL_DIR/config/schema.sql
fi
print_success "Schéma importé."

print_info "Création du premier administrateur..."
php $INSTALL_DIR/config/console.php admin:create
print_success "Administrateur créé."

# --- 8. Configuration du serveur web (VHost) ---
print_info "Configuration du VHost pour $WEB_SERVER..."
if [ "$WEB_SERVER" == "nginx" ]; then
    VHOST_FILE="/etc/nginx/sites-available/comptage-caisse"
    cat > $VHOST_FILE <<EOF
server {
    listen 80;
    server_name _;
    root $INSTALL_DIR/public;
    index index.php;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF
    ln -s $VHOST_FILE /etc/nginx/sites-enabled/
    rm /etc/nginx/sites-enabled/default
    systemctl restart nginx
else # Apache2
    VHOST_FILE="/etc/apache2/sites-available/comptage-caisse.conf"
    cat > $VHOST_FILE <<EOF
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot $INSTALL_DIR/public

    <Directory $INSTALL_DIR/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/error.log
    CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF
    a2enmod rewrite > /dev/null 2>&1
    a2ensite comptage-caisse > /dev/null 2>&1
    a2dissite 000-default.conf > /dev/null 2>&1
    systemctl restart apache2
fi
print_success "VHost configuré et activé."

# --- 9. Configuration du service WebSocket ---
print_info "Configuration du service WebSocket..."
SERVICE_FILE="/etc/systemd/system/websocket-caisse.service"
cat > $SERVICE_FILE <<EOF
[Unit]
Description=Serveur WebSocket pour l'application de comptage de caisse
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
ExecStart=/usr/bin/php $INSTALL_DIR/websocket_server.php
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now websocket-caisse.service > /dev/null 2>&1
print_success "Service WebSocket configuré et démarré."

# --- 10. Permissions finales ---
print_info "Configuration des permissions finales..."
chown -R www-data:www-data $INSTALL_DIR
chmod -R 755 $INSTALL_DIR
# Assurer les droits d'écriture pour les dossiers critiques
chmod -R 775 $INSTALL_DIR/config
chmod -R 775 $INSTALL_DIR/backups
print_success "Permissions configurées."

# --- Fin ---
echo
echo -e "${C_GREEN}=====================================================${C_RESET}"
echo -e "${C_GREEN}|                Installation terminée !            |${C_RESET}"
echo -e "${C_GREEN}=====================================================${C_RESET}"
echo
print_info "Vous pouvez maintenant accéder à l'application via l'adresse IP de ce serveur."
print_warning "N'oubliez pas d'ouvrir les ports nécessaires sur votre pare-feu (ex: 80 pour HTTP)."
echo
