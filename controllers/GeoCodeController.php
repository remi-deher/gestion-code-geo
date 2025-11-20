<?php
// Fichier : controllers/GeoCodeController.php

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';

class GeoCodeController extends BaseController {

    private $geoCodeManager;
    private $universManager;

    public function __construct(PDO $db) {
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
    }

    public function listAction() {
        $geoCodes = $this->geoCodeManager->getAllGeoCodes();
        $univers = $this->universManager->getAllUnivers();
        $this->render('geo_codes_list_view', [
            'geoCodes' => $geoCodes,
            'univers' => $univers
        ]);
    }

    public function createAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('geo_codes_create_view', ['universList' => $universList]);
    }

    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $univers_id = (int)$_POST['univers_id'];
            $zone = $_POST['zone'] ?? null;

            if ($univers_id <= 0 || empty($zone) || !in_array($zone, ['vente', 'reserve'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Zone ou Univers non valide sélectionné.'];
                 header('Location: index.php?action=create');
                 exit();
            }

            $univers = $this->universManager->getUniversById($univers_id);
            if (!$univers) {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Univers non trouvé.'];
                header('Location: index.php?action=create');
                exit();
            }

            $result = $this->geoCodeManager->addGeoCode(
                $_POST['code_geo'],
                $_POST['libelle'],
                $univers_id,
                $_POST['commentaire'],
                $zone
            );

            if ($result) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo ajouté avec succès.'];
            } else {
                 $lastError = $this->geoCodeManager->getLastError();
                 $errorMessage = ($lastError && isset($lastError[2]) && str_contains($lastError[2], 'Duplicate entry'))
                                ? 'Le code Géo existe peut-être déjà.'
                                : 'Erreur lors de l\'ajout.';
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => $errorMessage];
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé.'];
            header('Location: index.php?action=list');
            exit();
        }
        $universList = $this->universManager->getAllUnivers();
        $this->render('geo_codes_edit_view', [
            'geoCode' => $geoCode,
            'universList' => $universList
        ]);
    }

    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
             $id = (int)$_POST['id'];
             $univers_id = (int)$_POST['univers_id'];
             $zone = $_POST['zone'] ?? null;

             if ($id <= 0 || $univers_id <= 0 || empty($zone) || !in_array($zone, ['vente', 'reserve'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Données invalides pour la mise à jour.'];
                 header('Location: index.php?action=list');
                 exit();
             }

            $success = $this->geoCodeManager->updateGeoCode(
                $id,
                $_POST['code_geo'],
                $_POST['libelle'],
                $univers_id,
                $_POST['commentaire'],
                $zone
            );
            if ($success) {
                $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo mis à jour avec succès.'];
            } else {
                 $lastError = $this->geoCodeManager->getLastError();
                 $errorMessage = ($lastError && isset($lastError[2]) && str_contains($lastError[2], 'Duplicate entry'))
                                ? 'Le nouveau code Géo existe peut-être déjà.'
                                : 'Erreur lors de la mise à jour.';
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => $errorMessage];
                 header('Location: index.php?action=edit&id=' . $id);
                 exit();
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function deleteAction() {
        // SÉCURITÉ : On refuse si ce n'est pas du POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Action non autorisée.'];
            header('Location: index.php?action=list');
            exit();
        }

        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->deleteGeoCode($id);
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Code Géo mis à la corbeille.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à la corbeille.'];
             }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID invalide.'];
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function trashAction() {
        $deletedGeoCodes = $this->geoCodeManager->getDeletedGeoCodes();
        $this->render('trash_view', ['deletedGeoCodes' => $deletedGeoCodes]);
    }

    public function restoreAction() {
        // SÉCURITÉ POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             header('Location: index.php?action=trash'); exit();
        }

        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->restoreGeoCode($id);
            if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo restauré avec succès.'];
            } else {
                 $lastError = $this->geoCodeManager->getLastError();
                 $errorMessage = 'Erreur lors de la restauration.';
                 if ($lastError && $lastError[0] === '23000' && isset($lastError[2])) {
                     $errorMessage = $lastError[2];
                 } elseif (!$lastError) {
                     $errorMessage = 'Impossible de restaurer : le code n\'était peut-être pas dans la corbeille.';
                 }
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => htmlspecialchars($errorMessage)];
            }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID invalide pour la restauration.'];
        }
        header('Location: index.php?action=trash');
        exit();
    }

    public function forceDeleteAction() {
        // SÉCURITÉ POST
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
             header('Location: index.php?action=trash'); exit();
        }

        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->forceDeleteGeoCode($id);
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo supprimé définitivement.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la suppression définitive.'];
             }
        } else {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID invalide.'];
        }
        header('Location: index.php?action=trash');
        exit();
    }

    public function historyAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé.'];
            header('Location: index.php?action=list');
            exit();
        }
        $history = $this->geoCodeManager->getHistoryForGeoCode($id);
        $this->render('history_view', ['geoCode' => $geoCode, 'history' => $history]);
    }

    public function fullHistoryAction() {
        $fullHistory = $this->geoCodeManager->getFullHistory();
        $this->render('full_history_view', ['history' => $fullHistory]);
    }

    public function showBatchCreateAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('batch_create_view', ['universList' => $universList]);
    }

    public function handleBatchCreateAction() {
        $results = ['success' => 0, 'errors' => []];
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $codes_geo = $_POST['codes_geo'] ?? [];
            $libelles = $_POST['libelles'] ?? [];
            $univers_id = (int)($_POST['univers_id'] ?? 0);
            $univers = $this->universManager->getUniversById($univers_id);
             if (!$univers || empty($univers['zone_assignee'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Univers invalide.'];
                 header('Location: index.php?action=showBatchCreate');
                 exit();
             }
             $zone = $univers['zone_assignee'];

            $codesToInsert = [];
            for ($i = 0; $i < count($codes_geo); $i++) {
                $code = trim($codes_geo[$i] ?? '');
                $libelle = trim($libelles[$i] ?? '');
                if (!empty($code) && !empty($libelle)) {
                    $codesToInsert[] = [
                        'code_geo'   => $code,
                        'libelle'    => $libelle,
                        'univers_id' => $univers_id,
                        'zone'       => $zone,
                        'commentaire'=> null
                    ];
                }
            }

            if (!empty($codesToInsert)) {
                $results = $this->geoCodeManager->createBatchGeoCodes($codesToInsert);
                 $message = "{$results['success']} code(s) ajouté(s) avec succès.";
                 if (!empty($results['errors'])) {
                     $message .= "<br>Erreurs :<ul>";
                     foreach ($results['errors'] as $error) { $message .= "<li>" . htmlspecialchars($error) . "</li>"; }
                     $message .= "</ul>";
                     $_SESSION['flash_message'] = ['type' => 'warning', 'message' => $message];
                 } else {
                      $_SESSION['flash_message'] = ['type' => 'success', 'message' => $message];
                 }

            } else {
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Aucune ligne valide.'];
            }
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Méthode non autorisée.'];
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function showExportAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('export_view', ['universList' => $universList]);
    }

    public function handleExportAction() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Content-Type: application/json');
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Méthode POST requise.']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if ($input === null) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Données JSON invalides.']);
            exit();
        }
        $filters = [
            'zones' => $input['zones'] ?? [],
            'univers_ids' => $input['univers_ids'] ?? []
        ];

        $data = $this->geoCodeManager->getFilteredGeoCodes($filters);

        header('Content-Type: application/json');
        if ($data !== false) {
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur serveur.']);
        }
        exit();
    }

    public function showImportAction() {
        $this->render('import_view');
    }

    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $csvFile = $_FILES['csvFile']['tmp_name'];
            $fileHandle = fopen($csvFile, 'r');
            $header = fgetcsv($fileHandle, 0, ';', '"', '\\');
            if (!$header) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Impossible de lire le CSV.'];
                 header('Location: index.php?action=showImport'); exit();
            }
            $header = array_map(fn($h) => trim(strtolower(str_replace(['é', 'è'], 'e', $h))), $header);

            $requiredColumns = ['code_geo', 'libelle', 'univers', 'zone'];
            $missingColumns = array_diff($requiredColumns, $header);
             if (!empty($missingColumns)) {
                  $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Colonnes manquantes.'];
                  fclose($fileHandle); header('Location: index.php?action=showImport'); exit();
             }

            $allRows = []; $codesToCheck = [];
            while (($row = fgetcsv($fileHandle, 0, ';', '"', '\\')) !== false) {
                if (count($row) === count($header)) {
                    $data = array_combine($header, $row);
                    $data = array_map('trim', $data);
                    if (!empty($data['code_geo']) && !empty($data['libelle']) && !empty($data['univers']) && !empty($data['zone'])) {
                        if (in_array(strtolower($data['zone']), ['vente', 'reserve'])) {
                            $allRows[] = $data;
                            $codesToCheck[] = $data['code_geo'];
                        }
                    }
                }
            }
            fclose($fileHandle);

            $existingCodes = $this->geoCodeManager->getExistingCodes($codesToCheck);
            $codesToInsert = []; $duplicateCodes = [];
            $universManager = new UniversManager($this->db);

            foreach ($allRows as $rowData) {
                $currentCode = $rowData['code_geo'];
                if (in_array($currentCode, $existingCodes)) {
                    $duplicateCodes[] = $currentCode;
                } else {
                    $codesToInsert[] = [
                        'code_geo'    => $currentCode,
                        'libelle'     => $rowData['libelle'],
                        'univers'     => $rowData['univers'],
                        'zone'        => strtolower($rowData['zone']),
                        'commentaire' => $rowData['commentaire'] ?? null
                    ];
                    $existingCodes[] = $currentCode;
                }
            }

            $insertedCount = 0;
            if (!empty($codesToInsert)) {
                $insertResult = $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $universManager);
                if ($insertResult !== false) {
                    $insertedCount = $insertResult;
                }
            }

            $message = "Import terminé. $insertedCount créés.";
            if (!empty($duplicateCodes)) {
                $message .= " " . count($duplicateCodes) . " doublons ignorés.";
            }

            $_SESSION['flash_message'] = ['type' => 'info', 'message' => $message];

        } elseif (isset($_FILES['csvFile'])) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Erreur fichier."];
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Aucun fichier."];
        }
        header('Location: index.php?action=list');
        exit();
    }

    public function showPrintOptionsAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('print_options_view', ['universList' => $universList]);
    }

    public function getCodesForPrintAction() {
        header('Content-Type: application/json');
        $universIds = $_GET['univers_ids'] ?? [];
        if (empty($universIds)) { echo json_encode([]); exit(); }
        $universIds = array_map('intval', $universIds);
        $geoCodes = $this->geoCodeManager->getGeoCodesByUniversIds($universIds);
        echo json_encode($geoCodes);
        exit();
    }

    public function getSingleGeoCodeJsonAction() {
        header('Content-Type: application/json');
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID invalide.']);
            exit();
        }
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode || $geoCode['deleted_at'] !== null) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Code non trouvé.']);
            exit();
        }
        echo json_encode(['success' => true, 'data' => $geoCode]);
        exit();
    }
}
?>
