# Rust OpenGL Starter - Fake Open World

## Cargo.toml
```toml
[package]
name = "openworld"
version = "0.1.0"
edition = "2021"

[dependencies]
glow = "0.13"
glutin = "0.31"
glutin-winit = "0.4"
winit = "0.29"
raw-window-handle = "0.5"
nalgebra-glm = "0.18"
bytemuck = "1.14"
```

## src/main.rs - Esempio minimale funzionante

```rust
use glow::HasContext;
use glutin::config::ConfigTemplateBuilder;
use glutin::context::{ContextAttributesBuilder, PossiblyCurrentContext};
use glutin::display::GetGlDisplay;
use glutin::prelude::*;
use glutin::surface::{Surface, WindowSurface};
use glutin_winit::DisplayBuilder;
use raw_window_handle::HasRawWindowHandle;
use std::num::NonZeroU32;
use winit::event::{Event, WindowEvent, ElementState, VirtualKeyCode};
use winit::event_loop::EventLoop;
use winit::window::WindowBuilder;

type Glm = nalgebra_glm as glm;

// ============================================================
// SHADERS - Identici al WebGL!
// ============================================================

const VERTEX_SHADER: &str = r#"
#version 330 core
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vNormal;
out float vDistance;

void main() {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vec4 viewPos = uViewMatrix * worldPos;
    gl_Position = uProjectionMatrix * viewPos;
    
    vNormal = normalize(mat3(uModelMatrix) * aNormal);
    vDistance = length(viewPos.xyz);
}
"#;

const FRAGMENT_SHADER: &str = r#"
#version 330 core
in vec3 vNormal;
in float vDistance;

uniform vec3 uLightDir;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform vec3 uObjectColor;

out vec4 FragColor;

void main() {
    float light = max(dot(vNormal, uLightDir), 0.3);
    vec3 color = uObjectColor * light;
    
    // FOG LINEARE
    float fogFactor = clamp((uFogEnd - vDistance) / (uFogEnd - uFogStart), 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);
    
    FragColor = vec4(color, 1.0);
}
"#;

const SKYBOX_VERTEX: &str = r#"
#version 330 core
layout(location = 0) in vec3 aPosition;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vTexCoord;

void main() {
    mat4 viewNoTranslation = uViewMatrix;
    viewNoTranslation[3][0] = 0.0;
    viewNoTranslation[3][1] = 0.0;
    viewNoTranslation[3][2] = 0.0;
    
    vec4 pos = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
    gl_Position = pos.xyww;
    vTexCoord = aPosition;
}
"#;

const SKYBOX_FRAGMENT: &str = r#"
#version 330 core
in vec3 vTexCoord;
out vec4 FragColor;

void main() {
    float t = normalize(vTexCoord).y;
    
    vec3 skyColor = vec3(0.5, 0.7, 1.0);
    vec3 horizonColor = vec3(0.9, 0.7, 0.5);
    vec3 groundColor = vec3(0.6, 0.6, 0.7);
    
    vec3 color;
    if (t > 0.0) {
        color = mix(horizonColor, skyColor, t);
    } else {
        color = mix(horizonColor, groundColor, -t);
    }
    
    FragColor = vec4(color, 1.0);
}
"#;

// ============================================================
// STRUTTURE DATI
// ============================================================

struct Mesh {
    vao: glow::VertexArray,
    vbo: glow::Buffer,
    ibo: Option<glow::Buffer>,
    index_count: i32,
}

struct ShaderProgram {
    program: glow::Program,
}

struct Camera {
    position: glm::Vec3,
    yaw: f32,
    pitch: f32,
}

struct InputState {
    forward: bool,
    back: bool,
    left: bool,
    right: bool,
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

unsafe fn create_shader(
    gl: &glow::Context,
    shader_type: u32,
    source: &str,
) -> glow::Shader {
    let shader = gl.create_shader(shader_type).unwrap();
    gl.shader_source(shader, source);
    gl.compile_shader(shader);
    
    if !gl.get_shader_compile_status(shader) {
        panic!("Shader compilation error: {}", gl.get_shader_info_log(shader));
    }
    
    shader
}

unsafe fn create_program(
    gl: &glow::Context,
    vert_src: &str,
    frag_src: &str,
) -> glow::Program {
    let vert = create_shader(gl, glow::VERTEX_SHADER, vert_src);
    let frag = create_shader(gl, glow::FRAGMENT_SHADER, frag_src);
    
    let program = gl.create_program().unwrap();
    gl.attach_shader(program, vert);
    gl.attach_shader(program, frag);
    gl.link_program(program);
    
    if !gl.get_program_link_status(program) {
        panic!("Program link error: {}", gl.get_program_info_log(program));
    }
    
    gl.delete_shader(vert);
    gl.delete_shader(frag);
    
    program
}

// ============================================================
// CREAZIONE GEOMETRIE
// ============================================================

unsafe fn create_ground_mesh(gl: &glow::Context) -> Mesh {
    let size = 200.0f32;
    
    #[rustfmt::skip]
    let vertices: Vec<f32> = vec![
        // pos                  normal          
        -size, 0.0, -size,      0.0, 1.0, 0.0,
         size, 0.0, -size,      0.0, 1.0, 0.0,
         size, 0.0,  size,      0.0, 1.0, 0.0,
        -size, 0.0,  size,      0.0, 1.0, 0.0,
    ];
    
    let indices: Vec<u16> = vec![0, 1, 2, 0, 2, 3];
    
    let vao = gl.create_vertex_array().unwrap();
    gl.bind_vertex_array(Some(vao));
    
    let vbo = gl.create_buffer().unwrap();
    gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
    gl.buffer_data_u8_slice(
        glow::ARRAY_BUFFER,
        bytemuck::cast_slice(&vertices),
        glow::STATIC_DRAW,
    );
    
    let ibo = gl.create_buffer().unwrap();
    gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ibo));
    gl.buffer_data_u8_slice(
        glow::ELEMENT_ARRAY_BUFFER,
        bytemuck::cast_slice(&indices),
        glow::STATIC_DRAW,
    );
    
    // Position attribute
    gl.enable_vertex_attrib_array(0);
    gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, 24, 0);
    
    // Normal attribute
    gl.enable_vertex_attrib_array(1);
    gl.vertex_attrib_pointer_f32(1, 3, glow::FLOAT, false, 24, 12);
    
    gl.bind_vertex_array(None);
    
    Mesh {
        vao,
        vbo,
        ibo: Some(ibo),
        index_count: indices.len() as i32,
    }
}

unsafe fn create_skybox_mesh(gl: &glow::Context) -> Mesh {
    #[rustfmt::skip]
    let vertices: Vec<f32> = vec![
        -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,  1.0, -1.0, -1.0,  1.0, -1.0,
        -1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0,  1.0,
        -1.0, -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,  1.0, -1.0, -1.0,  1.0,
         1.0, -1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0,
        -1.0,  1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0, -1.0,  1.0,  1.0,
        -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
    ];
    
    #[rustfmt::skip]
    let indices: Vec<u16> = vec![
        0,1,2, 0,2,3,   4,5,6, 4,6,7,   8,9,10, 8,10,11,
        12,13,14, 12,14,15,   16,17,18, 16,18,19,   20,21,22, 20,22,23,
    ];
    
    let vao = gl.create_vertex_array().unwrap();
    gl.bind_vertex_array(Some(vao));
    
    let vbo = gl.create_buffer().unwrap();
    gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
    gl.buffer_data_u8_slice(
        glow::ARRAY_BUFFER,
        bytemuck::cast_slice(&vertices),
        glow::STATIC_DRAW,
    );
    
    let ibo = gl.create_buffer().unwrap();
    gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ibo));
    gl.buffer_data_u8_slice(
        glow::ELEMENT_ARRAY_BUFFER,
        bytemuck::cast_slice(&indices),
        glow::STATIC_DRAW,
    );
    
    gl.enable_vertex_attrib_array(0);
    gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, 12, 0);
    
    gl.bind_vertex_array(None);
    
    Mesh {
        vao,
        vbo,
        ibo: Some(ibo),
        index_count: indices.len() as i32,
    }
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    let event_loop = EventLoop::new();
    
    let window_builder = WindowBuilder::new()
        .with_title("Rust OpenGL - Fake Open World")
        .with_inner_size(winit::dpi::LogicalSize::new(1280.0, 720.0));
    
    let template = ConfigTemplateBuilder::new()
        .with_alpha_size(8)
        .with_transparency(false);
    
    let display_builder = DisplayBuilder::new().with_window_builder(Some(window_builder));
    
    let (window, gl_config) = display_builder
        .build(&event_loop, template, |configs| {
            configs
                .reduce(|accum, config| {
                    if config.num_samples() > accum.num_samples() {
                        config
                    } else {
                        accum
                    }
                })
                .unwrap()
        })
        .unwrap();
    
    let window = window.unwrap();
    
    let raw_window_handle = window.raw_window_handle();
    let context_attributes = ContextAttributesBuilder::new().build(Some(raw_window_handle));
    
    let gl_display = gl_config.display();
    let gl_context = unsafe {
        gl_display
            .create_context(&gl_config, &context_attributes)
            .unwrap()
    };
    
    let size = window.inner_size();
    let surface_attributes = glutin::surface::SurfaceAttributesBuilder::<WindowSurface>::new()
        .build(
            raw_window_handle,
            NonZeroU32::new(size.width).unwrap(),
            NonZeroU32::new(size.height).unwrap(),
        );
    
    let gl_surface = unsafe {
        gl_display
            .create_window_surface(&gl_config, &surface_attributes)
            .unwrap()
    };
    
    let gl_context = gl_context.make_current(&gl_surface).unwrap();
    
    let gl = unsafe {
        glow::Context::from_loader_function(|s| {
            gl_display.get_proc_address(&std::ffi::CString::new(s).unwrap())
        })
    };
    
    // ============================================================
    // SETUP OPENGL
    // ============================================================
    
    unsafe {
        gl.enable(glow::DEPTH_TEST);
        gl.enable(glow::CULL_FACE);
    }
    
    let mesh_program = unsafe { create_program(&gl, VERTEX_SHADER, FRAGMENT_SHADER) };
    let skybox_program = unsafe { create_program(&gl, SKYBOX_VERTEX, SKYBOX_FRAGMENT) };
    
    let ground_mesh = unsafe { create_ground_mesh(&gl) };
    let skybox_mesh = unsafe { create_skybox_mesh(&gl) };
    
    // ============================================================
    // GAME STATE
    // ============================================================
    
    let mut camera = Camera {
        position: glm::vec3(0.0, 5.0, 10.0),
        yaw: 0.0,
        pitch: 0.0,
    };
    
    let mut input = InputState {
        forward: false,
        back: false,
        left: false,
        right: false,
    };
    
    let fog_color = glm::vec3(0.7, 0.8, 0.9);
    let fog_start = 30.0f32;
    let fog_end = 120.0f32;
    
    let aspect = size.width as f32 / size.height as f32;
    let projection = glm::perspective(aspect, 60.0f32.to_radians(), 0.1, 1000.0);
    
    let mut last_time = std::time::Instant::now();
    let mut last_mouse_pos: Option<(f64, f64)> = None;
    
    // ============================================================
    // EVENT LOOP
    // ============================================================
    
    event_loop.run(move |event, _, control_flow| {
        control_flow.set_poll();
        
        match event {
            Event::WindowEvent { event, .. } => match event {
                WindowEvent::CloseRequested => {
                    control_flow.set_exit();
                }
                WindowEvent::KeyboardInput { input: key_input, .. } => {
                    if let Some(keycode) = key_input.virtual_keycode {
                        let pressed = key_input.state == ElementState::Pressed;
                        match keycode {
                            VirtualKeyCode::W => input.forward = pressed,
                            VirtualKeyCode::S => input.back = pressed,
                            VirtualKeyCode::A => input.left = pressed,
                            VirtualKeyCode::D => input.right = pressed,
                            VirtualKeyCode::Escape => control_flow.set_exit(),
                            _ => {}
                        }
                    }
                }
                WindowEvent::CursorMoved { position, .. } => {
                    if let Some(last_pos) = last_mouse_pos {
                        let delta_x = position.x - last_pos.0;
                        let delta_y = position.y - last_pos.1;
                        
                        camera.yaw -= delta_x as f32 * 0.002;
                        camera.pitch -= delta_y as f32 * 0.002;
                        camera.pitch = camera.pitch.clamp(-1.5, 1.5);
                    }
                    last_mouse_pos = Some((position.x, position.y));
                }
                _ => {}
            },
            Event::MainEventsCleared => {
                window.request_redraw();
            }
            Event::RedrawRequested(_) => {
                let now = std::time::Instant::now();
                let dt = (now - last_time).as_secs_f32();
                last_time = now;
                
                // Update camera
                let speed = 20.0 * dt;
                let forward = glm::vec3(
                    camera.pitch.cos() * camera.yaw.sin(),
                    camera.pitch.sin(),
                    camera.pitch.cos() * camera.yaw.cos(),
                );
                let right = glm::vec3(
                    (camera.yaw - std::f32::consts::PI / 2.0).sin(),
                    0.0,
                    (camera.yaw - std::f32::consts::PI / 2.0).cos(),
                );
                
                if input.forward {
                    camera.position += forward * speed;
                }
                if input.back {
                    camera.position -= forward * speed;
                }
                if input.left {
                    camera.position -= right * speed;
                }
                if input.right {
                    camera.position += right * speed;
                }
                
                let target = camera.position + forward;
                let view = glm::look_at(
                    &camera.position,
                    &target,
                    &glm::vec3(0.0, 1.0, 0.0),
                );
                
                // Render
                unsafe {
                    gl.clear_color(fog_color.x, fog_color.y, fog_color.z, 1.0);
                    gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
                    
                    // Render skybox
                    gl.depth_mask(false);
                    gl.use_program(Some(skybox_program));
                    gl.bind_vertex_array(Some(skybox_mesh.vao));
                    
                    let view_loc = gl.get_uniform_location(skybox_program, "uViewMatrix");
                    let proj_loc = gl.get_uniform_location(skybox_program, "uProjectionMatrix");
                    
                    gl.uniform_matrix_4_f32_slice(view_loc.as_ref(), false, view.as_slice());
                    gl.uniform_matrix_4_f32_slice(proj_loc.as_ref(), false, projection.as_slice());
                    
                    gl.draw_elements(
                        glow::TRIANGLES,
                        skybox_mesh.index_count,
                        glow::UNSIGNED_SHORT,
                        0,
                    );
                    
                    gl.depth_mask(true);
                    
                    // Render ground
                    gl.use_program(Some(mesh_program));
                    gl.bind_vertex_array(Some(ground_mesh.vao));
                    
                    let model = glm::Mat4::identity();
                    
                    let model_loc = gl.get_uniform_location(mesh_program, "uModelMatrix");
                    let view_loc = gl.get_uniform_location(mesh_program, "uViewMatrix");
                    let proj_loc = gl.get_uniform_location(mesh_program, "uProjectionMatrix");
                    let light_loc = gl.get_uniform_location(mesh_program, "uLightDir");
                    let fog_color_loc = gl.get_uniform_location(mesh_program, "uFogColor");
                    let fog_start_loc = gl.get_uniform_location(mesh_program, "uFogStart");
                    let fog_end_loc = gl.get_uniform_location(mesh_program, "uFogEnd");
                    let color_loc = gl.get_uniform_location(mesh_program, "uObjectColor");
                    
                    gl.uniform_matrix_4_f32_slice(model_loc.as_ref(), false, model.as_slice());
                    gl.uniform_matrix_4_f32_slice(view_loc.as_ref(), false, view.as_slice());
                    gl.uniform_matrix_4_f32_slice(proj_loc.as_ref(), false, projection.as_slice());
                    gl.uniform_3_f32(light_loc.as_ref(), 0.5, 0.7, 0.3);
                    gl.uniform_3_f32(fog_color_loc.as_ref(), fog_color.x, fog_color.y, fog_color.z);
                    gl.uniform_1_f32(fog_start_loc.as_ref(), fog_start);
                    gl.uniform_1_f32(fog_end_loc.as_ref(), fog_end);
                    gl.uniform_3_f32(color_loc.as_ref(), 0.4, 0.5, 0.3);
                    
                    gl.draw_elements(
                        glow::TRIANGLES,
                        ground_mesh.index_count,
                        glow::UNSIGNED_SHORT,
                        0,
                    );
                }
                
                gl_surface.swap_buffers(&gl_context).unwrap();
            }
            _ => {}
        }
    });
}
```

## Compilazione

```bash
cargo build --release
cargo run --release
```

## Note

- WASD per muoversi
- Mouse per guardare intorno
- ESC per uscire
- Questo è il punto di partenza minimale
- Aggiungi billboards, mesh cards, ecc. seguendo i pattern del WebGL

## Prossimi Step

1. Aggiungi billboard shader e geometria
2. Crea mesh cards per montagne
3. Implementa LOD system
4. Aggiungi texture loading (con image crate)
5. Implementa frustum culling base
