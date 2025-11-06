// ============================================================
// RENDERER
// ============================================================

import { mat4LookAt } from './math-utils.js';

/**
 * Classe renderer che gestisce il render loop
 */
export class Renderer {
    constructor(gl, programs, meshes, camera, projectionMatrix, mattePaintingManager = null) {
        this.gl = gl;
        this.programs = programs;
        this.meshes = meshes;
        this.camera = camera;
        this.projectionMatrix = projectionMatrix;
        this.mattePaintingManager = mattePaintingManager;

        // FOG SETTINGS - PARAMETRI CHIAVE
        this.fogColor = [0.7, 0.8, 0.9];  // Colore fog (simile a skybox)
        this.fogStart = 30.0;
        this.fogEnd = 120.0;

        this.lastTime = 0;
    }

    /**
     * Render loop principale
     * @param {number} time - Tempo corrente in millisecondi
     */
    render(time) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.camera.update(dt);

        const center = this.camera.getTarget();
        const viewMatrix = mat4LookAt(this.camera.pos, center, [0, 1, 0]);

        const gl = this.gl;
        gl.clearColor(...this.fogColor, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // 1. Render SKYBOX (sempre per primo, no depth write)
        this.renderSkybox(viewMatrix);

        // 2. Render PROCEDURAL SKY (cielo Ghibli con nuvole animate)
        this.renderProceduralSky(viewMatrix, time);

        // 3. Render MATTE PAINTING LAYERS (dal più lontano al più vicino)
        if (this.mattePaintingManager) {
            this.renderMattePaintingLayers(viewMatrix);
        }

        // 4. Render TERRENO PROCEDURALE con Phong lighting
        this.renderTerrain(viewMatrix);

        // TEMPORARILY DISABLED - Replaced by matte painting
        // 5. Render old ground plane
        // this.renderGround(viewMatrix);

        // 6. Render MONTAGNE LONTANE (mesh cards) - old version
        // this.renderMountains(viewMatrix);

        // 7. Render BILLBOARDS (alberi)
        // this.renderBillboards(viewMatrix);

        requestAnimationFrame((t) => this.render(t));
    }

    /**
     * Render skybox (procedurale, texture, o cubemap)
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderSkybox(viewMatrix) {
        const gl = this.gl;
        const mesh = this.meshes.skybox;

        // Decide which program to use based on matte painting manager settings
        let program;
        let useCubemap = false;
        let useTexture = false;

        if (this.mattePaintingManager && this.mattePaintingManager.useCubemap) {
            // Use cubemap program
            program = this.programs.skyboxCubemap;
            useCubemap = true;
        } else if (this.mattePaintingManager && !this.mattePaintingManager.useProcedural) {
            // Use textured skybox program
            program = this.programs.skyboxTextured;
            useTexture = true;
        } else {
            // Use procedural skybox program (default)
            program = this.programs.skybox;
        }

        gl.depthMask(false);

        // CRITICAL: Disable face culling for skybox since we're inside the cube
        gl.disable(gl.CULL_FACE);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 12, 0);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);

        // Set texture or cubemap if using
        if (useCubemap && this.mattePaintingManager.skyboxCubemap) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.mattePaintingManager.skyboxCubemap);
            gl.uniform1i(gl.getUniformLocation(program, 'uCubemap'), 0);
            gl.uniform1i(gl.getUniformLocation(program, 'uUseCubemap'), 1);
        } else if (useCubemap) {
            // Cubemap not loaded yet, use fallback
            gl.uniform1i(gl.getUniformLocation(program, 'uUseCubemap'), 0);
        }

        if (useTexture && this.mattePaintingManager.skyboxTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.mattePaintingManager.skyboxTexture);
            gl.uniform1i(gl.getUniformLocation(program, 'uSkyboxTexture'), 0);
            gl.uniform1i(gl.getUniformLocation(program, 'uUseTexture'), 1);
        } else if (useTexture) {
            // Texture not loaded yet, use fallback
            gl.uniform1i(gl.getUniformLocation(program, 'uUseTexture'), 0);
        }

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

        // Re-enable face culling and depth writing
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
    }

    /**
     * Render cielo procedurale in stile Studio Ghibli
     * @param {Float32Array} viewMatrix - Matrice view
     * @param {number} time - Tempo corrente in millisecondi
     */
    renderProceduralSky(viewMatrix, time) {
        const gl = this.gl;
        const program = this.programs.proceduralSky;
        const mesh = this.meshes.proceduralSky;

        // Disable depth writing but enable depth test
        // This ensures the sky is behind everything else
        gl.depthMask(false);

        // CRITICAL: Disable blending for pure colors (as requested)
        gl.disable(gl.BLEND);

        // Disable face culling since we're inside the sphere
        gl.disable(gl.CULL_FACE);

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 12, 0);

        // Set uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);

        // Pass time in seconds (performance.now() / 1000)
        gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time / 1000.0);

        // Pass resolution
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), gl.canvas.width, gl.canvas.height);

        // Draw the sky sphere using UNSIGNED_INT indices
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);

        // Re-enable depth writing and face culling
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
    }

    /**
     * Render terreno
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderGround(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.mesh;
        const mesh = this.meshes.ground;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        const normLoc = gl.getAttribLocation(program, 'aNormal');
        const texLoc = gl.getAttribLocation(program, 'aTexCoord');

        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(normLoc);
        gl.enableVertexAttribArray(texLoc);

        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 32, 24);

        // Matrice model (identità)
        const modelMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModelMatrix'), false, modelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);
        gl.uniform3f(gl.getUniformLocation(program, 'uLightDir'), 0.5, 0.7, 0.3);
        gl.uniform3fv(gl.getUniformLocation(program, 'uFogColor'), this.fogColor);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogStart'), this.fogStart);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogEnd'), this.fogEnd);
        gl.uniform3f(gl.getUniformLocation(program, 'uObjectColor'), 0.4, 0.5, 0.3);

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Render procedural terrain with Phong lighting
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderTerrain(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.terrain;
        const mesh = this.meshes.terrain;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        const normLoc = gl.getAttribLocation(program, 'aNormal');
        const texLoc = gl.getAttribLocation(program, 'aTexCoord');

        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(normLoc);
        gl.enableVertexAttribArray(texLoc);

        // Vertex format: position(3) + normal(3) + texCoord(2) = 8 floats = 32 bytes
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 32, 24);

        // Model matrix (identity - terrain already centered at 0,0)
        const modelMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);

        // Directional light (sun)
        const lightDir = [0.5, 0.7, 0.3];
        // Normalize light direction
        const len = Math.sqrt(lightDir[0]**2 + lightDir[1]**2 + lightDir[2]**2);
        lightDir[0] /= len;
        lightDir[1] /= len;
        lightDir[2] /= len;

        // Terrain color (brownish-green)
        const terrainColor = [0.4, 0.5, 0.3];

        // Set uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModelMatrix'), false, modelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);
        gl.uniform3fv(gl.getUniformLocation(program, 'uLightDir'), lightDir);
        gl.uniform3fv(gl.getUniformLocation(program, 'uCameraPos'), this.camera.pos);
        gl.uniform3fv(gl.getUniformLocation(program, 'uTerrainColor'), terrainColor);
        gl.uniform3fv(gl.getUniformLocation(program, 'uFogColor'), this.fogColor);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogStart'), this.fogStart);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogEnd'), this.fogEnd);

        // Draw terrain using indices
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
    }

    /**
     * Render montagne lontane
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderMountains(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.mesh;
        const mesh = this.meshes.mountains;

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        const normLoc = gl.getAttribLocation(program, 'aNormal');
        const texLoc = gl.getAttribLocation(program, 'aTexCoord');

        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 32, 24);

        gl.uniform3f(gl.getUniformLocation(program, 'uObjectColor'), 0.3, 0.35, 0.5);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    /**
     * Render billboards
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderBillboards(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.billboard;
        const mesh = this.meshes.billboards;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        const offsetLoc = gl.getAttribLocation(program, 'aOffset');
        const texLoc = gl.getAttribLocation(program, 'aTexCoord');

        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(offsetLoc);
        gl.enableVertexAttribArray(texLoc);

        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(offsetLoc, 2, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 28, 20);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);
        gl.uniform1f(gl.getUniformLocation(program, 'uBillboardSize'), 8.0);
        gl.uniform3fv(gl.getUniformLocation(program, 'uFogColor'), this.fogColor);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogStart'), this.fogStart);
        gl.uniform1f(gl.getUniformLocation(program, 'uFogEnd'), this.fogEnd);

        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    }

    /**
     * Render matte painting layers con parallasse
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderMattePaintingLayers(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.mattePainting;

        gl.useProgram(program);

        // Enable alpha blending for transparent layers
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Model matrix (identity)
        const modelMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);

        // Render each layer from farthest to nearest
        const sortedLayers = [...this.mattePaintingManager.layers].sort((a, b) => b.distance - a.distance);

        for (const layer of sortedLayers) {
            if (!layer.mesh) continue;

            gl.bindBuffer(gl.ARRAY_BUFFER, layer.mesh.vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layer.mesh.ibo);

            const posLoc = gl.getAttribLocation(program, 'aPosition');
            const normLoc = gl.getAttribLocation(program, 'aNormal');
            const texLoc = gl.getAttribLocation(program, 'aTexCoord');

            gl.enableVertexAttribArray(posLoc);
            gl.enableVertexAttribArray(normLoc);
            gl.enableVertexAttribArray(texLoc);

            // Vertex format: position(3) + normal(3) + texCoord(2) = 8 floats = 32 bytes
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 32, 12);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 32, 24);

            // Set uniforms
            gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModelMatrix'), false, modelMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);
            gl.uniform1f(gl.getUniformLocation(program, 'uParallaxFactor'), layer.parallaxFactor);

            // Texture or fallback color
            if (layer.useTexture && layer.texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, layer.texture);
                gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 0);
                gl.uniform1i(gl.getUniformLocation(program, 'uUseTexture'), 1);
            } else {
                gl.uniform1i(gl.getUniformLocation(program, 'uUseTexture'), 0);
                gl.uniform3f(gl.getUniformLocation(program, 'uFallbackColor'), 0.5, 0.5, 0.6);
            }

            gl.uniform1f(gl.getUniformLocation(program, 'uAlpha'), layer.alpha);

            // Fog settings (controlled by layer.useFog flag)
            gl.uniform1i(gl.getUniformLocation(program, 'uUseFog'), layer.useFog ? 1 : 0);
            if (layer.useFog) {
                gl.uniform3fv(gl.getUniformLocation(program, 'uFogColor'), this.fogColor);
                gl.uniform1f(gl.getUniformLocation(program, 'uFogStart'), this.fogStart);
                gl.uniform1f(gl.getUniformLocation(program, 'uFogEnd'), this.fogEnd);
            }

            // Draw
            gl.drawElements(gl.TRIANGLES, layer.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }

        // Disable blending
        gl.disable(gl.BLEND);
    }

    /**
     * Avvia il render loop
     */
    start() {
        requestAnimationFrame((t) => this.render(t));
    }
}
