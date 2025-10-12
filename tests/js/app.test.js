// tests/js/app.test.js

/**
 * @jest-environment jsdom
 */

// On ne lit plus le fichier PHP, car il ne peut pas être interprété.
// const fs = require('fs');
// const path = require('path');

// --- FONCTION D'INITIALISATION ---
// On met le code de configuration dans une fonction pour pouvoir le réutiliser.
function initializeDOMAndRunScript() {
    // 1. On crée un HTML qui simule la sortie du PHP.
    document.body.innerHTML = `
        <div id="classeur">
            <button id="view-card-btn" class="active">Vue Fiches</button>
            <button id="view-table-btn">Vue Tableau</button>
            <button class="zone-tab" data-zone="reserve">Réserve</button>

            <div id="card-view">
                <div class="geo-card" data-zone="vente" data-searchable="vente-card"></div>
                <div class="geo-card" data-zone="reserve" data-searchable="reserve-card"></div>
            </div>
            <div id="table-view" class="d-none">
                <tbody>
                    <tr data-zone="vente" data-searchable="vente-row"></tr>
                    <tr data-zone="reserve" data-searchable="reserve-row"></tr>
                </tbody>
            </table>
        </div>
    `;

    // 2. On charge le script.
    // require() met le code en cache, donc il ne se ré-exécutera pas dans les tests suivants,
    // mais ses fonctions seront disponibles si on les exportait.
    // Pour notre cas (un script simple), il suffit de le charger une fois.
    // NOTE : Pour des tests plus complexes, il faudrait invalider le cache de require.
    require('../../public/js/app.js');

    // 3. On déclenche manuellement l'événement pour être sûr que le code s'exécute.
    document.dispatchEvent(new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));
}


describe('Filtrage et Tri de la liste des codes géo (app.js)', () => {

    beforeEach(() => {
        // Avant chaque test, on réinitialise le DOM et on relance le script.
        initializeDOMAndRunScript();
    });

    test('doit basculer vers la vue tableau en cliquant sur le bouton "Vue Tableau"', () => {
        // Arrange
        const viewCardBtn = document.getElementById('view-card-btn');
        const viewTableBtn = document.getElementById('view-table-btn');
        const cardView = document.getElementById('card-view');
        const tableView = document.getElementById('table-view');

        // Act
        viewTableBtn.click();

        // Assert
        expect(cardView.classList.contains('d-none')).toBe(true);
        expect(tableView.classList.contains('d-none')).toBe(false);
        expect(viewTableBtn.classList.contains('active')).toBe(true);
        expect(viewCardBtn.classList.contains('active')).toBe(false);
    });

    test('doit filtrer les cartes par zone en cliquant sur un onglet de zone', () => {
        // Arrange
        const zoneTabReserve = document.querySelector('.zone-tab[data-zone="reserve"]');
        const cardVente = document.querySelector('.geo-card[data-zone="vente"]');
        const cardReserve = document.querySelector('.geo-card[data-zone="reserve"]');
        
        // Act
        zoneTabReserve.click();

        // Assert
        expect(cardVente.style.display).toBe('none');
        expect(cardReserve.style.display).toBe('grid'); // La vue fiche utilise 'grid'
    });
});
