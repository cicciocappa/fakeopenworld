// ============================================================
// MAIN - Punto di ingresso dell'applicazione
// ============================================================

import { initWebGL } from './webgl-setup.js';
import { createProgram } from './shader-compiler.js';
import {
    meshVertexShader,
    meshFragmentShader,
    skyboxVertexShader,
    skyboxFragmentShader,
    billboardVertexShader,
    billboardFragmentShader
} from './shaders.js';
import {
    createGroundMesh,
    createSkyboxMesh,
    createBillboards,
    createDistantMountains
} from './geometry.js';
import { mat4Perspective } from './math-utils.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';

/**
 * Inizializza l'applicazione
 */
function init() {
    // Setup canvas e WebGL
    const canvas = document.getElementById('canvas');
    const gl = initWebGL(canvas);

    if (!gl) {
        console.error('Failed to initialize WebGL');
        return;
    }

    // Compila shader programs
    const meshProgram = createProgram(gl, meshVertexShader, meshFragmentShader);
    const skyboxProgram = createProgram(gl, skyboxVertexShader, skyboxFragmentShader);
    const billboardProgram = createProgram(gl, billboardVertexShader, billboardFragmentShader);

    if (!meshProgram || !skyboxProgram || !billboardProgram) {
        console.error('Failed to create shader programs');
        return;
    }

    const programs = {
        mesh: meshProgram,
        skybox: skyboxProgram,
        billboard: billboardProgram
    };

    // Crea geometrie
    const meshes = {
        ground: createGroundMesh(gl),
        skybox: createSkyboxMesh(gl),
        billboards: createBillboards(gl, 100),
        mountains: createDistantMountains(gl)
    };

    // Setup camera
    const camera = new Camera();
    camera.initInput(canvas);

    // Setup projection matrix
    const projectionMatrix = mat4Perspective(
        Math.PI / 3,
        canvas.width / canvas.height,
        0.1,
        1000
    );

    // Crea e avvia renderer
    const renderer = new Renderer(gl, programs, meshes, camera, projectionMatrix);
    renderer.start();

    console.log('Fake Open World initialized successfully!');
}

// Avvia l'applicazione quando il DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================================
// NOTE PER TRADUZIONE IN C/RUST:
// ============================================================
//
// 1. SHADERS: Identici, solo caricamento da file invece che string
// 2. BUFFER: gl.createBuffer() → glGenBuffers(), etc
// 3. MATH: Usa glm (C++) o nalgebra/cgmath (Rust)
// 4. WINDOW: SDL2 o GLFW per input e window management
// 5. STRUTTURA: Stessa logica, solo sintassi diversa
//
// Rust example equivalente:
// let vbo = gl.gen_buffers(1)[0];
// gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
// gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, &vertices, glow::STATIC_DRAW);
//
// LE TECNICHE (fog, billboards, mesh cards) sono identiche!
// ============================================================
