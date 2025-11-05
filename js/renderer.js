// ============================================================
// RENDERER
// ============================================================

import { mat4LookAt } from './math-utils.js';

/**
 * Classe renderer che gestisce il render loop
 */
export class Renderer {
    constructor(gl, programs, meshes, camera, projectionMatrix) {
        this.gl = gl;
        this.programs = programs;
        this.meshes = meshes;
        this.camera = camera;
        this.projectionMatrix = projectionMatrix;

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

        // 2. Render TERRENO con fog
        this.renderGround(viewMatrix);

        // 3. Render MONTAGNE LONTANE (mesh cards)
        this.renderMountains(viewMatrix);

        // 4. Render BILLBOARDS (alberi)
        this.renderBillboards(viewMatrix);

        requestAnimationFrame((t) => this.render(t));
    }

    /**
     * Render skybox
     * @param {Float32Array} viewMatrix - Matrice view
     */
    renderSkybox(viewMatrix) {
        const gl = this.gl;
        const program = this.programs.skybox;
        const mesh = this.meshes.skybox;

        gl.depthMask(false);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

        const posLoc = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 12, 0);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, this.projectionMatrix);

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        gl.depthMask(true);
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
     * Avvia il render loop
     */
    start() {
        requestAnimationFrame((t) => this.render(t));
    }
}
