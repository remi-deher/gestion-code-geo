// Fichier: public/js/modules/editorActions.js
/**
 * Gère les actions principales de l'éditeur : Sauvegarde, Impression, Export (PNG et SVG).
 */

// Importer dynamiquement la fonction showToast pour les notifications
async function showToast(message, type) {
    try {
        const { showToast } = await import('./utils.js');
        showToast(message, type);
    } catch (e) {
        console.error("Erreur chargement showToast:", e);
        alert(message); // Fallback
    }
}

/**
 * Configure les écouteurs d'événements pour les boutons d'action principaux.
 * @param {fabric.Canvas} canvas - L'instance du canvas Fabric.
 * @param {HTMLButtonElement} saveBtn - Le bouton Enregistrer.
 * @param {HTMLButtonElement} printBtn - Le bouton Imprimer.
 * @param {HTMLButtonElement} exportBtn_IGNORED - Ce paramètre est ignoré, on cherche les ID spécifiques.
 */
export function setupEditorActions(canvas, saveBtn, printBtn, exportBtn_IGNORED) {

    // --- Action Sauvegarder (Inchangée) ---
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            console.log("Action: Clic sur Enregistrer");
            const originalHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enreg...`;

            try {
                const propertiesToInclude = [ 'customData', 'isGuide' ];
                const canvasObject = canvas.toObject(propertiesToInclude);

                canvasObject.objects = canvasObject.objects.filter(obj => 
                    obj.customData?.type !== 'geoCode' && 
                    obj.isGuide !== true
                );

                const jsonData = JSON.stringify(canvasObject);
                const planId = window.planData?.currentPlan?.id;
                const saveUrl = window.planData?.saveDrawingUrl;

                if (!planId || !saveUrl) {
                    throw new Error("ID du plan ou URL de sauvegarde non définis.");
                }

                const response = await fetch(saveUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify({
                        plan_id: planId,
                        drawing_data: jsonData
                    })
                });

                if (!response.ok) {
                    let errorMsg = `Erreur HTTP ${response.status}`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) { /* Ignorer */ }
                    throw new Error(errorMsg);
                }

                const result = await response.json();
                if (result.success) {
                    console.log("Action: Sauvegarde réussie.");
                    showToast("Plan enregistré avec succès !", 'success');
                    // Informer l'historique qu'un état propre a été sauvegardé (si nécessaire)
                    // (historyManager gère son propre état via les événements, donc pas besoin ici)
                } else {
                    throw new Error(result.error || "Erreur inconnue lors de la sauvegarde.");
                }

            } catch (error) {
                console.error("Erreur lors de la sauvegarde:", error);
                showToast(`Erreur de sauvegarde : ${error.message}`, 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalHtml;
            }
        });
    } else {
        console.warn("Actions: Bouton Sauvegarder non trouvé.");
    }
    
    // --- Action Imprimer (Inchangée) ---
    if (printBtn) {
         printBtn.addEventListener('click', () => {
            const planId = window.planData?.currentPlan?.id;
            if (planId) {
                window.open(`index.php?action=printPlan&id=${planId}`, '_blank');
            }
        });
    }

    // --- NOUVEAU: Action Exporter PNG ---
    const exportPngBtn = document.getElementById('export-plan-png-btn');
    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => {
             console.log("Action: Clic sur Exporter (PNG)");
             try {
                 // S'assurer que les guides ne sont pas exportés
                 const guide = canvas.getObjects().find(o => o.isGuide);
                 if (guide) guide.set({ visible: false });
                 
                 const dataUrl = canvas.toDataURL({
                     format: 'png',
                     quality: 1.0,
                     multiplier: 2 // Exporter à 2x résolution
                 });
                 
                 if (guide) guide.set({ visible: true }); // Ré-afficher
                 
                 const link = document.createElement('a');
                 const filename = (window.planData?.currentPlan?.nom || 'plan') + '.png';
                 link.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
                 link.href = dataUrl;
                 document.body.appendChild(link);
                 link.click();
                 document.body.removeChild(link);
                 showToast("Plan exporté en PNG.", 'info');
             } catch (e) {
                 console.error("Erreur export PNG:", e);
                 showToast("Erreur lors de l'exportation en PNG.", "danger");
             }
        });
    } else {
        console.warn("Actions: Bouton Exporter PNG non trouvé.");
    }

    // --- NOUVEAU: Action Exporter SVG ---
    const exportSvgBtn = document.getElementById('export-plan-svg-btn');
    if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', () => {
            console.log("Action: Clic sur Exporter (SVG)");
            try {
                // Exclure les guides et le fond (qui est géré par le loader)
                const originalObjects = canvas.getObjects();
                const objectsToExport = originalObjects.filter(obj => 
                    !obj.isGuide && 
                    !obj.isBackground && 
                    obj.customData?.type !== 'geoCode' // Exclure aussi les codes géo
                );

                // Créer un SVG à partir de ces objets filtrés
                const svgData = canvas.toSVG({
                    suppressPreamble: true, // Retirer l'en-tête XML
                    viewBox: {
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height
                    }
                }, (svgString) => {
                    // Replacer uniquement les objets filtrés dans le <svg>
                    // Cette approche est complexe. Plus simple :
                    // On clone le canvas pour l'export.
                    
                    // On cache les objets non désirés
                    originalObjects.forEach(obj => {
                        if (obj.isGuide || obj.isBackground || obj.customData?.type === 'geoCode') {
                            obj.set({ visible: false });
                        }
                    });
                    
                    const svgStringClean = canvas.toSVG({ 
                         suppressPreamble: true,
                         viewBox: { x: 0, y: 0, width: canvas.width, height: canvas.height }
                    });

                    // On ré-affiche les objets
                     originalObjects.forEach(obj => {
                        if (obj.isGuide || obj.isBackground || obj.customData?.type === 'geoCode') {
                            obj.set({ visible: true });
                        }
                    });
                    canvas.renderAll();

                    return svgStringClean;
                });
                
                // Créer le blob et télécharger
                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const filename = (window.planData?.currentPlan?.nom || 'plan') + '.svg';
                link.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                 
                showToast("Plan exporté en SVG.", 'info');

            } catch (e) {
                console.error("Erreur export SVG:", e);
                showToast("Erreur lors de l'exportation en SVG.", "danger");
            }
        });
    } else {
         console.warn("Actions: Bouton Exporter SVG non trouvé.");
    }

    console.log("Actions: Configuration des boutons terminée.");
}
