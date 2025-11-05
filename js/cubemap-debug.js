/**
 * Debug utilities for cubemap loading
 * Helps visualize and diagnose cubemap face mapping issues
 */

/**
 * Creates a debug panel showing all 6 cubemap faces
 * This helps verify that faces are extracted and mapped correctly
 */
export function createCubemapDebugPanel(faces, faceSize) {
    // Create debug container
    const debugPanel = document.createElement('div');
    debugPanel.id = 'cubemap-debug';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        padding: 10px;
        color: white;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        border: 2px solid #00ff00;
    `;

    const title = document.createElement('div');
    title.textContent = 'Cubemap Debug Panel';
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #00ff00;';
    debugPanel.appendChild(title);

    // Create grid layout for faces
    const grid = document.createElement('div');
    grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, ${faceSize/4}px);
        grid-template-rows: repeat(3, ${faceSize/4}px);
        gap: 2px;
    `;

    // Layout:
    //     [  ] [+Y] [  ] [  ]   (row 0)
    //     [-X] [+Z] [+X] [-Z]   (row 1)
    //     [  ] [-Y] [  ] [  ]   (row 2)

    const layout = [
        [null, 'py', null, null],
        ['nx', 'pz', 'px', 'nz'],
        [null, 'ny', null, null]
    ];

    const faceNames = {
        'px': '+X (Right)',
        'nx': '-X (Left)',
        'py': '+Y (Top)',
        'ny': '-Y (Bottom)',
        'pz': '+Z (Front)',
        'nz': '-Z (Back)'
    };

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            const faceName = layout[row][col];
            const cell = document.createElement('div');
            cell.style.cssText = `
                width: ${faceSize/4}px;
                height: ${faceSize/4}px;
                border: 1px solid #333;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            `;

            if (faceName && faces[faceName]) {
                // Add the face image
                const img = faces[faceName];
                img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                `;
                cell.appendChild(img);

                // Add label
                const label = document.createElement('div');
                label.textContent = faceNames[faceName];
                label.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0,0,0,0.7);
                    color: #00ff00;
                    font-size: 8px;
                    padding: 2px;
                    text-align: center;
                `;
                cell.appendChild(label);
            } else {
                cell.style.background = '#222';
            }

            grid.appendChild(cell);
        }
    }

    debugPanel.appendChild(grid);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Debug Panel';
    closeBtn.style.cssText = `
        margin-top: 10px;
        padding: 5px 10px;
        background: #ff0000;
        color: white;
        border: none;
        cursor: pointer;
    `;
    closeBtn.onclick = () => debugPanel.remove();
    debugPanel.appendChild(closeBtn);

    document.body.appendChild(debugPanel);

    console.log('✓ Cubemap debug panel created - check top-right corner');
}

/**
 * Test different cubemap face mappings
 * Cycles through various common cubemap layouts
 */
export function testCubemapMappings(image, faceSize) {
    const mappings = {
        'Standard Horizontal Cross': {
            px: [2, 1], nx: [0, 1],
            py: [1, 0], ny: [1, 2],
            pz: [1, 1], nz: [3, 1]
        },
        'Standard Horizontal Cross (Y-flipped)': {
            px: [2, 1], nx: [0, 1],
            py: [1, 0, true], ny: [1, 2, true], // flip Y faces
            pz: [1, 1], nz: [3, 1]
        },
        'Vertical Cross': {
            px: [2, 1], nx: [0, 1],
            py: [1, 0], ny: [1, 2],
            pz: [1, 1], nz: [1, 3]
        },
        'Alternative Layout 1': {
            px: [2, 1], nx: [0, 1],
            py: [1, 2], ny: [1, 0], // swapped top/bottom
            pz: [1, 1], nz: [3, 1]
        }
    };

    console.log('=== CUBEMAP MAPPING TEST ===');
    console.log('Available layouts:', Object.keys(mappings));
    console.log('Try each layout in the matte-painting.js extractCubemapFaces() function');

    return mappings;
}
