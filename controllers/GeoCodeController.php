<?php
// Fichier : controllers/GeoCodeController.php

// Inclusion des classes nécessaires
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';
// FPDF n'est plus requis ici pour l'export tableau car géré par JS

class GeoCodeController extends BaseController {

    private $geoCodeManager;
    private $universManager;

    public function __construct(PDO $db) {
        $this->geoCodeManager = new GeoCodeManager($db);
        $this->universManager = new UniversManager($db);
    }

    /**
     * Affiche la liste principale des codes géo.
     */
    public function listAction() {
        // Récupère les codes avec détails des placements (si la méthode existe et est utile)
        // Ou juste les codes simples si les placements ne sont pas affichés dans la liste
        // $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        $geoCodes = $this->geoCodeManager->getAllGeoCodes(); // Récupère tous les codes actifs
        // Récupère tous les univers pour les filtres
        $univers = $this->universManager->getAllUnivers();
        // Rend la vue correspondante avec les données
        $this->render('geo_codes_list_view', [
            'geoCodes' => $geoCodes,
            'univers' => $univers
        ]);
    }

    /**
     * Affiche le formulaire de création d'un nouveau code géo.
     */
    public function createAction() {
        // Récupère la liste des univers pour le sélecteur
        $universList = $this->universManager->getAllUnivers();
        // Rend la vue de création
        $this->render('geo_codes_create_view', ['universList' => $universList]);
    }

     /**
     * Traite la soumission du formulaire de création d'un code géo.
     */
    public function addAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $univers_id = (int)$_POST['univers_id'];
             // Utilisation de la zone sélectionnée dans le formulaire de création
             // (Plutôt que celle de l'univers, pour plus de flexibilité à la création)
            $zone = $_POST['zone'] ?? null;

            if ($univers_id <= 0 || empty($zone) || !in_array($zone, ['vente', 'reserve'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Zone ou Univers non valide sélectionné.'];
                 header('Location: index.php?action=create'); // Retour au formulaire
                 exit();
            }

            // Vérifier si l'univers existe (sécurité)
            $univers = $this->universManager->getUniversById($univers_id);
            if (!$univers) {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Univers non trouvé.'];
                header('Location: index.php?action=create');
                exit();
            }

            // Appelle le manager
            $result = $this->geoCodeManager->addGeoCode(
                $_POST['code_geo'],
                $_POST['libelle'],
                $univers_id,
                $_POST['commentaire'], // Commentaire
                $zone                  // Zone sélectionnée
            );

            // Ajoute un message flash en fonction du succès ou de l'échec
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
        // Redirige vers la liste
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche le formulaire d'édition d'un code géo existant.
     */
    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id); // Récupère le code par ID
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

    /**
     * Traite la soumission du formulaire d'édition d'un code géo.
     */
    public function updateAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
             $id = (int)$_POST['id'];
             $univers_id = (int)$_POST['univers_id'];
             $zone = $_POST['zone'] ?? null;

             if ($id <= 0 || $univers_id <= 0 || empty($zone) || !in_array($zone, ['vente', 'reserve'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Données invalides pour la mise à jour.'];
                 header('Location: index.php?action=list'); // Redirige vers la liste en cas d'erreur grave
                 exit();
             }

            // Appelle le manager pour mettre à jour le code
            $success = $this->geoCodeManager->updateGeoCode(
                $id,
                $_POST['code_geo'],
                $_POST['libelle'],
                $univers_id,
                $_POST['commentaire'], // Ordre corrigé
                $zone                 // Ordre corrigé
            );
             // Ajoute un message flash
            if ($success) {
                $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo mis à jour avec succès.'];
            } else {
                 $lastError = $this->geoCodeManager->getLastError();
                 $errorMessage = ($lastError && isset($lastError[2]) && str_contains($lastError[2], 'Duplicate entry'))
                                ? 'Le nouveau code Géo existe peut-être déjà.'
                                : 'Erreur lors de la mise à jour.';
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => $errorMessage];
                 // En cas d'erreur de duplicata, il serait mieux de rediriger vers le formulaire d'édition
                 header('Location: index.php?action=edit&id=' . $id);
                 exit();
            }
        }
        // Redirige vers la liste si succès ou méthode non POST
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Effectue un soft delete (met à la corbeille) d'un code géo.
     */
    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->deleteGeoCode($id);
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Code Géo mis à la corbeille.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à la corbeille (peut-être déjà supprimé?).'];
             }
        } else {
             $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID invalide pour la suppression.'];
        }
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche le contenu de la corbeille.
     */
    public function trashAction() {
        $deletedGeoCodes = $this->geoCodeManager->getDeletedGeoCodes();
        $this->render('trash_view', ['deletedGeoCodes' => $deletedGeoCodes]);
    }

    /**
     * Restaure un code géo depuis la corbeille.
     */
    public function restoreAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->restoreGeoCode($id);
            if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo restauré avec succès.'];
            } else {
                 $lastError = $this->geoCodeManager->getLastError();
                 $errorMessage = 'Erreur lors de la restauration.';
                 // Vérifie si l'erreur est due à un duplicata actif
                 if ($lastError && $lastError[0] === '23000' && isset($lastError[2])) {
                     $errorMessage = $lastError[2]; // Utilise le message d'erreur du manager
                 } elseif (!$lastError) {
                     // Si pas d'erreur spécifique mais échec, l'ID n'était peut-être pas dans la corbeille
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

    /**
     * Supprime définitivement un code géo de la base de données.
     */
    public function forceDeleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $success = $this->geoCodeManager->forceDeleteGeoCode($id);
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo supprimé définitivement.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la suppression définitive (vérifiez les logs).'];
             }
        } else {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'ID invalide pour la suppression définitive.'];
        }
        header('Location: index.php?action=trash');
        exit();
    }

    /**
     * Affiche l'historique des modifications pour un code géo spécifique.
     */
    public function historyAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé pour afficher l\'historique.'];
            header('Location: index.php?action=list');
            exit();
        }
        $history = $this->geoCodeManager->getHistoryForGeoCode($id);
        $this->render('history_view', ['geoCode' => $geoCode, 'history' => $history]);
    }

    /**
     * Affiche l'historique global de toutes les modifications.
     */
    public function fullHistoryAction() {
        $fullHistory = $this->geoCodeManager->getFullHistory();
        $this->render('full_history_view', ['history' => $fullHistory]);
    }

    /**
     * Affiche le formulaire pour l'ajout par lot de codes géo.
     */
    public function showBatchCreateAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('batch_create_view', ['universList' => $universList]);
    }

    /**
     * Traite la soumission du formulaire d'ajout par lot.
     */
    public function handleBatchCreateAction() {
        $results = ['success' => 0, 'errors' => []];
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $codes_geo = $_POST['codes_geo'] ?? [];
            $libelles = $_POST['libelles'] ?? [];
            $univers_id = (int)($_POST['univers_id'] ?? 0);
             // La zone est maintenant liée à l'univers dans la DB, on la récupère
            $univers = $this->universManager->getUniversById($univers_id);
             if (!$univers || empty($univers['zone_assignee'])) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Univers ou zone associée invalide sélectionné pour le lot.'];
                 header('Location: index.php?action=showBatchCreate');
                 exit();
             }
             $zone = $univers['zone_assignee']; // Zone vient de l'univers choisi

            $codesToInsert = [];
            for ($i = 0; $i < count($codes_geo); $i++) {
                $code = trim($codes_geo[$i] ?? '');
                $libelle = trim($libelles[$i] ?? '');
                if (!empty($code) && !empty($libelle)) {
                    $codesToInsert[] = [
                        'code_geo'   => $code,
                        'libelle'    => $libelle,
                        'univers_id' => $univers_id,
                        'zone'       => $zone, // Utilise la zone de l'univers sélectionné
                        'commentaire'=> null
                    ];
                }
            }

            if (!empty($codesToInsert)) {
                $results = $this->geoCodeManager->createBatchGeoCodes($codesToInsert);
                 $message = "{$results['success']} code(s) ajouté(s) avec succès pour l'univers \"{$univers['nom']}\".";
                 if (!empty($results['errors'])) {
                     $message .= "<br>Erreurs rencontrées :<ul>";
                     foreach ($results['errors'] as $error) { $message .= "<li>" . htmlspecialchars($error) . "</li>"; }
                     $message .= "</ul>";
                     $_SESSION['flash_message'] = ['type' => 'warning', 'message' => $message];
                 } else {
                      $_SESSION['flash_message'] = ['type' => 'success', 'message' => $message];
                 }

            } else {
                 $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Aucune ligne valide à ajouter.'];
            }
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Méthode non autorisée.'];
        }
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche la page des options d'exportation.
     */
    public function showExportAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('export_view', ['universList' => $universList]);
    }

    /**
     * Traite la demande d'exportation (côté client maintenant) en renvoyant les données JSON.
     * Est appelée par le fetch() du JavaScript dans export_view.php.
     */
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

        // Récupère TOUTES les colonnes potentiellement utiles pour que le JS puisse filtrer
        $data = $this->geoCodeManager->getFilteredGeoCodes($filters);

        header('Content-Type: application/json');
        if ($data !== false) {
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Erreur serveur lors de la récupération des données.']);
        }
        exit();
    }

    /**
     * Affiche la page d'importation de fichier CSV.
     */
    public function showImportAction() {
        $this->render('import_view');
    }

    /**
     * Traite le fichier CSV téléversé pour importer des codes géo.
     */
    public function handleImportAction() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $csvFile = $_FILES['csvFile']['tmp_name'];
            $fileHandle = fopen($csvFile, 'r');
            // Lecture de l'en-tête
            $header = fgetcsv($fileHandle, 0, ';', '"', '\\');
            if (!$header) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Impossible de lire l\'en-tête CSV. Assurez-vous d\'utiliser ";" comme séparateur.'];
                 header('Location: index.php?action=showImport'); exit();
            }
            $header = array_map(fn($h) => trim(strtolower(str_replace(['é', 'è'], 'e', $h))), $header); // Nettoyage header

            $requiredColumns = ['code_geo', 'libelle', 'univers', 'zone'];
            $missingColumns = array_diff($requiredColumns, $header);
             if (!empty($missingColumns)) {
                  $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Colonnes CSV manquantes : ' . implode(', ', $missingColumns) . '. Les colonnes requises sont: ' . implode(', ', $requiredColumns) . '.'];
                  fclose($fileHandle); header('Location: index.php?action=showImport'); exit();
             }

            $allRows = []; $codesToCheck = []; $lineNum = 1;
            while (($row = fgetcsv($fileHandle, 0, ';', '"', '\\')) !== false) {
                $lineNum++;
                if (count($row) === count($header)) {
                    $data = array_combine($header, $row);
                    // Nettoyer les données (trim)
                    $data = array_map('trim', $data);
                    // Vérifier les champs obligatoires non vides
                    if (!empty($data['code_geo']) && !empty($data['libelle']) && !empty($data['univers']) && !empty($data['zone'])) {
                        if (in_array(strtolower($data['zone']), ['vente', 'reserve'])) {
                            $allRows[] = $data;
                            $codesToCheck[] = $data['code_geo'];
                        } else {
                            error_log("Ligne CSV $lineNum ignorée (zone invalide '{$data['zone']}'): " . implode(';', $row));
                        }
                    } else {
                        error_log("Ligne CSV $lineNum ignorée (champ obligatoire vide): " . implode(';', $row));
                    }
                } else {
                     error_log("Ligne CSV $lineNum ignorée (nombre de colonnes incorrect): " . implode(';', $row));
                }
            }
            fclose($fileHandle);

            $existingCodes = $this->geoCodeManager->getExistingCodes($codesToCheck);
            $codesToInsert = []; $duplicateCodes = [];
            $universManager = new UniversManager($this->db); // Besoin de l'instance

            foreach ($allRows as $rowData) {
                $currentCode = $rowData['code_geo'];
                if (in_array($currentCode, $existingCodes)) {
                    $duplicateCodes[] = $currentCode;
                } else {
                    // createMultipleGeoCodes attend le NOM de l'univers et la zone du CSV
                    $codesToInsert[] = [
                        'code_geo'    => $currentCode,
                        'libelle'     => $rowData['libelle'],
                        'univers'     => $rowData['univers'], // Nom de l'univers
                        'zone'        => strtolower($rowData['zone']), // Assure minuscule
                        'commentaire' => $rowData['commentaire'] ?? null
                    ];
                    $existingCodes[] = $currentCode; // Evite doublon DANS le fichier lui-même
                }
            }

            $insertedCount = 0; $importErrors = [];
            if (!empty($codesToInsert)) {
                $insertResult = $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $universManager);
                if ($insertResult === false) {
                    $lastDbError = $this->geoCodeManager->getLastError();
                    $importErrors[] = "Erreur majeure lors de l'importation (transaction annulée). Vérifiez les logs. Erreur BDD: " . ($lastDbError[2] ?? 'Inconnue');
                } else {
                    $insertedCount = $insertResult;
                }
            }

            // Construction message final
            $message = "<strong>Rapport d'importation :</strong><br>";
            if ($insertedCount > 0) {
                 $message .= $insertedCount . " nouveau(x) code(s) importé(s).<br>";
            } else {
                 $message .= "Aucun nouveau code n'a été importé.<br>";
            }
            if (!empty($duplicateCodes)) {
                $uniqueDuplicates = array_unique($duplicateCodes);
                $message .= "<strong>" . count($uniqueDuplicates) . " code(s) existai(en)t déjà (ou étaient en double dans le fichier) et ont été ignoré(s) :</strong><br><ul>";
                foreach(array_slice($uniqueDuplicates, 0, 10) as $dup) { $message .= "<li>" . htmlspecialchars($dup) . "</li>"; } // Limite l'affichage
                if(count($uniqueDuplicates) > 10) { $message .= "<li>Et ".(count($uniqueDuplicates)-10)." autres...</li>"; }
                $message .= "</ul>";
            }
            if (!empty($importErrors)) {
                 $message .= "<strong>Erreurs d'importation :</strong><br><ul>";
                 foreach ($importErrors as $err) { $message .= "<li>" . htmlspecialchars($err) . "</li>"; }
                 $message .= "</ul>";
            }

            $flashType = 'info';
            if ($insertedCount > 0 && empty($duplicateCodes) && empty($importErrors)) $flashType = 'success';
            if ($insertedCount > 0 && (!empty($duplicateCodes) || !empty($importErrors))) $flashType = 'warning';
            if ($insertedCount == 0 && (!empty($duplicateCodes) || !empty($importErrors))) $flashType = 'warning';
            if ($insertedCount == 0 && empty($duplicateCodes) && !empty($importErrors)) $flashType = 'danger';

            $_SESSION['flash_message'] = ['type' => $flashType, 'message' => $message];

        } elseif (isset($_FILES['csvFile'])) {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Erreur envoi fichier CSV (Code: {$_FILES['csvFile']['error']}). Vérifiez la taille du fichier."];
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Aucun fichier CSV envoyé."];
        }
        header('Location: index.php?action=list');
        exit();
    }


    /**
     * Affiche la page des options d'impression (PDF via JS).
     */
    public function showPrintOptionsAction() {
        $universList = $this->universManager->getAllUnivers();
        $this->render('print_options_view', ['universList' => $universList]);
    }

    /**
     * Récupère les données des codes géo pour les univers spécifiés (JSON pour JS).
     */
    public function getCodesForPrintAction() {
        header('Content-Type: application/json');
        $universIds = $_GET['univers_ids'] ?? [];
        if (empty($universIds)) { echo json_encode([]); exit(); }
        $universIds = array_map('intval', $universIds);
        // S'assure que getGeoCodesByUniversIds retourne bien id, code_geo, libelle, commentaire, univers (nom)
        $geoCodes = $this->geoCodeManager->getGeoCodesByUniversIds($universIds);
        echo json_encode($geoCodes);
        exit();
    }

    /**
     * NOUVELLE ACTION: Récupère les données d'un seul code géo en JSON pour l'impression JS.
     */
    public function getSingleGeoCodeJsonAction() {
        header('Content-Type: application/json');
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID invalide.']);
            exit();
        }
        // getGeoCodeById inclut 'univers_nom' et 'univers_color'
        $geoCode = $this->geoCodeManager->getGeoCodeById($id);
        if (!$geoCode || $geoCode['deleted_at'] !== null) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Code non trouvé ou supprimé.']);
            exit();
        }
        echo json_encode(['success' => true, 'data' => $geoCode]);
        exit();
    }

    /**
     * Retourne tous les codes géo actifs avec leurs positions en JSON.
     * Utilisé par l'éditeur de plan (plan.js) pour l'initialisation.
     */
    public function getAllCodesJsonAction() {
       header('Content-Type: application/json');
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        echo json_encode($geoCodes);
        exit();
    }
}
?>
