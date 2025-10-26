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
                // Exclure temporairement les objets non nécessaires (ex: grille, guides) si besoin
                // const objectsToSave = canvas.getObjects().filter(obj => !obj.isHelper);
                // const jsonData = JSON.stringify(canvas.toDatalessJSON(objectsToSave));

                // Sérialisation simple pour commencer
                const jsonData = JSON.stringify(canvas.toJSON());
                const planId = window.planData?.currentPlan?.id;
                const saveUrl = window.planData?.saveDrawingUrl;

                if (!planId || !saveUrl) {
                    throw new Error("ID du plan ou URL de sauvegarde non définis.");
                }

                console.log(`Action: Envoi des données JSON (${jsonData.length} chars) pour plan ID ${planId} à ${saveUrl}`);

                // Appel API (fetch simple ici, pourrait utiliser apiFetch de api.js)
                const response = await fetch(saveUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        // Ajouter le token CSRF si nécessaire
                        // 'X-CSRF-Token': window.planData?.csrfToken || ''
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
                    // Optionnel: Mettre à jour l'état "modifié" de l'éditeur
                    canvas.fire('object:modified'); // Pourrait déclencher une réinitialisation de l'état "modifié"
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

    // --- Action Imprimer --- (Implémentation basique)
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            console.log("Action: Clic sur Imprimer");
            // Option 1 : Ouvrir une nouvelle fenêtre avec une vue dédiée à l'impression
            // window.open(`index.php?action=printPlan&id=${window.planData?.currentPlan?.id}`, '_blank');

            // Option 2 : Utiliser l'impression navigateur directe du canvas (qualité variable)
            try {
                 const dataUrl = canvas.toDataURL({ format: 'png', quality: 1.0 });
                 const windowContent = '<!DOCTYPE html><html><head><title>Impression Plan</title></head><body><img src="' + dataUrl + '" style="max-width: 100%; height: auto;"></body></html>';
                 const printWin = window.open('', '', 'width=' + screen.availWidth + ',height=' + screen.availHeight);
                 printWin.document.open();
                 printWin.document.write(windowContent);
                 printWin.document.close();
                 printWin.focus();
                 setTimeout(() => { printWin.print(); printWin.close(); }, 250); // Laisse le temps de charger l'image
            } catch (e) {
                console.error("Erreur impression directe:", e);
                showToast("Erreur lors de la préparation de l'impression.", "danger");
            }
        });
    } else {
         console.warn("Actions: Bouton Imprimer non trouvé.");
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
