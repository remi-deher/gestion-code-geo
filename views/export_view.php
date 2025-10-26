<?php $title = 'Exporter les Données'; ?>

<?php ob_start(); // Début capture pour styles spécifiques si nécessaire ?>
<?php /* Normalement, _export.css est chargé via main.css, donc pas besoin ici */ ?>
<?php $head_styles = ob_get_clean(); ?>

<div class="container">
    <form id="export-options-form" class="export-options-form needs-validation" novalidate>
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h1 class="mb-0"><i class="bi bi-download"></i> Exporter les Codes Géo</h1>
            <button type="button" id="export-button" class="btn btn-primary btn-lg">
                <i class="bi bi-file-earmark-arrow-down-fill"></i> Lancer l'export
            </button>
        </div>

        <div class="row g-4">
            <div class="col-lg-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-header d-flex align-items-center bg-light border-bottom">
                        <span class="step-number me-2">1</span>
                        <h5 class="mb-0">Filtres (Optionnel)</h5>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <p class="card-text text-muted small mb-3">Ne sélectionnez rien pour tout exporter.</p>

                        <div class="mb-4">
                            <label class="form-label fw-bold">Par Zone :</label>
                            <div class="form-check">
                                <input class="form-check-input zone-filter" type="checkbox" name="zones[]" value="vente" id="zone_vente" checked>
                                <label class="form-check-label" for="zone_vente">Zone de Vente</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input zone-filter" type="checkbox" name="zones[]" value="reserve" id="zone_reserve" checked>
                                <label class="form-check-label" for="zone_reserve">Réserve</label>
                            </div>
                        </div>

                        <div class="flex-grow-1 d-flex flex-column">
                            <label class="form-label fw-bold">Par Univers :</label>
                            <div class="d-flex gap-2 mb-2">
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="select-all-univers">Tout cocher</button>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="deselect-all-univers">Tout décocher</button>
                            </div>
                            <div id="univers-checkbox-list" class="border p-3 rounded bg-light flex-grow-1" style="max-height: 200px; overflow-y: auto;">
                                <?php if (empty($universList)): ?>
                                    <p class="text-muted small mb-0">Aucun univers trouvé.</p>
                                <?php else: ?>
                                    <?php foreach ($universList as $univers): ?>
                                        <div class="form-check" data-zone="<?= htmlspecialchars($univers['zone_assignee']) ?>">
                                            <input class="form-check-input" type="checkbox" name="univers_ids[]" value="<?= $univers['id'] ?>" id="univers-<?= $univers['id'] ?>" checked>
                                            <label class="form-check-label" for="univers-<?= $univers['id'] ?>"><?= htmlspecialchars($univers['nom']) ?></label>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-header d-flex align-items-center bg-light border-bottom">
                        <span class="step-number me-2">2</span>
                        <h5 class="mb-0">Options d'Export</h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <label class="form-label fw-bold">Colonnes à inclure :</label>
                            <div class="columns-grid">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="code_geo" id="col_code_geo" checked>
                                    <label class="form-check-label" for="col_code_geo">Code Géo</label>
                                </div>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="libelle" id="col_libelle" checked>
                                    <label class="form-check-label" for="col_libelle">Libellé</label>
                                </div>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="univers" id="col_univers" checked>
                                    <label class="form-check-label" for="col_univers">Univers</label>
                                </div>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="zone" id="col_zone" checked>
                                    <label class="form-check-label" for="col_zone">Zone</label>
                                </div>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" name="columns[]" value="commentaire" id="col_commentaire">
                                    <label class="form-check-label" for="col_commentaire">Commentaire</label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="form-label fw-bold">Format :</label>
                             <div class="form-check">
                                <input class="form-check-input" type="radio" name="format" id="format_csv" value="csv" checked required>
                                <label class="form-check-label" for="format_csv">
                                    <i class="bi bi-file-earmark-spreadsheet"></i> CSV (compatible Excel)
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="format" id="format_xlsx" value="xlsx" required>
                                <label class="form-check-label" for="format_xlsx">
                                     <i class="bi bi-file-excel"></i> Excel (.xlsx)
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="format" id="format_pdf" value="pdf" required>
                                <label class="form-check-label" for="format_pdf">
                                     <i class="bi bi-file-earmark-pdf"></i> PDF (Tableau simple)
                                </label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="filename" class="form-label fw-bold">Nom du fichier :</label>
                            <input type="text" id="filename" name="filename" class="form-control" value="export_codes_geo_<?= date('Y-m-d') ?>" required pattern="^[a-zA-Z0-9-_]+$">
                            <div class="invalid-feedback">Le nom ne peut contenir que lettres, chiffres, tirets et underscores.</div>
                            <div class="form-text">L'extension sera ajoutée automatiquement.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
</div>

<?php ob_start(); // Début capture pour le script JS ?>
<script>
document.addEventListener('DOMContentLoaded', () => {
    // --- Logique des filtres (inchangée) ---
    const selectAllBtn = document.getElementById('select-all-univers');
    const deselectAllBtn = document.getElementById('deselect-all-univers');
    const universCheckboxes = document.querySelectorAll('#univers-checkbox-list .form-check-input');
    const zoneFilters = document.querySelectorAll('.zone-filter');
    const universContainers = document.querySelectorAll('#univers-checkbox-list .form-check');

    if(selectAllBtn) selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#univers-checkbox-list .form-check:not([style*="display: none"]) .form-check-input').forEach(cb => cb.checked = true);
    });
    if(deselectAllBtn) deselectAllBtn.addEventListener('click', () => {
        universCheckboxes.forEach(cb => cb.checked = false);
    });

    function filterUniverses() {
        const selectedZones = new Set(
            Array.from(zoneFilters)
                 .filter(cb => cb.checked)
                 .map(cb => cb.value)
        );
        let hasVisibleUniverses = false;
        universContainers.forEach(container => {
            const isVisible = selectedZones.size === 0 || selectedZones.has(container.dataset.zone);
            container.style.display = isVisible ? 'block' : 'none';
            if (isVisible) hasVisibleUniverses = true;
            if (!isVisible) container.querySelector('input[type="checkbox"]').checked = false;
        });
        if(selectAllBtn) selectAllBtn.disabled = !hasVisibleUniverses;
    }
    zoneFilters.forEach(checkbox => checkbox.addEventListener('change', filterUniverses));
    filterUniverses(); // Appel initial

    // --- Logique d'Export Client-Side ---
    const form = document.getElementById('export-options-form');
    const exportButton = document.getElementById('export-button');

    exportButton.addEventListener('click', async (event) => {
        event.preventDefault(); // Empêche la soumission classique
        event.stopPropagation();

        form.classList.add('was-validated');
        if (!form.checkValidity()) {
            console.warn("Formulaire d'export invalide.");
             // showToast("Veuillez corriger les erreurs dans le formulaire.", "warning"); // Si vous avez une fonction showToast
            return;
        }

        const selectedZones = Array.from(form.querySelectorAll('input[name="zones[]"]:checked')).map(cb => cb.value);
        const selectedUniversIds = Array.from(form.querySelectorAll('input[name="univers_ids[]"]:checked')).map(cb => cb.value);
        const selectedColumns = Array.from(form.querySelectorAll('input[name="columns[]"]:checked')).map(cb => cb.value);
        const selectedFormat = form.querySelector('input[name="format"]:checked').value;
        const filenameBase = form.querySelector('#filename').value || 'export_codes_geo';

        if (selectedColumns.length === 0) {
            alert("Veuillez sélectionner au moins une colonne à exporter.");
            return;
        }

        exportButton.disabled = true;
        exportButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Chargement...`;

        try {
            console.log("Appel AJAX pour récupérer les données d'export...");
            const response = await fetch('index.php?action=handleExport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ zones: selectedZones, univers_ids: selectedUniversIds })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
                throw new Error(errorData.error || `Erreur serveur ${response.status}`);
            }
            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Erreur lors de la récupération des données.");
            }
            console.log(`Données reçues pour export: ${result.data.length} lignes.`);

            const dataToExport = result.data.map(row => {
                const filteredRow = {};
                selectedColumns.forEach(colKey => { filteredRow[colKey] = row[colKey] ?? ''; });
                return filteredRow;
            });

            // --- Génération du fichier ---
            if (selectedFormat === 'csv') {
                generateCsv(dataToExport, selectedColumns, filenameBase + '.csv');
            } else if (selectedFormat === 'pdf') {
                generatePdfTable(dataToExport, selectedColumns, filenameBase + '.pdf');
            } else if (selectedFormat === 'xlsx') {
                generateXlsx(dataToExport, selectedColumns, filenameBase + '.xlsx');
            } else {
                 throw new Error("Format d'export inconnu.");
            }

        } catch (error) {
            console.error("Erreur lors de l'export:", error);
            alert(`Erreur lors de l'exportation : ${error.message}`);
             // showToast(`Erreur d'exportation: ${error.message}`, "danger"); // Si fonction showToast existe
        } finally {
            exportButton.disabled = false;
            exportButton.innerHTML = '<i class="bi bi-file-earmark-arrow-down-fill"></i> Lancer l\'export';
            form.classList.remove('was-validated');
        }
    });

    // --- Fonctions de génération de fichiers ---

    function generateCsv(data, columns, filename) {
        console.log("Génération CSV...");
        if (typeof Papa === 'undefined') { alert("Erreur: PapaParse n'est pas chargé."); return; }
        const csvData = [
            columns.map(col => getColumnHeader(col)),
            ...data.map(row => columns.map(col => row[col]))
        ];
        const csv = Papa.unparse(csvData, { delimiter: ";" });
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }); // BOM pour Excel
        triggerDownload(blob, filename);
        console.log("CSV généré.");
    }

    function generatePdfTable(data, columns, filename) {
         console.log("Génération PDF Tableau...");
         if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF.API.autoTable === 'undefined') {
             alert("Erreur: jsPDF ou jsPDF-AutoTable n'est pas chargé."); return;
         }
         const { jsPDF } = window.jspdf; // Accéder via l'objet global
         const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); // Paysage par défaut pour tableaux

         const tableHeaders = columns.map(col => getColumnHeader(col));
         // Convertit toutes les données en string pour éviter les erreurs autoTable
         const tableBody = data.map(row => columns.map(col => String(row[col] ?? '')));

         doc.autoTable({
             head: [tableHeaders],
             body: tableBody,
             startY: 15, // Marge haute
             margin: { top: 15, right: 10, bottom: 10, left: 10 },
             styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' }, // overflow gère le retour à la ligne
             headStyles: { fillColor: [0, 123, 255], textColor: 255, fontStyle: 'bold' }, // Bleu primaire Bootstrap
             theme: 'grid', // Style de grille
             didDrawPage: function (data) {
                 // Numéro de page
                 doc.setFontSize(8);
                 doc.setTextColor(150);
                 const pageStr = 'Page ' + doc.internal.getNumberOfPages();
                 doc.text(pageStr, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 5, { align: 'right'});
             }
         });
         doc.save(filename);
         console.log("PDF Tableau généré.");
    }

    function generateXlsx(data, columns, filename) {
        console.log("Génération XLSX...");
        if (typeof XLSX === 'undefined') { alert("Erreur: SheetJS (XLSX) n'est pas chargé."); return; }
        // Reformater pour que les clés soient les en-têtes lisibles
        const dataForSheet = data.map(row => {
            const newRow = {};
            columns.forEach(colKey => { newRow[getColumnHeader(colKey)] = row[colKey]; });
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: columns.map(col => getColumnHeader(col)) });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Codes Géo");

        // Ajuster largeur colonnes (approximatif)
        const colWidths = columns.map(col => ({ wch: Math.max((getColumnHeader(col).length || 10), 15) })); // Max entre longueur titre et 15
        worksheet["!cols"] = colWidths;

        XLSX.writeFile(workbook, filename);
        console.log("XLSX généré.");
    }

    // Fonction utilitaire pour obtenir un nom de colonne lisible
    function getColumnHeader(columnKey) {
        const headers = { 'code_geo': 'Code Géo', 'libelle': 'Libellé', 'univers': 'Univers', 'zone': 'Zone', 'commentaire': 'Commentaire' };
        return headers[columnKey] || columnKey.charAt(0).toUpperCase() + columnKey.slice(1).replace('_', ' '); // Fallback
    }

    // Fonction utilitaire pour déclencher le téléchargement
    function triggerDownload(blob, filename) {
        const link = document.createElement('a');
        if (link.download !== undefined) { // Vérifie si download est supporté
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            // Fallback pour IE ou anciens navigateurs
            alert("Le téléchargement direct n'est pas supporté par votre navigateur. Essayez de mettre à jour ou d'utiliser un autre navigateur.");
        }
    }

    // --- Validation Bootstrap (inchangée) ---
    const validationForm = document.querySelector('.needs-validation');
    if (validationForm) {
        // Validation au clic, avant l'appel AJAX
        exportButton.addEventListener('click', () => {
             if (!validationForm.checkValidity()) {
                 validationForm.classList.add('was-validated');
             }
         });
    }

}); // Fin DOMContentLoaded
</script>
<?php $body_scripts = ob_get_clean();
