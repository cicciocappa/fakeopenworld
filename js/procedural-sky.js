// ============================================================
// PROCEDURAL SKY - Cielo procedurale in stile Studio Ghibli
// ============================================================

/**
 * Shader per il cielo procedurale in stile Studio Ghibli
 */

// Vertex shader - semplice, passa solo le coordinate
export const proceduralSkyVertexShader = `
    attribute vec3 aPosition;

    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
        // Rimuovi traslazione dalla view matrix per skybox fisso
        mat4 viewNoTranslation = uViewMatrix;
        viewNoTranslation[3][0] = 0.0;
        viewNoTranslation[3][1] = 0.0;
        viewNoTranslation[3][2] = 0.0;

        vec4 pos = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
        gl_Position = pos.xyww;  // z = w per essere sempre al far plane
    }
`;

// Fragment shader - cielo procedurale in stile Ghibli con nuvole animate
export const proceduralSkyFragmentShader = `
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;

    // --- Rumore semplice ma morbido ---
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f); // smoothstep per morbidezza
        float u = hash(i + vec2(0.0, 0.0));
        float v = hash(i + vec2(1.0, 0.0));
        float w = hash(i + vec2(0.0, 1.0));
        float x = hash(i + vec2(1.0, 1.0));
        float a = mix(u, v, f.x);
        float b = mix(w, x, f.x);
        return mix(a, b, f.y);
    }

    // --- fBm morbido con pochi ottavi ---
    float fbm(vec2 p, float scale) {
        float value = 0.0;
        float amplitude = 1.0;
        for (int i = 0; i < 3; i++) {
            value += amplitude * noise(p * scale);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        uv.y += 0.2; // sposta il cielo un po' in alto

        // --- Colore base del cielo (azzurro Ghibli) ---
        vec3 skyBase = vec3(0.55, 0.75, 0.95); // azzurro tenero, non saturo

        // --- Strati di nuvole con velocità diverse ---
        float t = u_time * 0.05;
        float cloudLayer1 = fbm(uv * 1.8 + vec2(t * 0.6, t * 0.2), 1.0);
        float cloudLayer2 = fbm(uv * 2.5 + vec2(t * 1.0, t * 0.4), 1.2);

        // Combinazione morbida
        float clouds = (cloudLayer1 * 0.7 + cloudLayer2 * 0.3) * 1.2;
        float cloudShape = smoothstep(0.4, 0.8, clouds); // bordi soffusi

        // --- Colore delle nuvole (bianco caldo, non freddo!) ---
        vec3 cloudColor = vec3(0.98, 0.96, 0.92); // bianco avorio/crema

        // --- Mescola con il cielo ---
        vec3 finalSky = mix(skyBase, cloudColor, cloudShape);

        // --- Leggera sfumatura verso l'orizzonte (più chiaro in basso) ---
        finalSky = mix(finalSky, vec3(0.7, 0.85, 0.98), smoothstep(0.0, 0.8, -uv.y + 0.5));

        // --- Effetto "luce" delicato (simula illuminazione atmosferica) ---
        float glow = 1.0 + 0.2 * sin(uv.y * 3.0 + u_time * 0.1);
        finalSky *= glow;

        gl_FragColor = vec4(finalSky, 1.0);
    }
`;

/**
 * Crea una mesh sferica per il cielo procedurale
 * La sfera avvolge la camera e mostra il cielo procedurale
 * @param {WebGLRenderingContext} gl - Contesto WebGL
 * @param {number} radius - Raggio della sfera
 * @param {number} segments - Numero di segmenti (risoluzione)
 * @returns {{vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number}}
 */
export function createProceduralSkyMesh(gl, radius = 500, segments = 32) {
    const vertices = [];
    const indices = [];

    // Genera vertici della sfera usando coordinate sferiche
    for (let lat = 0; lat <= segments; lat++) {
        const theta = (lat * Math.PI) / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= segments; lon++) {
            const phi = (lon * 2 * Math.PI) / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            vertices.push(x * radius, y * radius, z * radius);
        }
    }

    // Genera indici per triangoli
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = lat * (segments + 1) + lon;
            const second = first + segments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    return { vbo, ibo, indexCount: indices.length };
}
