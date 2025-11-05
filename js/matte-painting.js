/**
 * Matte Painting System
 *
 * Implementa la tecnica di matte painting per creare sfondi epici con geometria minima.
 * Supporta sia texture caricate da file che fallback procedurali.
 *
 * Filosofia ibrida: asset-based quando disponibile, procedurale come fallback.
 */

/**
 * Texture Loader con gestione errori e fallback
 * Supporta texture 2D, equirectangular e cubemap
 */
export class TextureLoader {
    constructor(gl) {
        this.gl = gl;
        this.cache = new Map();
    }

    /**
     * Carica una cubemap da un'immagine in formato cross layout
     * Layout: horizontal cross (4x3)
     *     [  ] [+Y] [  ] [  ]
     *     [-X] [+Z] [+X] [-Z]
     *     [  ] [-Y] [  ] [  ]
     *
     * @param {string} url - URL dell'immagine cross layout
     * @param {Function} onSuccess - Callback quando caricata
     * @param {Function} onError - Callback in caso di errore
     * @returns {WebGLTexture} - Texture cubemap
     */
    loadCubemap(url, onSuccess = null, onError = null) {
        const gl = this.gl;

        // Check cache
        const cacheKey = `cubemap_${url}`;
        if (this.cache.has(cacheKey)) {
            console.log(`Cubemap "${url}" loaded from cache`);
            return this.cache.get(cacheKey);
        }

        // Create cubemap texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        // Placeholder for each face (1x1 magenta pixel)
        const placeholder = new Uint8Array([255, 0, 255, 255]);
        const faces = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];

        for (const face of faces) {
            gl.texImage2D(face, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
        }

        // Load actual image
        const image = new Image();
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            console.log(`Cubemap image loaded: ${url} (${image.width}×${image.height})`);

            // Extract faces from cross layout
            const faceSize = image.width / 4; // Assuming 4x3 cross layout
            const faceImages = this.extractCubemapFaces(image, faceSize);

            // DEBUG: Show extracted faces (uncomment to enable debug panel)
            // import('./cubemap-debug.js').then(module => {
            //     module.createCubemapDebugPanel(faceImages, faceSize);
            // });

            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

            // Upload each face
            const faceTargets = [
                { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, image: faceImages.px, name: '+X' },
                { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, image: faceImages.nx, name: '-X' },
                { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, image: faceImages.py, name: '+Y' },
                { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, image: faceImages.ny, name: '-Y' },
                { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, image: faceImages.pz, name: '+Z' },
                { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, image: faceImages.nz, name: '-Z' }
            ];

            for (const face of faceTargets) {
                gl.texImage2D(face.target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face.image);
                console.log(`  ✓ Face ${face.name} uploaded (${face.image.width}×${face.image.height})`);
            }

            // Set texture parameters
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            console.log('✓ Cubemap loaded successfully');

            if (onSuccess) onSuccess(texture);
        };

        image.onerror = () => {
            console.warn(`✗ Failed to load cubemap: ${url}`);
            if (onError) onError();
        };

        image.src = url;
        this.cache.set(cacheKey, texture);
        return texture;
    }

    /**
     * Estrae le 6 facce da un'immagine in formato cross layout
     * @param {HTMLImageElement} image - Immagine sorgente
     * @param {number} faceSize - Dimensione di ogni faccia (in pixel)
     * @returns {Object} - Oggetto con le 6 facce (px, nx, py, ny, pz, nz)
     */
    extractCubemapFaces(image, faceSize) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = faceSize;
        canvas.height = faceSize;

        const faces = {};

        // Helper function to extract a face with optional transformations
        const extractFace = (x, y, flipX = false, flipY = false, rotate90 = 0) => {
            ctx.clearRect(0, 0, faceSize, faceSize);

            ctx.save();

            // Move to center for transformations
            ctx.translate(faceSize / 2, faceSize / 2);

            // Apply rotations (rotate90: 0=none, 1=90deg, 2=180deg, 3=270deg)
            if (rotate90) {
                ctx.rotate((rotate90 * Math.PI) / 2);
            }

            // Apply flips
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

            // Draw image centered
            ctx.drawImage(image, x * faceSize, y * faceSize, faceSize, faceSize,
                         -faceSize / 2, -faceSize / 2, faceSize, faceSize);

            ctx.restore();

            const faceCanvas = document.createElement('canvas');
            faceCanvas.width = faceSize;
            faceCanvas.height = faceSize;
            const faceCtx = faceCanvas.getContext('2d');
            faceCtx.drawImage(canvas, 0, 0);

            return faceCanvas;
        };

        // Horizontal cross layout (confirmed by user):
        //     [-] [+Y/TOP]    [-] [-]   (row 0)
        //     [-X] [+Z/FRONT] [+X] [-Z]   (row 1)
        //     [-] [-Y/BOTTOM] [-] [-]   (row 2)

        console.log('  Extracting cubemap faces from cross layout...');

        // User confirmed layout:
        //     [-] [TOP]    [-] [-]   (row 0)
        //     [LT] [FT] [RT] [BK]     (row 1)  LT=Left, FT=Front, RT=Right, BK=Back
        //     [-] [BOT]    [-] [-]   (row 2)

        // IMPORTANT: WebGL cubemap needs specific face assignments
        // Let's try different mappings to find the correct one

        // === MAPPING TEST 1: Standard horizontal cross (NO transformations) ===
        faces.px = extractFace(2, 1);  // +X (right) from col 2, row 1
        faces.nx = extractFace(0, 1);  // -X (left) from col 0, row 1
        faces.py = extractFace(1, 0);  // +Y (top) from col 1, row 0
        faces.ny = extractFace(1, 2);  // -Y (bottom) from col 1, row 2
        faces.pz = extractFace(1, 1);  // +Z (front) from col 1, row 1
        faces.nz = extractFace(3, 1);  // -Z (back) from col 3, row 1

        // If this doesn't work, try TEST 2 (uncomment below, comment above):
        // === MAPPING TEST 2: Swapped front/back ===
        // faces.px = extractFace(2, 1);
        // faces.nx = extractFace(0, 1);
        // faces.py = extractFace(1, 0);
        // faces.ny = extractFace(1, 2);
        // faces.pz = extractFace(3, 1);  // +Z = back position
        // faces.nz = extractFace(1, 1);  // -Z = front position

        console.log('  ✓ Faces extracted (TEST 1: standard mapping, no transforms)');

        return faces;
    }

    /**
     * Carica una texture da URL
     * @param {string} url - URL della texture
     * @param {Function} onSuccess - Callback quando caricata
     * @param {Function} onError - Callback in caso di errore
     * @returns {WebGLTexture} - Texture placeholder (1x1 pixel) che verrà aggiornata
     */
    loadTexture(url, onSuccess = null, onError = null) {
        const gl = this.gl;

        // Check cache
        if (this.cache.has(url)) {
            console.log(`Texture "${url}" loaded from cache`);
            return this.cache.get(url);
        }

        // Create placeholder texture (1x1 magenta pixel for debugging)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const placeholder = new Uint8Array([255, 0, 255, 255]); // Magenta
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);

        // Load actual image
        const image = new Image();
        image.crossOrigin = 'anonymous'; // For external URLs

        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            // Check if power of 2
            if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            console.log(`✓ Texture loaded: ${url} (${image.width}×${image.height})`);

            if (onSuccess) onSuccess(texture);
        };

        image.onerror = () => {
            console.warn(`✗ Failed to load texture: ${url}`);
            if (onError) onError();
        };

        image.src = url;
        this.cache.set(url, texture);
        return texture;
    }

    /**
     * Crea una texture procedurale come fallback
     * @param {number} width - Larghezza texture
     * @param {number} height - Altezza texture
     * @param {Function} generator - Funzione (x, y) => [r, g, b, a]
     */
    createProceduralTexture(width, height, generator) {
        const gl = this.gl;
        const texture = gl.createTexture();

        const data = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const color = generator(x, y, width, height);
                data[idx + 0] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = color[3];
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }
}

/**
 * Layer per il sistema di parallasse
 * Ogni layer rappresenta un livello di profondità con la sua geometria e texture
 */
export class MattePaintingLayer {
    constructor(name, distance, type = 'cards') {
        this.name = name;
        this.distance = distance;  // Distanza dalla camera (per parallasse)
        this.type = type;          // 'cards', 'cylinder', 'sphere', 'dome'
        this.mesh = null;
        this.texture = null;
        this.useTexture = false;   // Se false, usa colore procedurale
        this.alpha = 1.0;           // Trasparenza layer
        this.parallaxFactor = 1.0;  // Quanto si muove con la camera (1.0 = normale, 0.0 = fisso)
        this.useFog = false;        // Se true, applica fog a questo layer
    }
}

/**
 * Crea mesh per skybox panoramico (sfera)
 * Usa UV mapping equirectangular (panorama 2:1)
 */
export function createPanoramicSphere(gl, radius = 500, segments = 32, rings = 16) {
    const vertices = [];
    const indices = [];

    // Generate sphere vertices with UV mapping
    for (let ring = 0; ring <= rings; ring++) {
        const theta = ring * Math.PI / rings;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let seg = 0; seg <= segments; seg++) {
            const phi = seg * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Position
            const x = radius * sinTheta * cosPhi;
            const y = radius * cosTheta;
            const z = radius * sinTheta * sinPhi;

            // Normal (pointing inward for skybox)
            const nx = -sinTheta * cosPhi;
            const ny = -cosTheta;
            const nz = -sinTheta * sinPhi;

            // UV coordinates (equirectangular)
            const u = seg / segments;
            const v = ring / rings;

            vertices.push(x, y, z, nx, ny, nz, u, v);
        }
    }

    // Generate indices
    for (let ring = 0; ring < rings; ring++) {
        for (let seg = 0; seg < segments; seg++) {
            const first = ring * (segments + 1) + seg;
            const second = first + segments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    // Create buffers
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vbo: vbo,
        ibo: ibo,
        indexCount: indices.length,
        vertexCount: vertices.length / 8
    };
}

/**
 * Crea mesh cilindrica per panorami 360°
 * Più efficiente della sfera, perfetto per orizzonti montani
 */
export function createPanoramicCylinder(gl, radius = 400, height = 200, segments = 32) {
    const vertices = [];
    const indices = [];

    // Bottom ring (y = -height/2)
    // Top ring (y = +height/2)
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const u = i / segments;

        // Bottom vertex
        vertices.push(x, -height/2, z,  -Math.cos(angle), 0, -Math.sin(angle),  u, 1.0);
        // Top vertex
        vertices.push(x, height/2, z,   -Math.cos(angle), 0, -Math.sin(angle),  u, 0.0);
    }

    // Generate indices (triangle strip converted to triangles)
    for (let i = 0; i < segments; i++) {
        const base = i * 2;
        // Triangle 1
        indices.push(base, base + 1, base + 2);
        // Triangle 2
        indices.push(base + 1, base + 3, base + 2);
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vbo: vbo,
        ibo: ibo,
        indexCount: indices.length,
        vertexCount: vertices.length / 8
    };
}

/**
 * Crea un set di mesh cards posizionate a cerchio
 * Perfetto per layer di parallasse (montagne a distanze diverse)
 *
 * @param {number} count - Numero di cards
 * @param {number} distance - Distanza dal centro
 * @param {number} width - Larghezza di ogni card
 * @param {number} height - Altezza di ogni card
 */
export function createMattePaintingCards(gl, count = 8, distance = 150, width = 100, height = 60) {
    const vertices = [];
    const indices = [];
    let indexOffset = 0;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        // Card orientation (facing toward center)
        const right_x = -Math.sin(angle);
        const right_z = Math.cos(angle);

        // Vertices for this card (quad = 2 triangles)
        const halfW = width / 2;
        const halfH = height / 2;

        // Bottom-left
        const v0 = [
            x - right_x * halfW, -halfH, z - right_z * halfW,
            -Math.cos(angle), 0, -Math.sin(angle),  // normal (toward center)
            0, 1  // UV
        ];
        // Bottom-right
        const v1 = [
            x + right_x * halfW, -halfH, z + right_z * halfW,
            -Math.cos(angle), 0, -Math.sin(angle),
            1, 1
        ];
        // Top-right
        const v2 = [
            x + right_x * halfW, halfH, z + right_z * halfW,
            -Math.cos(angle), 0, -Math.sin(angle),
            1, 0
        ];
        // Top-left
        const v3 = [
            x - right_x * halfW, halfH, z - right_z * halfW,
            -Math.cos(angle), 0, -Math.sin(angle),
            0, 0
        ];

        vertices.push(...v0, ...v1, ...v2, ...v3);

        // Indices for this quad
        indices.push(
            indexOffset + 0, indexOffset + 1, indexOffset + 2,
            indexOffset + 0, indexOffset + 2, indexOffset + 3
        );
        indexOffset += 4;
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vbo: vbo,
        ibo: ibo,
        indexCount: indices.length,
        vertexCount: vertices.length / 8,
        cardCount: count
    };
}

/**
 * Genera una texture procedurale per montagne (fallback)
 * Usa Perlin noise per creare un profilo montuoso stilizzato
 */
export function generateProceduralMountainTexture(gl, width = 2048, height = 512) {
    return new TextureLoader(gl).createProceduralTexture(width, height, (x, y, w, h) => {
        // Normalized coordinates
        const nx = x / w;
        const ny = y / h;

        // Simple mountain silhouette using sine waves + noise
        const horizon = 0.5;
        const mountainHeight = 0.3;

        // Create mountain profile with multiple frequencies
        let mountain = 0;
        mountain += Math.sin(nx * Math.PI * 2) * 0.3;
        mountain += Math.sin(nx * Math.PI * 6) * 0.15;
        mountain += Math.sin(nx * Math.PI * 12) * 0.08;
        mountain = (mountain + 0.5) * mountainHeight;

        const mountainY = horizon - mountain;

        // Sky above, mountain below
        if (ny < mountainY) {
            // Sky - gradient from blue to horizon
            const t = ny / mountainY;
            const r = Math.floor(128 + t * 100);
            const g = Math.floor(180 + t * 50);
            const b = Math.floor(230);
            return [r, g, b, 255];
        } else {
            // Mountain - dark with slight gradient
            const depth = (ny - mountainY) / (1.0 - mountainY);
            const r = Math.floor(60 + depth * 40);
            const g = Math.floor(50 + depth * 50);
            const b = Math.floor(80 + depth * 60);
            return [r, g, b, 255];
        }
    });
}

/**
 * Manager per il sistema di matte painting completo
 * Gestisce multiple layer, parallasse, e fallback
 */
export class MattePaintingManager {
    constructor(gl) {
        this.gl = gl;
        this.textureLoader = new TextureLoader(gl);
        this.layers = [];
        this.skyboxTexture = null;
        this.skyboxCubemap = null;
        this.useProcedural = true;  // Fallback mode
        this.useCubemap = false;     // If true, use cubemap instead of equirectangular
    }

    /**
     * Aggiunge un layer di matte painting
     */
    addLayer(layer) {
        this.layers.push(layer);
        console.log(`Matte painting layer added: ${layer.name} at distance ${layer.distance}m`);
    }

    /**
     * Carica texture per lo skybox principale (equirectangular)
     */
    loadSkyboxTexture(url) {
        console.log(`Loading skybox texture: ${url}`);
        this.skyboxTexture = this.textureLoader.loadTexture(
            url,
            (texture) => {
                this.useProcedural = false;
                this.useCubemap = false;
                console.log('✓ Skybox texture loaded successfully - switching to texture mode');
            },
            () => {
                console.warn('✗ Skybox texture failed - using procedural fallback');
                this.useProcedural = true;
            }
        );
    }

    /**
     * Carica cubemap per lo skybox (formato cross layout)
     * @param {string} url - URL dell'immagine cubemap cross layout
     */
    loadSkyboxCubemap(url) {
        console.log(`Loading skybox cubemap: ${url}`);
        this.skyboxCubemap = this.textureLoader.loadCubemap(
            url,
            (texture) => {
                this.useProcedural = false;
                this.useCubemap = true;
                console.log('✓ Skybox cubemap loaded successfully - switching to cubemap mode');
            },
            () => {
                console.warn('✗ Skybox cubemap failed - using procedural fallback');
                this.useProcedural = true;
                this.useCubemap = false;
            }
        );
    }

    /**
     * Crea layer predefiniti per un setup completo
     */
    createDefaultLayers(gl) {
        // Layer 1: Skybox/Background panorama (più lontano)
        const skyLayer = new MattePaintingLayer('skybox', 500, 'cylinder');
        skyLayer.mesh = createPanoramicCylinder(gl, 500, 250, 32);
        skyLayer.parallaxFactor = 0.0; // Fisso, no parallasse
        this.addLayer(skyLayer);

        // Layer 2: Montagne distanti (con texture reale)
        const distantMountains = new MattePaintingLayer('distant_mountains', 300, 'cards');
        distantMountains.mesh = createMattePaintingCards(gl, 8, 300, 150, 80);
        distantMountains.parallaxFactor = 0.2; // Parallasse leggera

        // Start with procedural fallback, then load real texture
        distantMountains.texture = generateProceduralMountainTexture(gl, 1024, 512);
        distantMountains.useTexture = true;

        // Load real texture (async)
        this.textureLoader.loadTexture(
            'assets/montagne_lontante.png',
            (texture) => {
                distantMountains.texture = texture;
                console.log('✓ Distant mountains texture loaded');
            },
            () => {
                console.warn('✗ Distant mountains texture failed - using procedural fallback');
            }
        );

        this.addLayer(distantMountains);

        // Layer 3: Colline/montagne vicine (con texture reale)
        const midHills = new MattePaintingLayer('mid_hills', 180, 'cards');
        midHills.mesh = createMattePaintingCards(gl, 6, 180, 100, 50);
        midHills.parallaxFactor = 0.5; // Parallasse media
        midHills.alpha = 0.9; // Semi-trasparente per effetto depth

        // Start with procedural fallback, then load real texture
        midHills.texture = generateProceduralMountainTexture(gl, 1024, 512);
        midHills.useTexture = true;

        // Load real texture (async)
        this.textureLoader.loadTexture(
            'assets/montagne_vicine.png',
            (texture) => {
                midHills.texture = texture;
                console.log('✓ Near mountains texture loaded');
            },
            () => {
                console.warn('✗ Near mountains texture failed - using procedural fallback');
            }
        );

        this.addLayer(midHills);

        console.log(`✓ Created ${this.layers.length} default matte painting layers`);
    }
}
