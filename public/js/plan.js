document.addEventListener('DOMContentLoaded', () => {
    const planContainer = document.getElementById('plan-container');
    const unplacedList = document.getElementById('unplaced-list');
    const mapImage = document.getElementById('map-image');

    if (!planContainer || !unplacedList || !mapImage) {
        console.error('Missing required elements for plan page.');
        return;
    }

    // Populate sidebar and map with existing codes
    geoCodesData.forEach(code => {
        const tag = createTag(code);
        if (code.pos_x != null && code.pos_y != null) {
            // Place on map
            tag.style.left = `${code.pos_x}%`;
            tag.style.top = `${code.pos_y}%`;
            planContainer.appendChild(tag);
        } else {
            // Place in sidebar
            unplacedList.appendChild(tag);
        }
    });

    // --- Drag and Drop Logic ---
    let draggedTag = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('geo-tag')) {
            draggedTag = e.target;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                draggedTag.style.display = 'none'; // Hide original while dragging
            }, 0);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (draggedTag) {
            draggedTag.style.display = ''; // Show it again
            draggedTag = null;
        }
    });

    planContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow dropping
    });

    planContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedTag) {
            const mapRect = mapImage.getBoundingClientRect();
            // Calculate position relative to the image in percentage
            const x = ((e.clientX - mapRect.left) / mapRect.width) * 100;
            const y = ((e.clientY - mapRect.top) / mapRect.height) * 100;

            draggedTag.style.left = `${x}%`;
            draggedTag.style.top = `${y}%`;

            // Append to plan container if it came from the sidebar
            if (!draggedTag.parentElement.isEqualNode(planContainer)) {
                 planContainer.appendChild(draggedTag);
            }
            
            savePosition(draggedTag.dataset.id, x, y);
        }
    });

    /**
     * Creates a draggable tag element for a geo code.
     * @param {object} code - The geo code data.
     * @returns {HTMLElement}
     */
    function createTag(code) {
        const tag = document.createElement('div');
        tag.className = 'geo-tag';
        tag.textContent = code.code_geo;
        tag.dataset.id = code.id;
        tag.draggable = true;
        return tag;
    }

    /**
     * Saves the position of a tag via an AJAX call.
     * @param {number} id - The ID of the geo code.
     * @param {number} x - The x-coordinate in percentage.
     * @param {number} y - The y-coordinate in percentage.
     */
    async function savePosition(id, x, y) {
        try {
            const response = await fetch('index.php?action=savePosition', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: parseInt(id),
                    x: Math.round(x),
                    y: Math.round(y)
                })
            });
            const result = await response.json();
            if (result.status !== 'success') {
                console.error('Failed to save position:', result.message);
                // Optionally show an error message to the user
            }
        } catch (error) {
            console.error('Error saving position:', error);
        }
    }
});
