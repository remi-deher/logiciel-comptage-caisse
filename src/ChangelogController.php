<?php
// src/ChangelogController.php

require_once __DIR__ . '/services/VersionService.php';

class ChangelogController {
    private $versionService;
    
    public function __construct() {
        $this->versionService = new VersionService();
    }
    
    public function index() {
        $releases = $this->versionService->getAllReleases();
        $page_css = 'changelog.css';
        require __DIR__ . '/../templates/changelog.php';
    }
}
