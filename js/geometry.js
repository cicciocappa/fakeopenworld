// ============================================================
// GEOMETRIE - Esempi base da replicare
// ============================================================

/**
 * Crea mesh del terreno (piano grande)
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @returns {{vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number}}
 */
export function createGroundMesh(gl) {
    const size = 200;
    const vertices = new Float32Array([
        -size, 0, -size,  0, 1, 0,  0, 0,
         size, 0, -size,  0, 1, 0,  1, 0,
         size, 0,  size,  0, 1, 0,  1, 1,
        -size, 0,  size,  0, 1, 0,  0, 1,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return { vbo, ibo, indexCount: indices.length };
}

/**
 * Crea mesh skybox (cubo)
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @returns {{vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number}}
 */
export function createSkyboxMesh(gl) {
    const vertices = new Float32Array([
        -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,  // Back
        -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1,  // Front
        -1, -1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1,  // Left
         1, -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  // Right
        -1,  1, -1,  1,  1, -1,  1,  1,  1, -1,  1,  1,  // Top
        -1, -1, -1,  1, -1, -1,  1, -1,  1, -1, -1,  1,  // Bottom
    ]);
    const indices = new Uint16Array([
        0,1,2, 0,2,3,   4,5,6, 4,6,7,   8,9,10, 8,10,11,
        12,13,14, 12,14,15,   16,17,18, 16,18,19,   20,21,22, 20,22,23
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return { vbo, ibo, indexCount: indices.length };
}

/**
 * Crea billboards per "alberi" - TECNICA CHIAVE
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @param {number} count - Numero di billboards da creare
 * @returns {{vbo: WebGLBuffer, vertexCount: number}}
 */
export function createBillboards(gl, count) {
    // Ogni billboard: position(3) + offset(2) + texCoord(2)
    const data = [];

    for (let i = 0; i < count; i++) {
        // Posizione random nel mondo
        const x = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        const y = 0;

        // 4 vertici per quad (2 triangoli)
        // Ogni vertice: position, offset, texCoord
        const positions = [
            [x, y, z, -0.5, 0.0, 0, 0],
            [x, y, z,  0.5, 0.0, 1, 0],
            [x, y, z,  0.5, 1.0, 1, 1],
            [x, y, z, -0.5, 1.0, 0, 1],
        ];

        data.push(...positions[0], ...positions[1], ...positions[2]);
        data.push(...positions[0], ...positions[2], ...positions[3]);
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    return { vbo, vertexCount: count * 6 };
}

/**
 * Crea mesh cards per montagne lontane - altra TECNICA CHIAVE
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @returns {{vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number}}
 */
export function createDistantMountains(gl) {
    const mountains = [];
    const distance = 150;

    // 4 piani con "montagne" ai bordi
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        // Piano verticale orientato verso centro
        const width = 100;
        const height = 30;

        // Calcola right vector (perpendicolare alla direzione)
        const right = [-Math.sin(angle), 0, Math.cos(angle)];

        // Calcola normale che punta verso il centro
        const normal = [-Math.cos(angle), 0, -Math.sin(angle)];

        const vertices = [];
        // 4 vertici del piano
        for (let v of [
            [x - right[0] * width/2, 0, z - right[2] * width/2],
            [x + right[0] * width/2, 0, z + right[2] * width/2],
            [x + right[0] * width/2, height, z + right[2] * width/2],
            [x - right[0] * width/2, height, z - right[2] * width/2],
        ]) {
            vertices.push(...v, ...normal, 0, 0);  // pos, normal, uv
        }

        mountains.push(...vertices);
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mountains), gl.STATIC_DRAW);

    const indices = new Uint16Array([
        0,1,2, 0,2,3,   4,5,6, 4,6,7,   8,9,10, 8,10,11,   12,13,14, 12,14,15
    ]);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return { vbo, ibo, indexCount: indices.length };
}
