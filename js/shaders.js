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

// ============================================================
// TERRAIN SHADERS (Phong lighting)
// ============================================================

// Vertex shader per terreno con Phong lighting
export const terrainVertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;
    varying vec2 vTexCoord;
    varying float vDistance;

    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vec4 viewPos = uViewMatrix * worldPos;
        gl_Position = uProjectionMatrix * viewPos;

        vNormal = normalize(mat3(uModelMatrix) * aNormal);
        vWorldPos = worldPos.xyz;
        vViewPos = viewPos.xyz;
        vTexCoord = aTexCoord;
        vDistance = length(viewPos.xyz);
    }
`;

// Fragment shader per terreno con Phong lighting (ambient + diffuse + specular)
export const terrainFragmentShader = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewPos;
    varying vec2 vTexCoord;
    varying float vDistance;

    uniform vec3 uLightDir;          // Direzione luce (normalizzata)
    uniform vec3 uCameraPos;         // Posizione camera per specular
    uniform vec3 uTerrainColor;      // Colore base del terreno
    uniform vec3 uFogColor;
    uniform float uFogStart;
    uniform float uFogEnd;

    // TODO: Add texture support
    // uniform sampler2D uTerrainTexture;
    // uniform bool uUseTexture;

    void main() {
        // Normalize interpolated normal
        vec3 normal = normalize(vNormal);

        // Phong lighting components
        vec3 ambient = vec3(0.3);  // Ambient light

        // Diffuse
        float diffuseStrength = max(dot(normal, uLightDir), 0.0);
        vec3 diffuse = vec3(diffuseStrength);

        // Specular (Phong)
        vec3 viewDir = normalize(uCameraPos - vWorldPos);
        vec3 reflectDir = reflect(-uLightDir, normal);
        float specularStrength = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        vec3 specular = vec3(0.2) * specularStrength;  // Subtle specular

        // Combine lighting
        vec3 lighting = ambient + diffuse + specular;

        // TODO: When textures are implemented, use:
        // vec3 baseColor = uUseTexture ? texture2D(uTerrainTexture, vTexCoord).rgb : uTerrainColor;
        vec3 color = uTerrainColor * lighting;

        // Apply fog
        float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
        color = mix(uFogColor, color, fogFactor);

        gl_FragColor = vec4(color, 1.0);
    }
`;

// ============================================================
// MATTE PAINTING SHADERS
// ============================================================

// Vertex shader per matte painting layers con parallasse
export const mattePaintingVertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uParallaxFactor;  // 0.0 = fisso, 1.0 = movimento completo

    varying vec2 vTexCoord;
    varying vec3 vNormal;
    varying float vDistance;

    void main() {
        // Apply parallax effect to view matrix
        mat4 parallaxView = uViewMatrix;

        // Scale translation component by parallax factor
        // 0.0 = no movement (like skybox), 1.0 = full movement
        parallaxView[3][0] *= uParallaxFactor;
        parallaxView[3][2] *= uParallaxFactor;

        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vec4 viewPos = parallaxView * worldPos;
        gl_Position = uProjectionMatrix * viewPos;

        vTexCoord = aTexCoord;
        vNormal = normalize(mat3(uModelMatrix) * aNormal);
        vDistance = length(viewPos.xyz);
    }
`;

// Fragment shader per matte painting con texture e alpha blending
export const mattePaintingFragmentShader = `
    precision mediump float;

    varying vec2 vTexCoord;
    varying vec3 vNormal;
    varying float vDistance;

    uniform sampler2D uTexture;
    uniform bool uUseTexture;
    uniform vec3 uFallbackColor;
    uniform float uAlpha;
    uniform vec3 uFogColor;
    uniform float uFogStart;
    uniform float uFogEnd;
    uniform bool uUseFog;

    void main() {
        vec4 finalColor;

        if (uUseTexture) {
            // IMPORTANT: Use full RGBA from texture (including alpha channel!)
            vec4 texColor = texture2D(uTexture, vTexCoord);

            // Alpha test: discard fully transparent pixels
            if (texColor.a < 0.01) {
                discard;
            }

            finalColor = texColor;

            // Apply fog ONLY to opaque areas (not to transparent parts)
            // This prevents fog from filling transparent areas with fog color
            if (uUseFog && texColor.a > 0.5) {
                float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
                finalColor.rgb = mix(uFogColor, texColor.rgb, fogFactor);
                // Keep original alpha, don't let fog affect transparency
            }

            // Apply layer alpha multiplier
            finalColor.a *= uAlpha;

        } else {
            // Procedural fallback
            finalColor = vec4(uFallbackColor, uAlpha);

            if (uUseFog) {
                float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
                finalColor.rgb = mix(uFogColor, uFallbackColor, fogFactor);
            }
        }

        gl_FragColor = finalColor;
    }
`;

// Vertex shader per skybox con texture (equirectangular o cubemap)
export const skyboxTexturedVertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec2 vTexCoord;
    varying vec3 vPosition;

    void main() {
        // Remove translation from view matrix (skybox centered on camera)
        mat4 viewNoTranslation = uViewMatrix;
        viewNoTranslation[3][0] = 0.0;
        viewNoTranslation[3][1] = 0.0;
        viewNoTranslation[3][2] = 0.0;

        vec4 pos = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
        gl_Position = pos.xyww;  // z = w to place at far plane

        vTexCoord = aTexCoord;
        vPosition = aPosition;
    }
`;

// Fragment shader per skybox texturizzato con fallback procedurale
export const skyboxTexturedFragmentShader = `
    precision mediump float;

    varying vec2 vTexCoord;
    varying vec3 vPosition;

    uniform sampler2D uSkyboxTexture;
    uniform bool uUseTexture;

    void main() {
        vec3 color;

        if (uUseTexture) {
            // Use texture (equirectangular mapping)
            color = texture2D(uSkyboxTexture, vTexCoord).rgb;
        } else {
            // Fallback: procedural gradient (same as before)
            float t = normalize(vPosition).y;

            vec3 skyColor = vec3(0.5, 0.7, 1.0);      // Blue sky
            vec3 horizonColor = vec3(0.9, 0.7, 0.5);  // Orange horizon
            vec3 groundColor = vec3(0.6, 0.6, 0.7);   // Gray-blue below

            if (t > 0.0) {
                color = mix(horizonColor, skyColor, t);
            } else {
                color = mix(horizonColor, groundColor, -t);
            }
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

// ============================================================
// CUBEMAP SKYBOX SHADERS
// ============================================================

// Vertex shader per skybox cubemap
export const skyboxCubemapVertexShader = `
    attribute vec3 aPosition;

    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vTexCoord;

    void main() {
        // Remove translation from view matrix (skybox centered on camera)
        mat4 viewNoTranslation = uViewMatrix;
        viewNoTranslation[3][0] = 0.0;
        viewNoTranslation[3][1] = 0.0;
        viewNoTranslation[3][2] = 0.0;

        vec4 pos = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
        gl_Position = pos.xyww;  // z = w to place at far plane

        // Use position as texture coordinate for cubemap lookup
        vTexCoord = aPosition;
    }
`;

// Fragment shader per skybox cubemap con fallback procedurale
export const skyboxCubemapFragmentShader = `
    precision mediump float;

    varying vec3 vTexCoord;

    uniform samplerCube uCubemap;
    uniform bool uUseCubemap;

    void main() {
        vec3 color;

        if (uUseCubemap) {
            // Sample cubemap
            color = textureCube(uCubemap, vTexCoord).rgb;
        } else {
            // Fallback: procedural gradient (same as before)
            float t = normalize(vTexCoord).y;

            vec3 skyColor = vec3(0.5, 0.7, 1.0);      // Blue sky
            vec3 horizonColor = vec3(0.9, 0.7, 0.5);  // Orange horizon
            vec3 groundColor = vec3(0.6, 0.6, 0.7);   // Gray-blue below

            if (t > 0.0) {
                color = mix(horizonColor, skyColor, t);
            } else {
                color = mix(horizonColor, groundColor, -t);
            }
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;
