// Fichier: public/js/modules/editorActions.js
/**
 * Gère les actions principales de l'éditeur : Sauvegarde, Impression, Export.
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
 * @param {HTMLButtonElement} printBtn - Le bouton Imprimer (optionnel).
 * @param {HTMLButtonElement} exportBtn - Le bouton Exporter (optionnel).
 */
export function setupEditorActions(canvas, saveBtn, printBtn, exportBtn) {

// --- Action Sauvegarder ---
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            console.log("Action: Clic sur Enregistrer");
            const originalHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enreg...`;

            try {
                // Propriétés personnalisées à inclure dans la sérialisation de chaque objet
                // (afin que customData soit disponible pour le filtrage).
                const propertiesToInclude = [
                     'customData', // Inclure notre objet de données personnalisé
                     'isGuide'    // Inclure la propriété des guides/bordures
                ];
                
                // 1. Récupérer l'objet JavaScript du canevas, incluant les propriétés personnalisées
                // La méthode toObject() inclut ces propriétés dans la sérialisation des sous-objets.
                const canvasObject = canvas.toObject(propertiesToInclude);

                // 2. Filtrer les objets pour exclure les codes géo et les guides
                canvasObject.objects = canvasObject.objects.filter(obj => 
                    // Exclure les objets avec customData.type === 'geoCode'
                    obj.customData?.type !== 'geoCode' && 
                    // Exclure les guides (bordures, grilles, etc.)
                    obj.isGuide !== true
                );

                // 3. Sérialiser l'objet canevas filtré en JSON
                const jsonData = JSON.stringify(canvasObject);
                
                const planId = window.planData?.currentPlan?.id;
                const saveUrl = window.planData?.saveDrawingUrl;

                if (!planId || !saveUrl) {
                    throw new Error("ID du plan ou URL de sauvegarde non définis.");
                }

                console.log(`Action: Envoi des données JSON filtrées (${jsonData.length} chars) pour plan ID ${planId} à ${saveUrl}`);

                // Appel API
                const response = await fetch(saveUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        plan_id: planId,
                        drawing_data: jsonData
                    })
                });

                if (!response.ok) {
                    let errorMsg = `Erreur HTTP ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch (e) { /* Ignorer l'erreur JSON */ }
                    throw new Error(errorMsg);
                }

                const result = await response.json();

                if (result.success) {
                    console.log("Action: Sauvegarde réussie.");
                    showToast("Plan enregistré avec succès !", 'success');
                    canvas.fire('object:modified');
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

    // --- Action Exporter --- (Implémentation basique : PNG)
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
             console.log("Action: Clic sur Exporter (PNG)");
             try {
                 const dataUrl = canvas.toDataURL({
                     format: 'png',
                     quality: 1.0, // Qualité maximale pour PNG
                     multiplier: 2 // Exporter à une résolution 2x (optionnel)
                 });
                 const link = document.createElement('a');
                 const filename = (window.planData?.currentPlan?.nom || 'plan') + '.png';
                 link.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_'); // Nettoyer nom fichier
                 link.href = dataUrl;
                 document.body.appendChild(link);
                 link.click();
                 document.body.removeChild(link);
                 showToast("Plan exporté en PNG.", 'info');
             } catch (e) {
                 console.error("Erreur export PNG:", e);
                 showToast("Erreur lors de l'exportation en PNG.", "danger");
             }
            // Ajouter ici la logique pour exporter en SVG si besoin (canvas.toSVG())
        });
    } else {
        console.warn("Actions: Bouton Exporter non trouvé.");
    }

    console.log("Actions: Configuration des boutons terminée.");
}
