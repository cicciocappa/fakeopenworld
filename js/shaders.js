// ============================================================
// VERTEX SHADERS
// ============================================================

// Shader per geometria normale (terreno, oggetti) CON FOG
export const meshVertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vNormal;
    varying vec2 vTexCoord;
    varying float vDistance;  // Per fog
    varying vec3 vWorldPos;

    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vec4 viewPos = uViewMatrix * worldPos;
        gl_Position = uProjectionMatrix * viewPos;

        vNormal = normalize(mat3(uModelMatrix) * aNormal);
        vTexCoord = aTexCoord;
        vDistance = length(viewPos.xyz);  // Distanza dalla camera
        vWorldPos = worldPos.xyz;
    }
`;

// Shader per skybox (no fog, sempre "dietro" a tutto)
export const skyboxVertexShader = `
    attribute vec3 aPosition;

    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vTexCoord;

    void main() {
        // Rimuovi traslazione dalla view matrix per skybox fisso
        mat4 viewNoTranslation = uViewMatrix;
        viewNoTranslation[3][0] = 0.0;
        viewNoTranslation[3][1] = 0.0;
        viewNoTranslation[3][2] = 0.0;

        vec4 pos = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
        gl_Position = pos.xyww;  // Trick: z = w per essere sempre al far plane
        vTexCoord = aPosition;
    }
`;

// Shader per billboards (sempre rivolti verso camera)
export const billboardVertexShader = `
    attribute vec3 aPosition;  // Centro del billboard in world space
    attribute vec2 aOffset;    // Offset locale del vertice (-0.5 a 0.5)
    attribute vec2 aTexCoord;

    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uBillboardSize;

    varying vec2 vTexCoord;
    varying float vDistance;

    void main() {
        // Estrai right e up vector dalla view matrix
        vec3 right = vec3(uViewMatrix[0][0], uViewMatrix[1][0], uViewMatrix[2][0]);
        vec3 up = vec3(uViewMatrix[0][1], uViewMatrix[1][1], uViewMatrix[2][1]);

        // Costruisci posizione billboard che guarda sempre la camera
        vec3 worldPos = aPosition +
                       right * aOffset.x * uBillboardSize +
                       up * aOffset.y * uBillboardSize;

        vec4 viewPos = uViewMatrix * vec4(worldPos, 1.0);
        gl_Position = uProjectionMatrix * viewPos;

        vTexCoord = aTexCoord;
        vDistance = length(viewPos.xyz);
    }
`;

// ============================================================
// FRAGMENT SHADERS
// ============================================================

// Shader per geometria normale CON FOG
export const meshFragmentShader = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec2 vTexCoord;
    varying float vDistance;
    varying vec3 vWorldPos;

    uniform vec3 uLightDir;
    uniform vec3 uFogColor;
    uniform float uFogStart;
    uniform float uFogEnd;
    uniform vec3 uObjectColor;

    void main() {
        // Lighting semplice (diffuse)
        float light = max(dot(vNormal, uLightDir), 0.3);  // 0.3 = ambient
        vec3 color = uObjectColor * light;

        // FOG LINEARE - la tecnica chiave!
        float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
        color = mix(uFogColor, color, fogFactor);

        gl_FragColor = vec4(color, 1.0);
    }
`;

// Shader per skybox (gradient procedurale semplice)
export const skyboxFragmentShader = `
    precision mediump float;

    varying vec3 vTexCoord;

    void main() {
        // Skybox gradient procedurale: blu sopra, arancione orizzonte, più chiaro sotto
        float t = normalize(vTexCoord).y;

        vec3 skyColor = vec3(0.5, 0.7, 1.0);      // Blu cielo
        vec3 horizonColor = vec3(0.9, 0.7, 0.5);  // Arancione orizzonte
        vec3 groundColor = vec3(0.6, 0.6, 0.7);   // Grigio-azzurro sotto

        vec3 color;
        if (t > 0.0) {
            color = mix(horizonColor, skyColor, t);
        } else {
            color = mix(horizonColor, groundColor, -t);
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

// Shader per billboards con alpha test
export const billboardFragmentShader = `
    precision mediump float;

    varying vec2 vTexCoord;
    varying float vDistance;

    uniform vec3 uFogColor;
    uniform float uFogStart;
    uniform float uFogEnd;

    void main() {
        // Texture procedurale per albero (cerchio semplice)
        vec2 center = vTexCoord - 0.5;
        float dist = length(center);

        // Forma albero: cerchio verde con trasparenza
        if (dist > 0.4) discard;  // Alpha test invece di blending

        vec3 treeColor = vec3(0.2, 0.6, 0.2);

        // Applica fog anche ai billboards
        float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
        vec3 color = mix(uFogColor, treeColor, fogFactor);

        gl_FragColor = vec4(color, 1.0);
    }
`;
