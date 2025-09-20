<?php $title = 'Importer des Codes Géo'; ?>

<div class="container">
    <section id="import-form">
        <h2>Importer des codes géo depuis un fichier CSV</h2>
        <p>Le fichier CSV doit contenir les colonnes : <strong>code_geo, libelle, univers, zone, commentaire</strong>.</p>
        <form action="index.php?action=handleImport" method="POST" enctype="multipart/form-data">
             <div class="form-group">
                <label for="csvFile">Choisir un fichier CSV</label>
                <input type="file" id="csvFile" name="csvFile" accept=".csv" required>
            </div>
            <button type="submit">Importer</button>
        </form>
    </section>
</div>
