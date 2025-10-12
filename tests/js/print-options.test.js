// tests/js/print-options.test.js

/**
 * @jest-environment jsdom
 */

describe('Options d\'impression (print-options.js)', () => {

    beforeEach(() => {
        document.body.innerHTML = `
            <form class="print-options-form">
                <input type="checkbox" name="fields[]" value="qrcode" id="field_qrcode" checked>
                <select id="layout_format">
                    <option value="qr-left"></option>
                </select>
                <div id="label-preview-container">
                    <div id="preview-qrcode"></div>
                </div>
            </form>
        `;

        // Simuler la librairie QRCode.js avec la structure attendue
        global.QRCode = jest.fn();
        global.QRCode.CorrectLevel = {
            H: 'H' // La valeur exacte n'a pas d'importance, juste l'existence de la propriété
        };

        require('../../public/js/print-options.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('doit cacher l\'aperçu du QR code quand la case est décochée', () => {
        // Arrange
        const qrCheckbox = document.getElementById('field_qrcode');
        const previewQr = document.getElementById('preview-qrcode');

        // Pré-condition: l'élément est visible
        expect(previewQr.style.display).not.toBe('none');
        
        // Act
        qrCheckbox.checked = false;
        // Simuler l'événement 'change' sur le formulaire pour déclencher la mise à jour
        qrCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        // Assert
        expect(previewQr.style.display).toBe('none');
    });
});
