<?php
// Fichier: controllers/UniversController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/UniversManager.php';

class UniversController extends BaseController {

    private $universManager;

    public function __construct(PDO $db) {
        $this->universManager = new UniversManager($db);
    }

    public function listAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('univers_list_view', ['universList' => $universList]);
    }

    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->universManager->addUnivers(trim($_POST['nom']), $_POST['zone_assignee']);
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }

    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        $this->universManager->deleteUnivers($id);
        header('Location: index.php?action=listUnivers');
        exit();
    }

    public function updateZoneAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['zone'])) {
            $success = $this->universManager->updateUniversZone((int)$input['id'], $input['zone']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Données invalides']);
        }
        exit();
    }
}
