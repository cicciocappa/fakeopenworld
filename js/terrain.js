/**
 * Terrain generation module
 * Handles procedural terrain generation from heightmaps
 */

// Simple Perlin noise implementation
class PerlinNoise {
    constructor(seed = Math.random()) {
        this.gradients = {};
        this.memory = {};
        this.seed = seed;
    }

    rand_vect() {
        const theta = Math.random() * 2 * Math.PI;
        return { x: Math.cos(theta), y: Math.sin(theta) };
    }

    dot_prod_grid(x, y, vx, vy) {
        let g_vect;
        const d_vect = { x: x - vx, y: y - vy };
        const grid_key = `${vx},${vy}`;

        if (this.gradients[grid_key]) {
            g_vect = this.gradients[grid_key];
        } else {
            g_vect = this.rand_vect();
            this.gradients[grid_key] = g_vect;
        }

        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    }

    smootherstep(x) {
        return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    }

    interp(x, a, b) {
        return a + this.smootherstep(x) * (b - a);
    }

    get(x, y) {
        const key = `${x},${y}`;
        if (this.memory[key]) {
            return this.memory[key];
        }

        const xf = Math.floor(x);
        const yf = Math.floor(y);

        const tl = this.dot_prod_grid(x, y, xf, yf);
        const tr = this.dot_prod_grid(x, y, xf + 1, yf);
        const bl = this.dot_prod_grid(x, y, xf, yf + 1);
        const br = this.dot_prod_grid(x, y, xf + 1, yf + 1);

        const xt = this.interp(x - xf, tl, tr);
        const xb = this.interp(x - xf, bl, br);
        const v = this.interp(y - yf, xt, xb);

        this.memory[key] = v;
        return v;
    }
}

/**
 * Heightmap class - represents a 2D height field
 */
export class Heightmap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Float32Array(width * height);
    }

    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.data[y * this.width + x];
    }

    set(x, y, value) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return;
        }
        this.data[y * this.width + x] = value;
    }

    // Add value to existing height
    add(x, y, value) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return;
        }
        this.data[y * this.width + x] += value;
    }

    // Apply Perlin noise to the heightmap
    applyPerlinNoise(scale = 0.05, amplitude = 10, octaves = 4) {
        const perlin = new PerlinNoise();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let value = 0;
                let freq = scale;
                let amp = amplitude;

                // Multiple octaves for more interesting terrain
                for (let octave = 0; octave < octaves; octave++) {
                    value += perlin.get(x * freq, y * freq) * amp;
                    freq *= 2;
                    amp *= 0.5;
                }

                this.add(x, y, value);
            }
        }
    }

    // Draw a filled rectangle (flattened area)
    drawRectangle(x, y, width, height, heightValue) {
        for (let py = y; py < y + height && py < this.height; py++) {
            for (let px = x; px < x + width && px < this.width; px++) {
                if (px >= 0 && py >= 0) {
                    this.set(px, py, heightValue);
                }
            }
        }
    }

    // Draw a filled circle (flattened area)
    drawCircle(centerX, centerY, radius, heightValue) {
        const radiusSq = radius * radius;

        for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y++) {
            for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= radiusSq) {
                    this.set(x, y, heightValue);
                }
            }
        }
    }
}

/**
 * Generate a procedural heightmap with noise and geometric shapes
 * Creates flat areas for buildings, towers, etc.
 */
export function generateProceduralHeightmap(width = 256, height = 256) {
    const heightmap = new Heightmap(width, height);

    // Apply Perlin noise for natural terrain variation
    heightmap.applyPerlinNoise(0.05, 8, 4);

    // Flat areas for structures (height = 2.0)
    // 2 squares
    heightmap.drawRectangle(50, 50, 40, 40, 2.0);    // Top-left area
    heightmap.drawRectangle(170, 170, 35, 35, 2.0);  // Bottom-right area

    // 2 rectangles
    heightmap.drawRectangle(100, 30, 60, 30, 2.5);   // Top-center area
    heightmap.drawRectangle(30, 150, 50, 40, 1.8);   // Bottom-left area

    // 1 circle
    heightmap.drawCircle(128, 128, 25, 3.0);         // Center area

    return heightmap;
}

/**
 * Create terrain mesh from heightmap with smooth normals
 * Each pixel in the heightmap corresponds to 1 meter in world space
 * Terrain is centered at (0, 0) in world coordinates
 */
export function createTerrainMesh(gl, heightmap) {
    const width = heightmap.width;
    const height = heightmap.height;

    // Calculate offsets to center the terrain at (0, 0)
    const offsetX = -width / 2;
    const offsetZ = -height / 2;

    // Create vertices (one per heightmap pixel)
    const vertices = [];
    const indices = [];

    // Generate vertices with positions
    for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
            const worldX = x + offsetX;
            const worldY = heightmap.get(x, z);
            const worldZ = z + offsetZ;

            vertices.push({
                pos: [worldX, worldY, worldZ],
                normal: [0, 1, 0]  // Will be calculated later
            });
        }
    }

    // Generate indices for triangles
    for (let z = 0; z < height - 1; z++) {
        for (let x = 0; x < width - 1; x++) {
            const topLeft = z * width + x;
            const topRight = topLeft + 1;
            const bottomLeft = (z + 1) * width + x;
            const bottomRight = bottomLeft + 1;

            // Two triangles per quad
            indices.push(topLeft, bottomLeft, topRight);
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }

    // Calculate smooth normals (average of adjacent face normals)
    const normals = new Array(vertices.length).fill(null).map(() => [0, 0, 0]);

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const v0 = vertices[i0].pos;
        const v1 = vertices[i1].pos;
        const v2 = vertices[i2].pos;

        // Calculate face normal
        const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        // Add to each vertex normal
        for (let j = 0; j < 3; j++) {
            normals[i0][j] += normal[j];
            normals[i1][j] += normal[j];
            normals[i2][j] += normal[j];
        }
    }

    // Normalize all normals
    for (let i = 0; i < normals.length; i++) {
        const n = normals[i];
        const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
        if (len > 0) {
            normals[i] = [n[0] / len, n[1] / len, n[2] / len];
        } else {
            normals[i] = [0, 1, 0];
        }
        vertices[i].normal = normals[i];
    }

    // Build interleaved vertex data: position(3) + normal(3) + texCoord(2)
    const vertexData = new Float32Array(vertices.length * 8);

    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const offset = i * 8;

        // Position
        vertexData[offset + 0] = v.pos[0];
        vertexData[offset + 1] = v.pos[1];
        vertexData[offset + 2] = v.pos[2];

        // Normal
        vertexData[offset + 3] = v.normal[0];
        vertexData[offset + 4] = v.normal[1];
        vertexData[offset + 5] = v.normal[2];

        // Texture coordinates (for future use)
        // Map to 0-1 range based on position in heightmap
        vertexData[offset + 6] = (v.pos[0] - offsetX) / width;
        vertexData[offset + 7] = (v.pos[2] - offsetZ) / height;
    }

    // Create WebGL buffers
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    return {
        vbo: vbo,
        ibo: ibo,
        indexCount: indices.length,
        vertexCount: vertices.length
    };
}

/**
 * Load terrain from OBJ file
 * TODO: Implement OBJ loading functionality
 */
export function loadTerrainFromOBJ(gl, filepath) {
    // TODO: Implement OBJ file loading
    // This will parse the OBJ file and create the terrain mesh from it
    // For now, return null to indicate not implemented
    console.warn('loadTerrainFromOBJ not yet implemented');
    return null;
}
