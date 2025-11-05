# Guida: Traduzione da WebGL a C/Rust + OpenGL

## SETUP INIZIALE

### C + OpenGL + GLFW
```c
// Dependencies: OpenGL, GLFW, GLEW/GLAD, GLM
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

int main() {
    glfwInit();
    GLFWwindow* window = glfwCreateWindow(1280, 720, "OpenWorld", NULL, NULL);
    glfwMakeContextCurrent(window);
    glewInit();
    
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);
    
    // ... resto del codice
    
    while (!glfwWindowShouldClose(window)) {
        render();
        glfwSwapBuffers(window);
        glfwPollEvents();
    }
}
```

### Rust + OpenGL + glutin/winit
```rust
// Cargo.toml dependencies:
// glow = "0.13"
// glutin = "0.30"
// nalgebra-glm as glm = "0.18"

use glow::HasContext;
use glutin::event_loop::EventLoop;

fn main() {
    let event_loop = EventLoop::new();
    let window_builder = glutin::window::WindowBuilder::new()
        .with_title("OpenWorld")
        .with_inner_size(glutin::dpi::LogicalSize::new(1280.0, 720.0));
    
    let gl_window = glutin::ContextBuilder::new()
        .with_vsync(true)
        .build_windowed(window_builder, &event_loop)
        .unwrap();
    
    let gl_window = unsafe { gl_window.make_current().unwrap() };
    let gl = unsafe {
        glow::Context::from_loader_function(|s| {
            gl_window.get_proc_address(s) as *const _
        })
    };
    
    unsafe {
        gl.enable(glow::DEPTH_TEST);
        gl.enable(glow::CULL_FACE);
    }
    
    // ... resto del codice
}
```

---

## SHADERS: IDENTICI!

I tuoi shader GLSL sono IDENTICI in C/Rust. Unica differenza: caricamento.

### WebGL
```javascript
const vertexSource = `...shader code...`;
```

### C
```c
// Leggi da file
char* load_shader(const char* filename) {
    FILE* f = fopen(filename, "r");
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    char* buffer = malloc(size + 1);
    fread(buffer, 1, size, f);
    buffer[size] = 0;
    fclose(f);
    return buffer;
}

// Oppure inline con raw string (C++11)
const char* vertexShader = R"(
    #version 330 core
    layout(location = 0) in vec3 aPosition;
    // ... resto shader
)";
```

### Rust
```rust
// Da file
let vertex_source = std::fs::read_to_string("shader.vert").unwrap();

// O inline con raw string
let vertex_source = r#"
    #version 330 core
    layout(location = 0) in vec3 aPosition;
    // ... resto shader
"#;
```

---

## COMPILAZIONE SHADER

### WebGL → C
```c
GLuint create_shader(GLenum type, const char* source) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, NULL);
    glCompileShader(shader);
    
    // Error checking
    GLint success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        char log[512];
        glGetShaderInfoLog(shader, 512, NULL, log);
        fprintf(stderr, "Shader error: %s\n", log);
    }
    return shader;
}

GLuint create_program(const char* vertSrc, const char* fragSrc) {
    GLuint vert = create_shader(GL_VERTEX_SHADER, vertSrc);
    GLuint frag = create_shader(GL_FRAGMENT_SHADER, fragSrc);
    
    GLuint program = glCreateProgram();
    glAttachShader(program, vert);
    glAttachShader(program, frag);
    glLinkProgram(program);
    
    glDeleteShader(vert);
    glDeleteShader(frag);
    
    return program;
}
```

### WebGL → Rust
```rust
unsafe fn create_shader(gl: &glow::Context, shader_type: u32, source: &str) 
    -> glow::Shader {
    let shader = gl.create_shader(shader_type).unwrap();
    gl.shader_source(shader, source);
    gl.compile_shader(shader);
    
    if !gl.get_shader_compile_status(shader) {
        panic!("{}", gl.get_shader_info_log(shader));
    }
    shader
}

unsafe fn create_program(gl: &glow::Context, vert_src: &str, frag_src: &str) 
    -> glow::Program {
    let vert = create_shader(gl, glow::VERTEX_SHADER, vert_src);
    let frag = create_shader(gl, glow::FRAGMENT_SHADER, frag_src);
    
    let program = gl.create_program().unwrap();
    gl.attach_shader(program, vert);
    gl.attach_shader(program, frag);
    gl.link_program(program);
    
    gl.delete_shader(vert);
    gl.delete_shader(frag);
    
    program
}
```

---

## BUFFER MANAGEMENT

### WebGL
```javascript
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
```

### C
```c
GLuint vbo;
glGenBuffers(1, &vbo);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

### Rust
```rust
let vbo = unsafe { gl.create_buffer().unwrap() };
unsafe {
    gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
    gl.buffer_data_u8_slice(
        glow::ARRAY_BUFFER,
        bytemuck::cast_slice(&vertices),
        glow::STATIC_DRAW
    );
}
```

---

## VERTEX ATTRIBUTES

### WebGL
```javascript
const posLoc = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 32, 0);
```

### C
```c
GLint posLoc = glGetAttribLocation(program, "aPosition");
glEnableVertexAttribArray(posLoc);
glVertexAttribPointer(posLoc, 3, GL_FLOAT, GL_FALSE, 32, (void*)0);

// OPPURE con layout in shader (più moderno):
// layout(location = 0) in vec3 aPosition;
glEnableVertexAttribArray(0);
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 32, (void*)0);
```

### Rust
```rust
let pos_loc = unsafe {
    gl.get_attrib_location(program, "aPosition").unwrap()
};
unsafe {
    gl.enable_vertex_attrib_array(pos_loc);
    gl.vertex_attrib_pointer_f32(
        pos_loc, 3, glow::FLOAT, false, 32, 0
    );
}
```

---

## UNIFORMS

### WebGL
```javascript
const loc = gl.getUniformLocation(program, 'uViewMatrix');
gl.uniformMatrix4fv(loc, false, viewMatrix);
gl.uniform3f(loc, 0.5, 0.7, 0.3);
```

### C
```c
GLint loc = glGetUniformLocation(program, "uViewMatrix");
glUniformMatrix4fv(loc, 1, GL_FALSE, glm::value_ptr(viewMatrix));
glUniform3f(loc, 0.5f, 0.7f, 0.3f);
```

### Rust
```rust
let loc = unsafe {
    gl.get_uniform_location(program, "uViewMatrix")
};
unsafe {
    gl.uniform_matrix_4_f32_slice(
        loc.as_ref(), false, view_matrix.as_slice()
    );
    gl.uniform_3_f32(loc.as_ref(), 0.5, 0.7, 0.3);
}
```

---

## MATEMATICA: GLM

### WebGL (custom)
```javascript
function mat4Perspective(fov, aspect, near, far) {
    // ... implementazione manuale
}
```

### C (GLM)
```c
#include <glm/gtc/matrix_transform.hpp>

glm::mat4 projection = glm::perspective(
    glm::radians(60.0f),  // fov
    aspect,               // aspect ratio
    0.1f,                 // near
    1000.0f               // far
);

glm::mat4 view = glm::lookAt(
    glm::vec3(camPos),    // eye
    glm::vec3(camTarget), // center
    glm::vec3(0,1,0)      // up
);
```

### Rust (nalgebra-glm)
```rust
use nalgebra_glm as glm;

let projection = glm::perspective(
    aspect,
    60_f32.to_radians(),
    0.1,
    1000.0
);

let view = glm::look_at(
    &glm::vec3(cam_pos.x, cam_pos.y, cam_pos.z),
    &glm::vec3(target.x, target.y, target.z),
    &glm::vec3(0.0, 1.0, 0.0)
);
```

---

## RENDER LOOP STRUCTURE

### C
```c
while (!glfwWindowShouldClose(window)) {
    float deltaTime = calculateDeltaTime();
    
    processInput(window, deltaTime);
    updateCamera(deltaTime);
    
    glClearColor(0.7f, 0.8f, 0.9f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    
    // Render skybox
    glDepthMask(GL_FALSE);
    renderSkybox();
    glDepthMask(GL_TRUE);
    
    // Render geometry with fog
    renderTerrain();
    renderMountains();
    
    // Render billboards
    renderBillboards();
    
    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

### Rust
```rust
event_loop.run(move |event, _, control_flow| {
    match event {
        Event::WindowEvent { event, .. } => match event {
            WindowEvent::CloseRequested => {
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        },
        Event::MainEventsCleared => {
            let delta_time = calculate_delta_time();
            
            update_camera(delta_time);
            
            unsafe {
                gl.clear_color(0.7, 0.8, 0.9, 1.0);
                gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
                
                gl.depth_mask(false);
                render_skybox(&gl);
                gl.depth_mask(true);
                
                render_terrain(&gl);
                render_mountains(&gl);
                render_billboards(&gl);
            }
            
            gl_window.swap_buffers().unwrap();
        }
        _ => {}
    }
});
```

---

## STRUCT PER ORGANIZZARE

### C
```c
typedef struct {
    GLuint vbo;
    GLuint ibo;
    GLuint indexCount;
} Mesh;

typedef struct {
    GLuint program;
    GLint uViewMatrix;
    GLint uProjectionMatrix;
    GLint uFogStart;
    // ... altri uniform locations
} ShaderProgram;

typedef struct {
    glm::vec3 position;
    float yaw;
    float pitch;
} Camera;
```

### Rust
```rust
struct Mesh {
    vbo: glow::Buffer,
    ibo: Option<glow::Buffer>,
    index_count: i32,
}

struct ShaderProgram {
    program: glow::Program,
    u_view_matrix: Option<glow::UniformLocation>,
    u_projection_matrix: Option<glow::UniformLocation>,
    u_fog_start: Option<glow::UniformLocation>,
}

struct Camera {
    position: glm::Vec3,
    yaw: f32,
    pitch: f32,
}
```

---

## INPUT HANDLING

### C + GLFW
```c
void key_callback(GLFWwindow* window, int key, int scancode, 
                  int action, int mods) {
    if (key == GLFW_KEY_W && action == GLFW_PRESS)
        input.forward = true;
    if (key == GLFW_KEY_W && action == GLFW_RELEASE)
        input.forward = false;
    // ... altri tasti
}

void mouse_callback(GLFWwindow* window, double xpos, double ypos) {
    if (firstMouse) {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }
    
    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;
    
    camera.yaw += xoffset * 0.002f;
    camera.pitch += yoffset * 0.002f;
}

glfwSetKeyCallback(window, key_callback);
glfwSetCursorPosCallback(window, mouse_callback);
glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```

### Rust + winit
```rust
Event::WindowEvent { event, .. } => match event {
    WindowEvent::KeyboardInput { input, .. } => {
        if let Some(keycode) = input.virtual_keycode {
            let pressed = input.state == ElementState::Pressed;
            match keycode {
                VirtualKeyCode::W => input_state.forward = pressed,
                VirtualKeyCode::S => input_state.back = pressed,
                VirtualKeyCode::A => input_state.left = pressed,
                VirtualKeyCode::D => input_state.right = pressed,
                _ => {}
            }
        }
    }
    WindowEvent::CursorMoved { position, .. } => {
        let delta_x = position.x - last_mouse.0;
        let delta_y = position.y - last_mouse.1;
        
        camera.yaw -= delta_x as f32 * 0.002;
        camera.pitch -= delta_y as f32 * 0.002;
        
        last_mouse = (position.x, position.y);
    }
    _ => {}
}
```

---

## TECNICHE IDENTICHE IN TUTTE LE PIATTAFORME

Le tecniche di rendering sono IDENTICHE:

1. **FOG** - Stesso shader fragment, stessi parametri
2. **BILLBOARDS** - Stesso vertex shader, stessa logica
3. **MESH CARDS** - Stessa geometria, stesso posizionamento
4. **SKYBOX** - Stesso cubo, stesso trick z=w

La matematica dietro non cambia mai!

---

## ESEMPIO COMPLETO MINIMALE C

```c
// gcc main.c -lglfw -lGLEW -lGL -lm

#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <stdio.h>
#include <math.h>

const char* vertShader = "#version 330 core\n"
    "layout(location=0) in vec3 pos;\n"
    "uniform mat4 mvp;\n"
    "void main() { gl_Position = mvp * vec4(pos, 1.0); }\n";

const char* fragShader = "#version 330 core\n"
    "out vec4 color;\n"
    "void main() { color = vec4(0.5, 0.7, 1.0, 1.0); }\n";

int main() {
    glfwInit();
    GLFWwindow* w = glfwCreateWindow(800, 600, "Test", NULL, NULL);
    glfwMakeContextCurrent(w);
    glewInit();
    
    GLuint vs = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vs, 1, &vertShader, NULL);
    glCompileShader(vs);
    
    GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fs, 1, &fragShader, NULL);
    glCompileShader(fs);
    
    GLuint prog = glCreateProgram();
    glAttachShader(prog, vs);
    glAttachShader(prog, fs);
    glLinkProgram(prog);
    
    float verts[] = {-0.5,-0.5,0, 0.5,-0.5,0, 0,0.5,0};
    GLuint vbo;
    glGenBuffers(1, &vbo);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts), verts, GL_STATIC_DRAW);
    
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 0, 0);
    
    while (!glfwWindowShouldClose(w)) {
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(prog);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        glfwSwapBuffers(w);
        glfwPollEvents();
    }
}
```

---

## PROSSIMI PASSI

1. **Inizia semplice**: Triangolo → Cubo → Terreno
2. **Aggiungi camera**: FPS controller base
3. **Implementa fog**: Copia shader dall'esempio WebGL
4. **Billboards**: Prima fissi, poi face-camera
5. **Ottimizza**: Frustum culling, LOD

Il codice WebGL che ti ho dato è quasi 1:1 traducibile!
