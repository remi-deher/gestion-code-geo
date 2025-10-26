/**
 * Fichier de configuration pour les constantes partagées
 */

// Limites de Zoom
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 20;

// Grille
export const GRID_SIZE = 50; // Taille de la grille en pixels (à zoom 1)

// Tailles prédéfinies pour les étiquettes géo (type 'image')
export const sizePresets = {
    small: { width: 60, height: 30 },
    medium: { width: 80, height: 40 },
    large: { width: 100, height: 50 }
};

// Taille de police pour les codes géo
export const GEO_TAG_FONT_SIZE = 14; // Pour étiquettes 'image'
export const GEO_TEXT_FONT_SIZE = 16; // Pour textes 'svg' (sera adapté au zoom)

// Facteur de conversion: 1 mm ≈ 3.7795 pixels @ 96 DPI
const MM_TO_PIXEL = 3.779527559;

/**
 * Convertit une dimension en mm en pixels (arrondi à l'entier).
 * @param {number} mm - Dimension en millimètres.
 * @returns {number} Dimension en pixels.
 */
const mmToPx = (mm) => Math.round(mm * MM_TO_PIXEL);


// Dimensions des formats de page en pixels @ 96 DPI (pour les guides)
export const PAGE_FORMATS = {
    // Ajout du format Personnalisé (Custom)
    'Custom': { width: 0, height: 0, label: 'Personnalisé' }, 
    
    // Formats de page existants (conversion en pixels)
    'A4-P': { width: mmToPx(210), height: mmToPx(297), label: 'A4 Portrait (210x297mm)' },
    'A4-L': { width: mmToPx(297), height: mmToPx(210), label: 'A4 Paysage (297x210mm)' },
    'A3-P': { width: mmToPx(297), height: mmToPx(420), label: 'A3 Portrait (297x420mm)' },
    'A3-L': { width: mmToPx(420), height: mmToPx(297), label: 'A3 Paysage (420x297mm)' },
};
