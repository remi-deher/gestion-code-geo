<?php
// Fichier : controllers/GeoCodeController.php

// Inclusion des classes nécessaires
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/GeoCodeManager.php';
require_once __DIR__ . '/../models/UniversManager.php';

// Inclusion de FPDF (pour l'export PDF qui était demandé)
require_once __DIR__ . '/../helpers/fpdf/fpdf.php';


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
        // Récupère les codes avec détails des placements pour l'affichage enrichi
	$geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
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

            // 1. Récupérer l'univers_id
            $univers_id = (int)$_POST['univers_id'];
            if ($univers_id <= 0) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Univers non valide sélectionné.'];
                 header('Location: index.php?action=create'); // Retour au formulaire
                 exit();
            }

            // 2. Récupérer l'univers pour déterminer la zone
            $univers = $this->universManager->getUniversById($univers_id);
            if (!$univers) {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur : Univers non trouvé.'];
                header('Location: index.php?action=create');
                exit();
            }
            // 3. Utiliser la zone assignée à l'univers
            $zone = $univers['zone_assignee'];

            // Appelle le manager (avec le bon ordre d'arguments et la bonne zone)
            $result = $this->geoCodeManager->addGeoCode(
                $_POST['code_geo'],
                $_POST['libelle'],
                $univers_id,
                $_POST['commentaire'], // Commentaire
                $zone                  // Zone (dérivée de l'univers)
            );

            // Ajoute un message flash en fonction du succès ou de l'échec
            if ($result) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo ajouté avec succès.'];
            } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de l\'ajout. Le code Géo existe peut-être déjà.'];
            }
        }
        // Redirige vers la liste
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Traite une requête AJAX pour ajouter un code géo depuis l'éditeur de plan.
     */
    public function addGeoCodeFromPlanAction() {
        header('Content-Type: application/json'); // Définit le type de contenu de la réponse
        $input = json_decode(file_get_contents('php://input'), true); // Lit les données JSON envoyées

        // Vérifie si les données nécessaires sont présentes
        if (!isset($input['code_geo'], $input['libelle'], $input['univers_id'])) {
             http_response_code(400); // Mauvaise requête
             echo json_encode(['error' => 'Données incomplètes.']);
             exit();
        }

        // Récupère l'univers pour déterminer la zone associée
        $univers = $this->universManager->getUniversById((int)$input['univers_id']);
        if (!$univers) {
            http_response_code(400);
            echo json_encode(['error' => 'Univers sélectionné invalide.']);
            exit();
        }
        $zone = $univers['zone_assignee']; // Utilise la zone assignée à l'univers

        // Tente de créer le code géo
        $newId = $this->geoCodeManager->createGeoCode(
            $input['code_geo'],
            $input['libelle'],
            (int)$input['univers_id'],
            $input['commentaire'] ?? null, // Commentaire optionnel
	    $zone			   // Zone
        );

        // Renvoie le nouveau code créé (ou une erreur) en JSON
        if ($newId) {
            $newCode = $this->geoCodeManager->getGeoCodeById($newId); // Récupère les détails complets
            $newCode['univers'] = $univers['nom']; // Ajoute le nom de l'univers pour le JS
            echo json_encode($newCode);
        } else {
            http_response_code(500); // Erreur serveur (probablement duplicata)
            echo json_encode(['error' => 'Impossible de créer le code géo (peut-être un duplicata ?).']);
        }
        exit();
    }

    /**
     * Affiche le formulaire d'édition d'un code géo existant.
     */
    public function editAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id); // Récupère le code par ID
        // Si le code n'existe pas, redirige vers la liste
        if (!$geoCode) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé.'];
            header('Location: index.php?action=list');
            exit();
        }
        // Récupère la liste des univers pour le sélecteur
        $universList = $this->universManager->getAllUnivers();
        // Rend la vue d'édition avec les données du code et la liste des univers
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
            // Appelle le manager pour mettre à jour le code
            $success = $this->geoCodeManager->updateGeoCode(
                (int)$_POST['id'],
                $_POST['code_geo'],
                $_POST['libelle'],
                (int)$_POST['univers_id'],
                $_POST['zone'],
                $_POST['commentaire']
            );
             // Ajoute un message flash
            if ($success) {
                $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo mis à jour avec succès.'];
            } else {
                $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à jour. Le nouveau code Géo existe peut-être déjà.'];
            }
        }
        // Redirige vers la liste
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Effectue un soft delete (met à la corbeille) d'un code géo.
     */
    public function deleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            // Appelle le manager pour le soft delete
            $success = $this->geoCodeManager->deleteGeoCode($id);
             // Ajoute un message flash
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'info', 'message' => 'Code Géo mis à la corbeille.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la mise à la corbeille.'];
             }
        }
        // Redirige vers la liste
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche le contenu de la corbeille.
     */
    public function trashAction() {
        // Récupère les codes supprimés (soft delete)
        $deletedGeoCodes = $this->geoCodeManager->getDeletedGeoCodes();
        // Rend la vue de la corbeille
        $this->render('trash_view', ['deletedGeoCodes' => $deletedGeoCodes]);
    }

    /**
     * Restaure un code géo depuis la corbeille.
     */
    public function restoreAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            // Appelle le manager pour restaurer
            $success = $this->geoCodeManager->restoreGeoCode($id);
            if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo restauré avec succès.'];
            } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la restauration.'];
            }
        }
        // Redirige vers la corbeille
        header('Location: index.php?action=trash');
        exit();
    }

    /**
     * Supprime définitivement un code géo de la base de données.
     */
    public function forceDeleteAction() {
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            // Appelle le manager pour la suppression définitive
            $success = $this->geoCodeManager->forceDeleteGeoCode($id);
             if ($success) {
                 $_SESSION['flash_message'] = ['type' => 'success', 'message' => 'Code Géo supprimé définitivement.'];
             } else {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Erreur lors de la suppression définitive.'];
             }
        }
        // Redirige vers la corbeille
        header('Location: index.php?action=trash');
        exit();
    }

    /**
     * Affiche l'historique des modifications pour un code géo spécifique.
     */
    public function historyAction() {
        $id = (int)($_GET['id'] ?? 0);
        $geoCode = $this->geoCodeManager->getGeoCodeById($id); // Récupère le code
        // Si non trouvé, retour à la liste
        if (!$geoCode) {
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé pour afficher l\'historique.'];
            header('Location: index.php?action=list');
            exit();
        }
        // Récupère l'historique pour ce code
        $history = $this->geoCodeManager->getHistoryForGeoCode($id);
        // Rend la vue de l'historique
        $this->render('history_view', ['geoCode' => $geoCode, 'history' => $history]);
    }

    /**
     * Affiche l'historique global de toutes les modifications.
     */
    public function fullHistoryAction() {
        // Récupère l'historique global limité aux N dernières entrées
        $fullHistory = $this->geoCodeManager->getFullHistory();
        // Rend la vue de l'historique global
        $this->render('full_history_view', ['history' => $fullHistory]);
    }

    /**
     * Affiche le formulaire pour l'ajout par lot de codes géo.
     */
    public function showBatchCreateAction() {
        // Récupère la liste des univers pour le sélecteur
        $universList = $this->universManager->getAllUnivers();
        // Rend la vue d'ajout par lot
        $this->render('batch_create_view', ['universList' => $universList]);
    }

    /**
     * Traite la soumission du formulaire d'ajout par lot.
     */
    public function handleBatchCreateAction() {
        $results = ['success' => 0, 'errors' => []]; // Initialise les résultats
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $codes_geo = $_POST['codes_geo'] ?? [];
            $libelles = $_POST['libelles'] ?? [];
            $univers_id = (int)($_POST['univers_id'] ?? 0);
            $zone = $_POST['zone'] ?? ''; // La zone est sélectionnée globalement pour le lot

            // Vérifie que l'univers et la zone sont valides
            if ($univers_id <= 0 || empty($zone)) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Veuillez sélectionner une zone et un univers valides.'];
                 header('Location: index.php?action=showBatchCreate');
                 exit();
            }

            $codesToInsert = [];
            // Prépare les données pour chaque ligne valide
            for ($i = 0; $i < count($codes_geo); $i++) {
                $code = trim($codes_geo[$i] ?? '');
                $libelle = trim($libelles[$i] ?? '');
                if (!empty($code) && !empty($libelle)) {
                    $codesToInsert[] = [
                        'code_geo'   => $code,
                        'libelle'    => $libelle,
                        'univers_id' => $univers_id,
                        'zone'       => $zone, // Utilise la zone sélectionnée pour le lot
                        'commentaire'=> null // Pas de commentaire dans l'ajout par lot
                    ];
                }
            }

            // Si des données valides existent, tente de les insérer
            if (!empty($codesToInsert)) {
                $results = $this->geoCodeManager->createBatchGeoCodes($codesToInsert);
                 // Construit le message flash basé sur les résultats
                 $message = "{$results['success']} code(s) ajouté(s) avec succès.";
                 if (!empty($results['errors'])) {
                     $message .= "<br>Erreurs rencontrées :<ul>";
                     foreach ($results['errors'] as $error) {
                         $message .= "<li>" . htmlspecialchars($error) . "</li>";
                     }
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
        // Redirige vers la liste après traitement
        header('Location: index.php?action=list');
        exit();
    }

    /**
     * Affiche la page des options d'exportation.
     */
    public function showExportAction() {
        // Récupère la liste des univers pour les filtres
        $universList = $this->universManager->getAllUnivers();
        // Rend la vue d'exportation
        $this->render('export_view', ['universList' => $universList]);
    }

    /**
     * Traite la demande d'exportation et génère le fichier (CSV ou PDF).
     */
    public function handleExportAction() {
        // Récupère les filtres et options depuis POST
        $filters = [
            'zones' => $_POST['zones'] ?? [],
            'univers_ids' => $_POST['univers_ids'] ?? []
        ];
        $columns = $_POST['columns'] ?? ['code_geo', 'libelle', 'univers', 'zone']; // Colonnes par défaut
        $format = $_POST['format'] ?? 'csv';
        $filename = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $_POST['filename'] ?? 'export_codes_geo');

        // Récupère les données filtrées
        $data = $this->geoCodeManager->getFilteredGeoCodes($filters);

        // Génère le fichier dans le format demandé
        if ($format === 'csv') {
            $this->generateCsvExport($data, $columns, $filename);
        } elseif ($format === 'pdf') {
             $this->generatePdfExport($data, $columns, $filename);
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Format d\'exportation non supporté.'];
            header('Location: index.php?action=showExport');
        }
        exit(); // Termine le script après la génération du fichier
    }

    /**
     * Génère et envoie un fichier CSV.
     * @param array $data Données à exporter.
     * @param array $columns Colonnes à inclure.
     * @param string $filename Nom du fichier (sans extension).
     */
    private function generateCsvExport(array $data, array $columns, string $filename) {
        header('Content-Type: text/csv; charset=utf-8'); // Définit le type MIME CSV
        header('Content-Disposition: attachment; filename="' . $filename . '.csv"'); // Force le téléchargement

        $output = fopen('php://output', 'w'); // Ouvre le flux de sortie standard

        // Écrit l'en-tête (nom des colonnes)
        fputcsv($output, $columns, ';');

        // Écrit chaque ligne de données
        foreach ($data as $row) {
            $line = [];
            foreach ($columns as $col) {
                // S'assure que même si une colonne demandée n'existe pas, on met une chaîne vide
                $line[] = $row[$col] ?? '';
            }
            fputcsv($output, $line, ';');
        }

        fclose($output); // Ferme le flux
    }

     /**
     * Génère et envoie un fichier PDF (utilise FPDF).
     * @param array $data Données à exporter.
     * @param array $columns Colonnes à inclure.
     * @param string $filename Nom du fichier (sans extension).
     */
     private function generatePdfExport(array $data, array $columns, string $filename) {
         $pdf = new FPDF('L', 'mm', 'A4'); // Paysage, mm, A4
         $pdf->AddPage(); // Ajoute une page
         $pdf->SetFont('Arial', 'B', 12); // Définit la police pour l'en-tête

         // Calcul simple de la largeur des colonnes
         $pageWidth = $pdf->GetPageWidth() - 20; // Largeur de la page moins les marges (10mm * 2)
         $colWidth = $pageWidth / count($columns);

         // En-tête du tableau
         foreach ($columns as $col) {
             $pdf->Cell($colWidth, 7, ucfirst(str_replace('_', ' ', $col)), 1, 0, 'C'); // Dessine une cellule d'en-tête
         }
         $pdf->Ln(); // Saut de ligne

         // Données du tableau
         $pdf->SetFont('Arial', '', 10); // Change la police pour les données
         foreach ($data as $row) {
             foreach ($columns as $col) {
                  $cellData = $row[$col] ?? '';
                  // Décode UTF-8 pour FPDF standard (peut poser problème avec certains caractères)
                  // Utiliser MultiCell permettrait un meilleur retour à la ligne automatique si nécessaire
                 $pdf->Cell($colWidth, 6, utf8_decode((string)$cellData), 1);
             }
             $pdf->Ln(); // Saut de ligne après chaque ligne de données
         }

         // Envoie le PDF au navigateur pour téléchargement
         $pdf->Output('D', $filename . '.pdf');
     }

    /**
     * Affiche la page d'importation de fichier CSV.
     */
    public function showImportAction() {
        // Rend la vue d'importation
        $this->render('import_view');
    }

    /**
     * Traite le fichier CSV téléversé pour importer des codes géo.
     */
    public function handleImportAction() {
        // Vérifie si un fichier a été envoyé et s'il n'y a pas d'erreur
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csvFile']) && $_FILES['csvFile']['error'] == UPLOAD_ERR_OK) {
            $csvFile = $_FILES['csvFile']['tmp_name'];
            $fileHandle = fopen($csvFile, 'r'); // Ouvre le fichier en lecture

            // Lit l'en-tête pour mapper les colonnes
            $header = fgetcsv($fileHandle, 0, ';', '"', '\\');
            if (!$header) {
                 $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Impossible de lire l\'en-tête du fichier CSV.'];
                 header('Location: index.php?action=showImport');
                 exit();
            }
            // Normalise les noms de colonnes (minuscules, trim)
            $header = array_map(fn($h) => trim(strtolower($h)), $header);
            $requiredColumns = ['code_geo', 'libelle', 'univers', 'zone'];
             if (count(array_intersect($requiredColumns, $header)) !== count($requiredColumns)) {
                  $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'Le fichier CSV doit contenir au moins les colonnes : ' . implode(', ', $requiredColumns) . '.'];
                  fclose($fileHandle);
                  header('Location: index.php?action=showImport');
                  exit();
             }


            $allRows = [];
            $codesToCheck = [];

            // Lit toutes les lignes du CSV
            while (($row = fgetcsv($fileHandle, 0, ';', '"', '\\')) !== false) {
                // Vérifie que le nombre de colonnes correspond à l'en-tête
                if (count($row) === count($header)) {
                    $data = array_combine($header, $row);
                    // Vérifie que le code_geo n'est pas vide avant de l'ajouter
                    if (!empty(trim($data['code_geo']))) {
                        $allRows[] = $data;
                        $codesToCheck[] = trim($data['code_geo']); // Ajoute pour vérifier les duplicatas en BDD
                    }
                } else {
                     // Log ou ignorer les lignes malformées
                     error_log("Ligne CSV ignorée (nombre de colonnes incorrect): " . implode(';', $row));
                }
            }
            fclose($fileHandle); // Ferme le fichier

            // Récupère les codes qui existent déjà en BDD
            $existingCodes = $this->geoCodeManager->getExistingCodes($codesToCheck);

            $codesToInsert = [];
            $duplicateCodes = [];

            // Sépare les codes à insérer et les duplicatas
            foreach ($allRows as $rowData) {
                $currentCode = trim($rowData['code_geo']);
                // Si le code existe déjà en BDD OU si on l'a déjà ajouté dans ce batch
                if (in_array($currentCode, $existingCodes)) {
                    $duplicateCodes[] = $currentCode;
                } else {
                    $codesToInsert[] = [
                        'code_geo'    => $currentCode,
                        'libelle'     => $rowData['libelle'] ?? '',
                        'univers'     => $rowData['univers'] ?? 'Indéfini',
                        'zone'        => $rowData['zone'] ?? 'vente', // Zone par défaut si absente
                        'commentaire' => $rowData['commentaire'] ?? null
                    ];
                    // Ajoute le code à la liste des existants pour éviter les doublons dans le fichier lui-même
                    $existingCodes[] = $currentCode;
                }
            }

            $insertedCount = 0;
            // Si des codes sont à insérer, appelle le manager
            if (!empty($codesToInsert)) {
                $insertedCount = $this->geoCodeManager->createMultipleGeoCodes($codesToInsert, $this->universManager);
            }

            // Construit le message de retour pour l'utilisateur
            $message = "<strong>Rapport d'importation :</strong><br>"
                     . $insertedCount . " nouveau(x) code(s) importé(s).<br>";

            if (!empty($duplicateCodes)) {
                $uniqueDuplicates = array_unique($duplicateCodes);
                $message .= "<strong>" . count($uniqueDuplicates) . " code(s) existai(en)t déjà (ou étaient en double dans le fichier) et ont été ignoré(s) :</strong><br><ul>";
                foreach($uniqueDuplicates as $dup) {
                    $message .= "<li>" . htmlspecialchars($dup) . "</li>";
                }
                $message .= "</ul>";
            }

            $_SESSION['flash_message'] = ['type' => $insertedCount > 0 ? 'success' : 'warning', 'message' => $message];
        } elseif (isset($_FILES['csvFile'])) {
            // Gère les erreurs de téléversement
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Erreur lors de l'envoi du fichier CSV (Code: {$_FILES['csvFile']['error']})."];
        } else {
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => "Aucun fichier CSV n'a été envoyé."];
        }

        // Redirige vers la liste après l'importation
        header('Location: index.php?action=list');
        exit();
    }

    // ==========================================================
    // == SECTION IMPRESSION ÉTIQUETTES (PDF maintenant) ======
    // ==========================================================

    /**
     * Affiche la page des options d'impression (maintenant pour PDF).
     * C'EST CETTE MÉTHODE QUI EST APPELÉE PAR action=printLabels
     */
    public function showPrintOptionsAction() {
        // Récupère la liste des univers pour les filtres du formulaire
        $universList = $this->universManager->getAllUnivers();
        // Rend la vue print_options_view.php, qui contient le formulaire et charge le JS pdf-label-generator.js
        $this->render('print_options_view', ['universList' => $universList]);
    }

    /**
     * Récupère les données des codes géo pour les univers spécifiés et les renvoie en JSON.
     * Utilisé par le générateur PDF côté client (pdf-label-generator.js).
     */
    public function getCodesForPrintAction() {
        header('Content-Type: application/json');
        $universIds = $_GET['univers_ids'] ?? []; // Récupère les IDs depuis les paramètres GET

        if (empty($universIds)) {
            echo json_encode([]); // Renvoie un tableau vide si aucun univers n'est sélectionné
            exit();
        }

        // Assure que les IDs sont des entiers
        $universIds = array_map('intval', $universIds);

        // Utilise la méthode existante pour récupérer les codes
        // S'assure que la méthode renvoie bien les champs nécessaires (code_geo, libelle, univers, commentaire)
        $geoCodes = $this->geoCodeManager->getGeoCodesByUniversIds($universIds);

        echo json_encode($geoCodes);
        exit();
    }


    /**
     * Affiche la page pour imprimer une seule étiquette (utilise encore l'ancienne méthode HTML/JS).
     */
    public function printSingleLabelAction() {
       $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            // Redirige ou affiche une erreur si ID invalide
            $_SESSION['flash_message'] = ['type' => 'danger', 'message' => 'ID de code géo invalide pour l\'impression.'];
            header('Location: index.php?action=list');
            exit();
        }

        $geoCode = $this->geoCodeManager->getGeoCodeById($id); // Récupère le code

        if (!$geoCode || $geoCode['deleted_at'] !== null) {
             // Redirige ou affiche une erreur si non trouvé ou supprimé
            $_SESSION['flash_message'] = ['type' => 'warning', 'message' => 'Code Géo non trouvé ou dans la corbeille.'];
            header('Location: index.php?action=list');
            exit();
        }

        // Récupère le nom de l'univers associé
        $univers = $this->universManager->getUniversById($geoCode['univers_id']);
        $geoCode['univers'] = $univers['nom'] ?? 'N/A'; // Ajoute le nom au tableau

        // Inclut la vue spécifique pour une seule étiquette
        // Note: Cette vue utilise l'ancien qrcode.js et la méthode d'impression HTML.
        require __DIR__ . '/../views/print_single_view.php';
        exit(); // Termine le script après avoir affiché la vue
    }

    // ==========================================================
    // == AUTRES MÉTHODES UTILES ===============================
    // ==========================================================

    /**
     * Retourne tous les codes géo actifs avec leurs positions en JSON.
     * Utilisé par l'éditeur de plan (plan.js) pour l'initialisation.
     */
    public function getAllCodesJsonAction() {
       header('Content-Type: application/json'); // Définit le type de contenu
        // Récupère tous les codes avec leurs positions
        $geoCodes = $this->geoCodeManager->getAllGeoCodesWithPositions();
        // Encode et affiche le résultat en JSON
        echo json_encode($geoCodes);
        exit(); // Termine le script
    }
}
