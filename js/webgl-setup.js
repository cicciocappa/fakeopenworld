// ============================================================
// SETUP WEBGL
// ============================================================

/**
 * Inizializza WebGL dal canvas
 * @param {HTMLCanvasElement} canvas - Canvas HTML
 * @returns {WebGLRenderingContext|null} Contesto WebGL o null se non supportato
 */
export function initWebGL(canvas) {
    // Imposta dimensioni canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext('webgl');
    if (!gl) {
        alert('WebGL not supported');
        return null;
    }

    // Configurazione WebGL
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);  // LEQUAL necessario per skybox al far plane
    gl.enable(gl.CULL_FACE);

    return gl;
}
