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

    // Enable 32-bit indices for large terrain meshes
    const ext = gl.getExtension('OES_element_index_uint');
    if (!ext) {
        console.warn('OES_element_index_uint extension not supported - large meshes may not work');
    }

    return gl;
}
