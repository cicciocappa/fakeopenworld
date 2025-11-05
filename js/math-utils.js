// ============================================================
// MATH UTILS - Da replicare in C con glm o simili
// ============================================================

/**
 * Crea una matrice identità 4x4
 * @returns {Float32Array} Matrice identità
 */
export function mat4Create() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Crea una matrice di proiezione prospettica
 * @param {number} fov - Field of view in radianti
 * @param {number} aspect - Aspect ratio (width/height)
 * @param {number} near - Piano near
 * @param {number} far - Piano far
 * @returns {Float32Array} Matrice di proiezione
 */
export function mat4Perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ]);
}

/**
 * Crea una matrice view (lookAt)
 * @param {Array<number>} eye - Posizione camera [x, y, z]
 * @param {Array<number>} center - Punto target [x, y, z]
 * @param {Array<number>} up - Vettore up [x, y, z]
 * @returns {Float32Array} Matrice view
 */
export function mat4LookAt(eye, center, up) {
    const z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
    const zlen = Math.sqrt(z[0]*z[0] + z[1]*z[1] + z[2]*z[2]);
    z[0] /= zlen; z[1] /= zlen; z[2] /= zlen;

    const x = [
        up[1] * z[2] - up[2] * z[1],
        up[2] * z[0] - up[0] * z[2],
        up[0] * z[1] - up[1] * z[0]
    ];
    const xlen = Math.sqrt(x[0]*x[0] + x[1]*x[1] + x[2]*x[2]);
    x[0] /= xlen; x[1] /= xlen; x[2] /= xlen;

    const y = [
        z[1] * x[2] - z[2] * x[1],
        z[2] * x[0] - z[0] * x[2],
        z[0] * x[1] - z[1] * x[0]
    ];

    return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -(x[0]*eye[0] + x[1]*eye[1] + x[2]*eye[2]),
        -(y[0]*eye[0] + y[1]*eye[1] + y[2]*eye[2]),
        -(z[0]*eye[0] + z[1]*eye[1] + z[2]*eye[2]),
        1
    ]);
}
