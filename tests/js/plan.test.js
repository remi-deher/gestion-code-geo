// tests/js/plan.test.js

/**
 * @jest-environment jsdom
 */

describe('Gestionnaire de plan (plan.js)', () => {

    beforeEach(() => {
        // Simuler le DOM de la page du plan
        document.body.innerHTML = `
            <div id="unplaced-list">
                <div class="unplaced-item" data-id="101">Code 1</div>
            </div>
            <div id="add-code-modal"></div>
            <canvas id="plan-canvas"></canvas>
            <img id="map-image" style="display:none;" />
        `;

        // Simuler les variables globales que le PHP injecterait
        global.placedGeoCodes = [];
        global.universColors = {};
        global.currentPlanId = 1;
        global.currentPlan = { id: 1, nom_fichier: 'test.png' };
        global.planUnivers = [];
        
        // Mock simple de l'objet bootstrap que le script attend
        global.bootstrap = {
            Modal: class MockModal {}
        };

        // Charger le script
        require('../../public/js/plan.js');
        // Déclencher l'événement pour que les écouteurs du script soient attachés
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('doit entrer en mode placement au clic sur un item', () => {
        // Arrange
        const unplacedItem = document.querySelector('.unplaced-item[data-id="101"]');
        const canvas = document.getElementById('plan-canvas');

        // Assert (avant le clic)
        expect(unplacedItem.classList.contains('placement-active')).toBe(false);
        expect(canvas.style.cursor).not.toBe('crosshair');
        
        // Act : Le clic se fait sur la liste parente, mais se propage à l'item
        unplacedItem.click();

        // Assert (après le clic)
        expect(unplacedItem.classList.contains('placement-active')).toBe(true);
        expect(canvas.style.cursor).toBe('crosshair');
    });
});
