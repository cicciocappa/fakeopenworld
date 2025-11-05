// ============================================================
// CAMERA & INPUT
// ============================================================

/**
 * Crea e gestisce la camera FPS
 */
export class Camera {
    constructor() {
        // Start at center of terrain, elevated to see the landscape
        this.pos = [0, 20, 50];
        this.yaw = 0;
        this.pitch = -0.3;  // Look slightly downward to see terrain better
        this.forward = [0, 0, -1];
        this.right = [1, 0, 0];

        this.input = {
            forward: false,
            back: false,
            left: false,
            right: false
        };
    }

    /**
     * Inizializza gli event listener per input
     * @param {HTMLCanvasElement} canvas - Canvas per pointer lock
     */
    initInput(canvas) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.input.forward = true;
            if (e.key === 's') this.input.back = true;
            if (e.key === 'a') this.input.left = true;
            if (e.key === 'd') this.input.right = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'w') this.input.forward = false;
            if (e.key === 's') this.input.back = false;
            if (e.key === 'a') this.input.left = false;
            if (e.key === 'd') this.input.right = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === canvas) {
                this.yaw -= e.movementX * 0.002;
                this.pitch -= e.movementY * 0.002;
                this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));
            }
        });

        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
        });
    }

    /**
     * Aggiorna posizione e rotazione camera
     * @param {number} dt - Delta time in secondi
     */
    update(dt) {
        // Aggiorna direzioni
        this.forward = [
            Math.cos(this.pitch) * Math.sin(this.yaw),
            Math.sin(this.pitch),
            Math.cos(this.pitch) * Math.cos(this.yaw)
        ];
        this.right = [
            Math.sin(this.yaw - Math.PI/2),
            0,
            Math.cos(this.yaw - Math.PI/2)
        ];

        // Movimento
        const speed = 20 * dt;
        if (this.input.forward) {
            this.pos[0] += this.forward[0] * speed;
            this.pos[2] += this.forward[2] * speed;
        }
        if (this.input.back) {
            this.pos[0] -= this.forward[0] * speed;
            this.pos[2] -= this.forward[2] * speed;
        }
        if (this.input.left) {
            this.pos[0] -= this.right[0] * speed;
            this.pos[2] -= this.right[2] * speed;
        }
        if (this.input.right) {
            this.pos[0] += this.right[0] * speed;
            this.pos[2] += this.right[2] * speed;
        }
    }

    /**
     * Ottiene il punto target della camera
     * @returns {Array<number>} Punto center [x, y, z]
     */
    getTarget() {
        return [
            this.pos[0] + this.forward[0],
            this.pos[1] + this.forward[1],
            this.pos[2] + this.forward[2]
        ];
    }
}
