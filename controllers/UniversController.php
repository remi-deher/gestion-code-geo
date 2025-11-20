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
            $this->universManager->addUnivers(
                trim($_POST['nom']), 
                $_POST['zone_assignee'],
                $_POST['color']
            );
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }
    
    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->universManager->updateUnivers(
                (int)$_POST['id'],
                trim($_POST['nom']),
                $_POST['zone_assignee'],
                $_POST['color']
            );
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }


    public function deleteAction() {
        // SÉCURITÉ POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Action interdite.'];
             header('Location: index.php?action=listUnivers');
             exit();
        }

        $id = (int)($_POST['id'] ?? 0);
        $this->universManager->deleteUnivers($id);
        header('Location: index.php?action=listUnivers');
        exit();
    }

    // Cette méthode est maintenant gérée par la nouvelle vue
    public function updateZoneAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['zone'])) {
            $univers = $this->universManager->getUniversById((int)$input['id']);
            if ($univers) {
                $success = $this->universManager->updateUnivers(
                    (int)$input['id'], 
                    $univers['nom'], 
                    $input['zone'], 
                    $univers['color']
                );
                echo json_encode(['status' => $success ? 'success' : 'error']);
            } else {
                 echo json_encode(['status' => 'error', 'message' => 'Univers non trouvé']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Données invalides']);
        }
        exit();
    }
}
