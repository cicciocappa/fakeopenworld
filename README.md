# Fake Open World - Prototipo di Simulazione Open World

## Descrizione del Progetto

Questo repository contiene un **prototipo di videogame che simula un open world**, mentre in realtà si tratta di **aree giocabili limitate collegate fra loro**.

L'obiettivo è sperimentare tecniche per **simulare e renderizzare grandi aree visivamente interessanti utilizzando solo geometria minima**, creando l'illusione di un mondo vasto senza il costo computazionale di un vero open world.

## Concetto Fondamentale

- **Area giocabile reale**: 256×256 metri al centro della scena con geometria completa
- **Simulazione dell'open world**: Utilizzo di tecniche "eyecandy" per simulare il resto del mondo:
  - Skybox procedurale
  - Distance fog (nebbia lineare)
  - Billboards (alberi, vegetazione)
  - Mesh cards (montagne/edifici lontani)
  - Terrain procedurale con aree piatte per strutture

## Unità di Misura

- **1 unità WebGL = 1 metro**
- **1 pixel heightmap = 1 metro**
- Questo standardizza le dimensioni e facilita il posizionamento di oggetti

## Architettura del Progetto

### Struttura File

```
fakeopenworld/
├── webgl_fake_openworld.html    # Entry point HTML
├── js/
│   ├── main.js                  # Inizializzazione applicazione
│   ├── webgl-setup.js           # Setup contesto WebGL
│   ├── renderer.js              # Loop di rendering principale
│   ├── camera.js                # Camera FPS con input
│   ├── geometry.js              # Creazione mesh semplici (ground, skybox, billboards)
│   ├── terrain.js               # Generazione terrain procedurale ⭐
│   ├── matte-painting.js        # Sistema matte painting con parallasse ⭐ NUOVO
│   ├── shaders.js               # Tutti gli shader GLSL
│   ├── shader-compiler.js       # Compilazione shader
│   └── math-utils.js            # Utilità matematiche (matrici)
└── README.md                    # Questo file
```

### Moduli Principali

#### 1. Terrain System (terrain.js)
- **Perlin Noise**: Implementazione per generazione procedurale
- **Heightmap**: Classe per gestire dati di elevazione 256×256
- **Generazione procedurale**:
  - Perlin noise multi-octave per variazioni naturali
  - Forme geometriche (quadrati, rettangoli, cerchi) per aree piatte
  - Mesh generation con normali smooth per shading realistico
- **TODO**: Caricamento da file OBJ (placeholder implementato)

#### 2. Matte Painting System (matte-painting.js) ⭐ NUOVO
- **TextureLoader**: Gestione caricamento texture con cache e fallback
- **Layer System**: Sistema di layer multipli a distanze diverse
- **Parallasse**: Effetto di profondità (layer lontani si muovono più lentamente)
- **Mesh Generation**:
  - Panoramic Sphere (per skybox 360°)
  - Panoramic Cylinder (per orizzonti montani)
  - Mesh Cards (layer orientati verso camera)
- **Procedural Fallback**: Texture procedurali quando asset esterni non disponibili
- **Filosofia ibrida**: Asset-based + procedurale

#### 3. Rendering System (renderer.js)
- **Ordine di rendering**:
  1. Skybox (no depth write, sempre sullo sfondo)
  2. **Matte Painting Layers** (dal più lontano al più vicino, con parallasse) ⭐ NUOVO
  3. Terrain procedurale (Phong lighting)
  4. ~~Ground plane~~ (disabilitato - sostituito da terrain)
  5. ~~Mesh cards~~ (sostituiti da matte painting layers)
  6. ~~Billboards~~ (temporaneamente disabilitato)

#### 4. Shader Programs (shaders.js)
- **Mesh shader**: Diffuse lighting + fog (per oggetti generici)
- **Skybox shader**: Gradient procedurale
- **Skybox Textured shader**: Con texture equirectangular + fallback procedurale ⭐ NUOVO
- **Billboard shader**: Camera-facing quads con alpha test
- **Terrain shader**: Phong lighting (ambient + diffuse + specular) + fog
- **Matte Painting shader**: Texture mapping + parallasse + alpha blending + fog opzionale ⭐ NUOVO

#### 4. Camera System (camera.js)
- Camera FPS con controlli WASD
- Mouse look con pointer lock
- Posizione iniziale: [0, 20, 50] - elevata per vista panoramica
- Velocità: 20 metri/secondo

## Tecniche di Rendering

### 1. Terrain Procedurale
- **256×256 metri** di area giocabile
- **Heightmap** generata con Perlin noise
- **Aree piatte** per posizionare edifici, torri, strutture:
  - 2 quadrati (40×40m e 35×35m)
  - 2 rettangoli (60×30m e 50×40m)
  - 1 cerchio centrale (raggio 25m)
- **Phong Shading** per illuminazione realistica
- **Smooth normals** per superficie continua

### 2. Distance Fog
- Fog lineare: start=30m, end=120m
- Nasconde il limite del mondo visibile
- Colore fog: [0.7, 0.8, 0.9] (azzurro chiaro)

### 3. Billboards (temporaneamente disabilitati)
- Quad sempre rivolti verso la camera
- Rendering di alberi/vegetazione con geometria minima
- Alpha test invece di blending per performance

### 4. Mesh Cards (temporaneamente disabilitati)
- Plane verticali con texture/colore
- Simulano montagne/edifici lontani
- Costo: solo 2 triangoli per elemento

### 5. Skybox Procedurale
- Gradient blu→arancione→grigio
- Sempre renderizzato al far plane
- No texture, completamente procedurale

### 6. Matte Painting e Layering con Parallasse ⭐ NUOVO

**Tecnica presa dal cinema** per creare sfondi epici con geometria minima.

#### Concetto
Invece di modellare montagne/città lontane, si "dipingono" in texture ad alta risoluzione e si proiettano su geometria semplice (cilindri, sfere, cards).

#### Implementazione
- **Layer 1** (500m - più lontano): Cilindro panoramico con montagne lontane
  - Parallax factor: 0.0 (fisso, come skybox)
  - Texture procedurale con profilo montuoso

- **Layer 2** (300m): 8 mesh cards con montagne distanti
  - Parallax factor: 0.2 (movimento lento)
  - Texture procedurale dettagliata

- **Layer 3** (180m): 6 mesh cards con colline medie
  - Parallax factor: 0.5 (movimento medio)
  - Alpha blending per trasparenza

#### Effetto Parallasse
I layer più lontani si muovono **più lentamente** rispetto alla camera, creando un senso di profondità tridimensionale (come nei giochi 2D side-scrolling, ma in 3D!).

#### Filosofia Ibrida
- ✅ Supporta texture esterne (PNG, JPG)
- ✅ Fallback procedurale automatico se texture non disponibile
- ✅ Cache delle texture per performance
- ✅ Alpha blending per layer trasparenti

#### Vantaggi
- 🎨 **Impatto visivo**: Panorami epici con ~50 triangoli totali
- ⚡ **Performance**: Costo GPU minimo
- 🎯 **Flessibilità**: Asset esterni o procedurale
- 📐 **Parallasse**: Profondità realistica

## Stato Attuale dell'Implementazione

### ✅ Completato
- [x] Setup WebGL base
- [x] Sistema di camera FPS
- [x] Skybox procedurale
- [x] Sistema di fog
- [x] Billboards (alberi)
- [x] Mesh cards (montagne lontane)
- [x] Terrain procedurale con Perlin noise
- [x] Generazione heightmap con aree piatte
- [x] Phong lighting per terrain
- [x] Smooth normals
- [x] **Sistema Matte Painting completo** ⭐ NUOVO
- [x] **Layer multipli con parallasse** ⭐ NUOVO
- [x] **Texture loader con fallback procedurale** ⭐ NUOVO
- [x] **Generazione texture procedurali per montagne** ⭐ NUOVO

### 🚧 In Sviluppo
- [ ] Texturing del terrain (TODO presente negli shader)
- [ ] Caricamento terrain da file OBJ
- [ ] Caricamento texture esterne per matte painting
- [ ] Strutture (edifici, torri) sulle aree piatte

### 📋 Prossimi Step
1. **Texture esterne**: Caricare texture panoramiche reali per i layer
2. **Ottimizzazione matte painting**: Skybox cubemap invece di cilindro
3. **Texturing terrain**: Blend tra texture base su altezza/slope
4. **Strutture 3D**: Edifici/torri nelle aree piatte del terrain
5. **Riabilitare billboards**: Vegetazione proceduralenel foreground
6. **LOD system**: Per terrain e layer distanti
7. **Transizioni**: Sistema per collegare più aree giocabili

## Come Usare

### Avvio
```bash
# Avvia un server HTTP locale
python3 -m http.server 8000

# Apri nel browser
firefox http://localhost:8000/webgl_fake_openworld.html
```

### Controlli
- **W/A/S/D**: Movimento
- **Mouse**: Guarda intorno
- **Click**: Attiva pointer lock

### Console Output
Il browser mostrerà nella console:
```
Generating procedural terrain heightmap...
Creating terrain mesh from heightmap...
Terrain mesh created: 65536 vertices, 130050 indices
Fake Open World initialized successfully!
```

## Parametri Configurabili

### Terrain (terrain.js)
```javascript
// Dimensioni heightmap
generateProceduralHeightmap(256, 256)

// Parametri Perlin noise
heightmap.applyPerlinNoise(
    0.05,    // scale (frequenza)
    8,       // amplitude (altezza massima)
    4        // octaves (dettaglio)
)
```

### Lighting (renderer.js)
```javascript
// Direzione luce direzionale (sole)
const lightDir = [0.5, 0.7, 0.3];

// Colore terrain
const terrainColor = [0.4, 0.5, 0.3];  // marrone-verdastro

// Fog
this.fogStart = 30.0;
this.fogEnd = 120.0;
```

### Camera (camera.js)
```javascript
// Posizione iniziale
this.pos = [0, 20, 50];

// Velocità movimento
const speed = 20; // metri/secondo
```

## Note per Traduzione in C/Rust

Il codice è progettato per essere facilmente portabile:

1. **Shaders**: Identici, solo caricamento da file
2. **Buffer**: `gl.createBuffer()` → `glGenBuffers()`
3. **Math**: Usa glm (C++) o nalgebra/cgmath (Rust)
4. **Window**: SDL2 o GLFW per input e window management
5. **Struttura**: Stessa logica, solo sintassi diversa

Le tecniche (fog, billboards, mesh cards, terrain) sono identiche e indipendenti dal linguaggio!

## Risorse e Riferimenti

- **WebGL**: Rendering 3D nel browser
- **Perlin Noise**: Generazione procedurale naturale
- **Phong Shading**: Modello di illuminazione classico
- **Billboard Rendering**: Tecnica per vegetazione/particelle
- **Mesh Cards**: Tecnica per oggetti lontani in giochi

## Licenza

Progetto sperimentale / Prototipo

## Author

Francesco (france)

---

**Ultimo aggiornamento**: 2025-11-05 - Implementazione sistema Matte Painting con layer multipli e parallasse
