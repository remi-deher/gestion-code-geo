<nav class="navbar">
    <div class="navbar-brand">Gestion Géo 🏬</div>
    <div class="navbar-links">
        <a href="index.php?action=list">Liste des codes</a>
        <a href="index.php?action=create">Ajouter un code</a>
        <a href="index.php?action=showBatchCreate">Ajout par lot</a>
        <a href="index.php?action=plan">Plan du magasin</a>
        <a href="index.php?action=listUnivers">Gérer les univers</a>
        <a href="index.php?action=listPlans">Gérer les plans</a> <a href="index.php?action=showImport">Importer</a>
        <a href="index.php?action=export">Exporter</a>
    </div>
    <div class="navbar-controls">
        <input type="search" id="recherche" placeholder="Rechercher...">
        
        <div class="print-menu">
             <button id="print-btn">🖨️ Imprimer</button>
             <div class="print-options">
                <a href="javascript:window.print();">Imprimer la vue actuelle</a>
                <a href="index.php?action=printLabels" target="_blank">Imprimer des étiquettes</a>
             </div>
        </div>
    </div>
</nav>
