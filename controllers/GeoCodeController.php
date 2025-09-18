<?php

require_once '../models/GeoCodeManager.php';

class GeoCodeController {
    
    private $manager;

    public function __construct(PDO $db) {
        $this->manager = new GeoCodeManager($db);
    }

    /**
     * Définit un message flash dans la session.
     * @param string $type Le type de message (success, error, warning)
     * @param string $message Le message à afficher
     */
    private function setFlashMessage($type, $message) {
        $_SESSION['flash_message'] = [
            'type' => $type,
            'message' => $message
        ];
    }

    /**
     * Action pour lister tous les codes géo.
     */
    public function listAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $univers = $this->manager->getAllUnivers();
        require '../views/geo_codes_list_view.php';
    }

    /**
     * Action pour afficher le formulaire de création.
     */
    public function createAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/geo_codes_create_view.php';
    }

    /**
     * Action pour traiter l'ajout d'un nouveau code géo.
     */
    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers_id = (int)($_POST['univers_id'] ?? 0);
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($code_geo) && !empty($libelle) && !empty($univers_id) && !empty($zone)) {
                if ($this->manager->createGeoCode($code_geo, $libelle, $univers_id, $zone, $commentaire)) {
                    $this->setFlashMessage('success', "Le code géo '{$code_geo}' a été ajouté avec succès.");
                } else {
                    $this->setFlashMessage('error', "Erreur lors de l'ajout du code géo.");
                }
            } else {
                $this->setFlashMessage('error', 'Tous les champs requis ne sont pas remplis.');
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Action pour afficher le formulaire d'édition.
     */
    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->manager->getGeoCodeById($id);
        if (!$geoCode) {
            $this->setFlashMessage('error', 'Code géo non trouvé.');
            header('Location: index.php?action=list');
            exit();
        }
        $universList = $this->manager->getAllUnivers();
        require '../views/geo_codes_edit_view.php';
    }

    /**
     * Action pour traiter la mise à jour d'un code géo.
     */
    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $id = (int)$_POST['id'];
            $code_geo = trim($_POST['code_geo'] ?? '');
            $libelle = trim($_POST['libelle'] ?? '');
            $univers_id = (int)$_POST['univers_id'];
            $zone = $_POST['zone'] ?? '';
            $commentaire = trim($_POST['commentaire'] ?? null);

            if (!empty($id) && !empty($code_geo) && !empty($libelle) && !empty($univers_id) && !empty($zone)) {
                if ($this->manager->updateGeoCode($id, $code_geo, $libelle, $univers_id, $zone, $commentaire)) {
                    $this->setFlashMessage('success', "Le code géo '{$code_geo}' a été mis à jour.");
                } else {
                     $this->setFlashMessage('error', "Erreur lors de la mise à jour.");
                }
            } else {
                 $this->setFlashMessage('error', 'Données manquantes pour la mise à jour.');
            }
        }
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Action pour afficher le plan du magasin.
     */
    public function planAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/plan_view.php';
    }

    /**
     * Action pour sauvegarder la position d'un code géo (via AJAX).
     */
    public function savePositionAction() {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['id'], $input['x'], $input['y'])) {
            $success = $this->manager->savePosition((int)$input['id'], (int)$input['x'], (int)$input['y']);
            echo json_encode(['status' => $success ? 'success' : 'error']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
        }
        exit();
    }

    /**
     * Action pour exporter les données en CSV.
     */
    public function exportAction() {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="export_geocodes_'.date('Y-m-d').'.csv"');
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        $output = fopen('php://output', 'w');
        fputcsv($output, ['code_geo', 'libelle', 'univers', 'zone', 'commentaire']);
        foreach ($geoCodes as $code) {
            fputcsv($output, [
                $code['code_geo'], $code['libelle'], $code['univers'], $code['zone'], $code['commentaire']
            ]);
        }
        fclose($output);
        exit();
    }

    /**
     * Action pour afficher la page d'importation.
     */
    public function showImportAction() {
        require '../views/import_view.php';
    }

    /**
     * Action pour traiter le fichier CSV importé.
     */
    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $file = $_FILES['csvFile']['tmp_name'];
            $handle = fopen($file, "r");
            fgetcsv($handle); // Ignorer la ligne d'en-tête
            $codesToInsert = [];
            while (($data = fgetcsv($handle)) !== FALSE) {
                $codesToInsert[] = [
                    'code_geo' => $data[0] ?? '', 'libelle' => $data[1] ?? '', 'univers' => $data[2] ?? '',
                    'zone' => $data[3] ?? '', 'commentaire' => $data[4] ?? null
                ];
            }
            fclose($handle);
            if (!empty($codesToInsert)) {
                if ($this->manager->createMultipleGeoCodes($codesToInsert)) {
                    $this->setFlashMessage('success', count($codesToInsert) . ' codes géo ont été importés.');
                } else {
                    $this->setFlashMessage('error', "Erreur durant l'importation CSV.");
                }
            } else {
                $this->setFlashMessage('warning', "Le fichier CSV était vide ou mal formaté.");
            }
        } else {
             $this->setFlashMessage('error', "Erreur lors du téléversement du fichier.");
        }
        header('Location: index.php?action=list');
        exit();
    }
    
    /**
     * Action pour afficher la page d'impression des étiquettes.
     */
    public function printLabelsAction() {
        $geoCodes = $this->manager->getAllGeoCodesWithPositions();
        require '../views/print_labels_view.php';
    }

    // --- ACTIONS POUR LES UNIVERS ---

    /**
     * Action pour lister les univers.
     */
    public function listUniversAction() {
        $universList = $this->manager->getAllUnivers();
        require '../views/univers_list_view.php';
    }

    /**
     * Action pour ajouter un nouvel univers.
     */
    public function addUniversAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $nom = trim($_POST['nom'] ?? '');
            if (!empty($nom)) {
                if ($this->manager->addUnivers($nom)) {
                    $this->setFlashMessage('success', "L'univers '{$nom}' a été ajouté.");
                } else {
                    $this->setFlashMessage('error', "Erreur lors de l'ajout de l'univers.");
                }
            } else {
                 $this->setFlashMessage('warning', "Le nom de l'univers ne peut pas être vide.");
            }
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }

    /**
     * Action pour supprimer un univers.
     */
    public function deleteUniversAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($this->manager->deleteUnivers($id)) {
            $this->setFlashMessage('success', "L'univers a été supprimé.");
        } else {
            $this->setFlashMessage('error', "Impossible de supprimer l'univers. Il est probablement utilisé par des codes géo.");
        }
        header('Location: index.php?action=listUnivers');
        exit();
    }
}
