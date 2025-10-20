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


// Dimensions des formats de page en mm (pour les guides)
// https://www.papersizes.org/
export const PAGE_FORMATS = {
    'A4-P': { width: 210, height: 297 },
    'A4-L': { width: 297, height: 210 },
    'A3-P': { width: 297, height: 420 },
    'A3-L': { width: 420, height: 297 },
};
