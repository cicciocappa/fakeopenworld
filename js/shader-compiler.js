// ============================================================
// COMPILE SHADERS - Pattern da replicare in C/Rust
// ============================================================

/**
 * Crea e compila uno shader
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @param {number} type - Tipo di shader (gl.VERTEX_SHADER o gl.FRAGMENT_SHADER)
 * @param {string} source - Codice sorgente dello shader
 * @returns {WebGLShader|null} Lo shader compilato o null in caso di errore
 */
export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

/**
 * Crea un programma shader linkando vertex e fragment shader
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @param {string} vertexSource - Codice sorgente del vertex shader
 * @param {string} fragmentSource - Codice sorgente del fragment shader
 * @returns {WebGLProgram|null} Il programma linkato o null in caso di errore
 */
export function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}
