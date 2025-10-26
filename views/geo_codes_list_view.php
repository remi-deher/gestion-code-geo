<?php $title = 'Liste des Codes Géo'; ?>
<?php
// On injecte le chemin vers app.js ici, car cette vue en dépend fortement
// Assurez-vous que layout.php charge bien les dépendances JS avant $body_scripts
ob_start();
?>
<script src="js/app.js" defer></script> <?php // 'defer' pour attendre que le DOM soit prêt ?>
<?php $body_scripts = ob_get_clean(); ?>

<div class="container">
    <section id="classeur">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h2 class="mb-0">📚 Classeur des emplacements</h2>

            <div class="d-flex gap-2 flex-wrap"> {/* Ajout de flex-wrap */}
                <a href="index.php?action=printLabels" class="btn btn-outline-secondary">
                    <i class="bi bi-printer-fill"></i> Imprimer des étiquettes
                </a>
                 <a href="index.php?action=create" class="btn btn-primary">
                    <i class="bi bi-plus-lg"></i> Ajouter un code
                </a>
                <a href="index.php?action=trash" class="btn btn-outline-secondary">
                    <i class="bi bi-trash"></i> Corbeille
                </a>
                <a href="index.php?action=fullHistory" class="btn btn-outline-info">
                    <i class="bi bi-clock-history"></i> Historique Global
                </a>
            </div>
        </div>

        <div class="filter-control-panel card shadow-sm mb-4">
             <div class="card-body">
                <button class="btn btn-light w-100 d-lg-none filters-offcanvas-trigger mb-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvas">
                    <i class="bi bi-funnel-fill"></i> Afficher les filtres et options
                </button>
                <div class="d-none d-lg-block desktop-filters">
                    <div class="row g-3 align-items-center">
                         <div class="col-lg-5">
                            <strong class="me-3">Zone :</strong>
                            <div class="btn-group btn-group-sm zone-tabs" role="group" aria-label="Filtre par zone">
                                <button type="button" class="btn btn-outline-secondary zone-tab active" data-zone="all">Toutes</button>
                                <button type="button" class="btn btn-outline-secondary zone-tab" data-zone="vente">Vente</button>
                                <button type="button" class="btn btn-outline-secondary zone-tab" data-zone="reserve">Réserve</button>
                             </div>
                        </div>
                        <div class="col-lg-7 d-flex align-items-center gap-2" id="filtres-univers">
                             <strong class="me-2">Univers :</strong>
                            <div class="filter-pills flex-grow-1 d-flex flex-wrap align-items-center gap-1">
                                <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                                <?php if (!empty($univers)): foreach ($univers as $u): ?>
                                    <span class="badge filter-pill text-bg-light border"
                                          data-filter="<?= htmlspecialchars($u['nom'] ?? '') ?>"
                                          data-zone="<?= htmlspecialchars($u['zone_assignee'] ?? '') ?>"
                                          style="cursor: pointer;">
                                        <?= htmlspecialchars($u['nom'] ?? '') ?>
                                    </span>
                                <?php endforeach; endif; ?>
                            </div>
                        </div>
                    </div>
                     <div class="row g-3 align-items-center mt-2">
                         <div class="col-lg-5">
                             <div class="input-group input-group-sm">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="search" id="listjs-search-input" class="form-control listjs-search" placeholder="Rechercher code, libellé...">
                            </div>
                        </div>
                        <div class="col-lg-7 d-flex align-items-center gap-2">
                             <label for="sort-by" class="form-label mb-0 fw-bold me-2">Trier par :</label>
                            <select id="sort-by" class="form-select form-select-sm sort flex-grow-1" data-sort="code_geo">
                                <option value="code_geo">Code Géo (A-Z)</option>
                                <option value="libelle">Libellé (A-Z)</option>
                                <option value="univers">Univers (A-Z)</option>
                                <option value="zone">Zone (A-Z)</option>
                             </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="fiches-list-js"> {/* Conteneur pour List.js */}
            <div class="list d-flex flex-column gap-3"> {/* La classe 'list' est essentielle pour List.js */}
                <?php if (empty($geoCodes)): ?>
                    <div class="alert alert-info">Aucun code géo n'a été trouvé. <a href="index.php?action=create">Ajoutez-en un !</a></div>
                <?php else: ?>
                    <?php
                    // Tri initial par Code Géo par défaut (ou selon le selecteur si besoin)
                    usort($geoCodes, function($a, $b) {
                        return strnatcasecmp($a['code_geo'] ?? '', $b['code_geo'] ?? '');
                    });

                    foreach ($geoCodes as $code):
                    ?>
                        <div class="geo-card card card-body"
                             data-zone="<?= htmlspecialchars($code['zone'] ?? '') ?>"
                             data-univers="<?= htmlspecialchars($code['univers_nom'] ?? '') ?>"> {/* Données pour filtres JS */}

                            {/* Champs cachés pour List.js */}
                            <span class="univers" style="display:none;"><?= htmlspecialchars($code['univers_nom'] ?? '') ?></span>
                            <span class="zone" style="display:none;"><?= htmlspecialchars($code['zone'] ?? '') ?></span>

                            <div class="row g-3 align-items-center">
                                <div class="col-auto geo-card-qr" data-code="<?= htmlspecialchars($code['code_geo'] ?? '') ?>">
                                    {/* Le QR code sera généré ici par JS */}
                                </div>

                                 <div class="col geo-card-info">
                                    <div class="info-code mb-1">
                                        <strong class="code_geo fs-5 text-primary"><?= htmlspecialchars($code['code_geo'] ?? '') ?></strong>
                                        <span class="zone-badge ms-2 zone-<?= htmlspecialchars($code['zone'] ?? '') ?>"><?= htmlspecialchars($code['zone'] ?? '') ?></span>
                                    </div>
                                    <div class="info-libelle libelle mb-1"><?= htmlspecialchars($code['libelle'] ?? '') ?></div>
                                     <div class="text-muted small">
                                         <i class="bi bi-tag-fill" style="color: <?= htmlspecialchars($code['univers_color'] ?? '#6c757d'); ?>;"></i>
                                         <span class="univers-label"><?= htmlspecialchars($code['univers_nom'] ?? 'N/A') ?></span>
                                     </div>
                                    <?php if (!empty($code['commentaire'])): ?>
                                        <div class="info-comment text-muted small mt-1">
                                            <i class="bi bi-chat-left-text"></i> <?= htmlspecialchars($code['commentaire']) ?>
                                        </div>
                                    <?php endif; ?>
                                </div>

                                 <div class="col-md-auto geo-card-actions">
                                     <div class="d-grid d-md-flex gap-2 justify-content-md-end">
                                        <a href="index.php?action=edit&id=<?= $code['id'] ?>" class="btn btn-sm btn-warning" title="Modifier"><i class="bi bi-pencil-fill"></i><span class="btn-text d-none d-md-inline"> Modifier</span></a>
                                        <a href="index.php?action=history&id=<?= $code['id'] ?>" class="btn btn-sm btn-info" title="Historique"><i class="bi bi-clock-history"></i><span class="btn-text d-none d-md-inline"> Historique</span></a>
                                        <button type="button" class="btn btn-sm btn-secondary btn-print-single" data-id="<?= $code['id'] ?>" title="Imprimer l'étiquette">
                                            <i class="bi bi-printer-fill"></i><span class="btn-text d-none d-md-inline"> Imprimer</span>
                                        </button>
                                        <a href="index.php?action=delete&id=<?= $code['id'] ?>" class="btn btn-sm btn-danger" title="Mettre à la corbeille" onclick="return confirm('Mettre ce code à la corbeille ?');"><i class="bi bi-trash-fill"></i><span class="btn-text d-none d-md-inline"> Corbeille</span></a>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
             <ul class="pagination justify-content-center mt-4"></ul> {/* Pagination pour List.js si besoin */}
        </div>

    </section>
</div>

<div class="offcanvas offcanvas-start" tabindex="-1" id="filtersOffcanvas" aria-labelledby="filtersOffcanvasLabel">
    <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="filtersOffcanvasLabel"><i class="bi bi-funnel-fill"></i> Filtres & Options</h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body">
        <div class="mb-3">
             <label for="mobile-search-input" class="form-label fw-bold">Rechercher</label>
            <input type="search" id="mobile-search-input" class="form-control listjs-search" placeholder="Code, libellé...">
        </div>
         <div class="mb-3">
            <label class="form-label fw-bold">Zone :</label>
            <div class="d-grid gap-2 zone-tabs-mobile">
                <button type="button" class="btn btn-outline-secondary zone-tab active" data-zone="all">Toutes</button>
                <button type="button" class="btn btn-outline-secondary zone-tab" data-zone="vente">Vente</button>
                <button type="button" class="btn btn-outline-secondary zone-tab" data-zone="reserve">Réserve</button>
            </div>
        </div>
        <div class="mb-3" id="filtres-univers-mobile">
            <label class="form-label fw-bold">Univers :</label>
            <div class="filter-pills d-flex flex-wrap align-items-center gap-2">
                <span class="badge filter-pill active" data-filter="all">Tout voir</span>
                <?php if (!empty($univers)): foreach ($univers as $u): ?>
                    <span class="badge filter-pill text-bg-light border"
                          data-filter="<?= htmlspecialchars($u['nom'] ?? '') ?>"
                          data-zone="<?= htmlspecialchars($u['zone_assignee'] ?? '') ?>"
                          style="cursor: pointer;">
                        <?= htmlspecialchars($u['nom'] ?? '') ?>
                    </span>
                <?php endforeach; endif; ?>
            </div>
        </div>
         <div class="mb-3">
            <label for="mobile-sort-by" class="form-label fw-bold">Trier par :</label>
            <select id="mobile-sort-by" class="form-select sort">
                <option value="code_geo">Code Géo (A-Z)</option>
                <option value="libelle">Libellé (A-Z)</option>
                <option value="univers">Univers (A-Z)</option>
                <option value="zone">Zone (A-Z)</option>
            </select>
        </div>
    </div>
</div>
