<?php
// src/AideController.php

class AideController {
    public function index() {
        $page_css = 'aide.css';
        require_once __DIR__ . '/../templates/aide.php';
    }
}
