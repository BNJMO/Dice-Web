# 🎮 Complete PixiJS Integration Guide for Web Projects

## 📋 Table of Contents
1. [What is PixiJS?](#what-is-pixijs)
2. [Installation Methods](#installation-methods)
3. [Basic Setup](#basic-setup)
4. [Integration with Your Mines Game](#integration-with-your-mines-game)
5. [Performance Optimization](#performance-optimization)
6. [Framework Integration](#framework-integration)
7. [Best Practices](#best-practices)
8. [Common Issues & Solutions](#common-issues--solutions)

---

## 🎯 What is PixiJS?

**PixiJS** is a fast, lightweight 2D rendering library that uses **WebGL** (with Canvas fallback) to create high-performance interactive graphics and games in the browser.

### Key Features:
- ⚡ **Ultra-fast WebGL rendering** with automatic Canvas2D fallback
- 🎨 **Rich graphics API** for sprites, shapes, text, filters, and effects
- 🎬 **Built-in animation system** with ticker and tweening support
- 📦 **Asset management** for loading images, spritesheets, and audio
- 🖱️ **Interactive events** for mouse, touch, and pointer input
- 🎭 **Scene graph** for hierarchical object management
- 📱 **Mobile-optimized** with touch support
- 🔧 **TypeScript support** with full type definitions

### When to Use PixiJS:
✅ Games (2D platformers, puzzle games, card games)
✅ Interactive data visualizations
✅ Animated infographics and presentations
✅ Rich media advertisements
✅ Interactive educational content
✅ Real-time particle effects and animations

---

## 📦 Installation Methods

### Method 1: NPM/Yarn (Recommended for Modern Projects)

```bash
# Using npm
npm install pixi.js

# Using yarn
yarn add pixi.js

# Using pnpm
pnpm add pixi.js
```

**Usage in your code:**
```javascript
import { Application, Sprite, Assets } from 'pixi.js';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);
```

### Method 2: CDN (Quick Prototyping)

```html
<!-- PixiJS v8 (Latest) -->
<script src="https://pixijs.download/v8.x/pixi.min.js"></script>

<!-- PixiJS v7 (Stable) -->
<script src="https://pixijs.download/v7.4.2/pixi.min.js"></script>

<!-- Usage -->
<script>
  const app = new PIXI.Application({ width: 800, height: 600 });
  document.body.appendChild(app.view);
</script>
```

### Method 3: ES Modules (Modern Browsers)

```html
<script type="module">
  import { Application } from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';
  
  const app = new Application();
  await app.init({ width: 800, height: 600 });
  document.body.appendChild(app.canvas);
</script>
```

### Method 4: Vite/Webpack Project Scaffolding

```bash
# Create new PixiJS project with Vite
npm create pixi.js@latest

# Follow prompts to select template
# Options: Vite, Webpack, Parcel, Rollup, etc.
```

---

## 🚀 Basic Setup

### Minimal PixiJS Application

```javascript
import { Application, Sprite, Assets } from 'pixi.js';

// Create application
const app = new Application();

// Initialize (async in v8+)
await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x1099bb,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

// Add canvas to DOM
document.body.appendChild(app.canvas);

// Load assets
const texture = await Assets.load('path/to/image.png');

// Create sprite
const sprite = new Sprite(texture);
sprite.x = 400;
sprite.y = 300;
sprite.anchor.set(0.5); // Center anchor point

// Add to stage
app.stage.addChild(sprite);

// Animation loop
app.ticker.add((delta) => {
  sprite.rotation += 0.01 * delta;
});
```

### Application Configuration Options

```javascript
const app = new Application();
await app.init({
  // Canvas size
  width: 800,
  height: 600,
  
  // Rendering
  backgroundColor: 0x1099bb,
  backgroundAlpha: 1,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  
  // Performance
  powerPreference: 'high-performance', // or 'low-power'
  
  // Responsive
  resizeTo: window, // Auto-resize to window
  
  // Advanced
  hello: true, // Show PixiJS banner in console
});
```

---

## 🎮 Integration with Your Mines Game

Your current project structure already uses PixiJS! Here's how it's integrated:

### Current Setup Analysis

**File: `src/mines.js`**
```javascript
import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Rectangle,
  AnimatedSprite,
  Assets,
  Sprite,
} from "pixi.js";
import { sound } from "@pixi/sound";
```

### Your Game Architecture

1. **Application Creation** - Creates the PixiJS renderer
2. **Asset Loading** - Loads textures and sounds
3. **Scene Graph** - Hierarchical containers for tiles
4. **Interactive Events** - Mouse/touch handling for tile clicks
5. **Animation System** - Custom tweening for card flips and effects
6. **Responsive Design** - ResizeObserver for dynamic sizing

### How the HTML Demo Works

The `index.html` file I created:

1. **Provides a mount point**: `<div id="mines"></div>`
2. **Loads your game module**: `<script type="module" src="./src/main.js"></script>`
3. **Styles the container**: CSS for responsive layout
4. **Adds controls**: Buttons that call your game API

Your `main.js` initializes the game:
```javascript
const game = await createMinesGame("#mines", opts);
```

This creates a PixiJS Application inside the `#mines` div.

---

## ⚡ Performance Optimization

### 1. Sprite Batching
```javascript
// ✅ GOOD: Use spritesheets (batched rendering)
const sheet = await Assets.load('spritesheet.json');
const sprite1 = new Sprite(sheet.textures['image1.png']);
const sprite2 = new Sprite(sheet.textures['image2.png']);
// Both rendered in single draw call!

// ❌ BAD: Individual textures (multiple draw calls)
const tex1 = await Assets.load('image1.png');
const tex2 = await Assets.load('image2.png');
```

### 2. Object Pooling
```javascript
// Reuse objects instead of creating/destroying
const pool = [];

function getTile() {
  return pool.pop() || createNewTile();
}

function recycleTile(tile) {
  tile.visible = false;
  pool.push(tile);
}
```

### 3. Culling (Hide Off-Screen Objects)
```javascript
container.cullable = true;
container.cullArea = new Rectangle(0, 0, 800, 600);
```

### 4. Texture Management
```javascript
// Destroy textures when done
texture.destroy(true); // true = destroy base texture too

// Use texture garbage collector
Assets.unload('path/to/texture.png');
```

### 5. Reduce Draw Calls
```javascript
// Group similar objects together
// sprite/sprite/sprite/graphic/graphic/graphic
// Better than: sprite/graphic/sprite/graphic
```

### 6. Optimize Text
```javascript
// ❌ BAD: Changing text every frame
text.text = `Score: ${score}`;

// ✅ GOOD: Use BitmapText for dynamic text
const bitmapText = new BitmapText('Score: 0', {
  fontName: 'MyFont',
  fontSize: 24,
});
```

### 7. Disable Unnecessary Features
```javascript
// Disable interaction if not needed
sprite.eventMode = 'none';

// Disable children interaction
container.interactiveChildren = false;

// Set hit area to avoid expensive bounds calculation
sprite.hitArea = new Rectangle(0, 0, 100, 100);
```

---

## 🔧 Framework Integration

### React Integration

```bash
npm install @pixi/react
```

```jsx
import { Stage, Container, Sprite } from '@pixi/react';

function Game() {
  return (
    <Stage width={800} height={600} options={{ backgroundColor: 0x1099bb }}>
      <Container x={400} y={300}>
        <Sprite
          image="path/to/image.png"
          anchor={0.5}
          rotation={0.5}
        />
      </Container>
    </Stage>
  );
}
```

### Vue Integration

```vue
<template>
  <div ref="pixiContainer"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Application, Sprite, Assets } from 'pixi.js';

const pixiContainer = ref(null);
let app = null;

onMounted(async () => {
  app = new Application();
  await app.init({ width: 800, height: 600 });
  pixiContainer.value.appendChild(app.canvas);
  
  // Add your game logic here
});

onUnmounted(() => {
  app?.destroy(true, { children: true });
});
</script>
```

### Angular Integration

```typescript
import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Application, Sprite, Assets } from 'pixi.js';

@Component({
  selector: 'app-pixi-game',
  template: '<div #pixiContainer></div>',
})
export class PixiGameComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;
  private app!: Application;

  async ngOnInit() {
    this.app = new Application();
    await this.app.init({ width: 800, height: 600 });
    this.pixiContainer.nativeElement.appendChild(this.app.canvas);
  }

  ngOnDestroy() {
    this.app?.destroy(true, { children: true });
  }
}
```

---

## 📚 Best Practices

### 1. Asset Loading
```javascript
// Preload all assets before game starts
Assets.addBundle('game', {
  player: 'sprites/player.png',
  enemy: 'sprites/enemy.png',
  background: 'sprites/bg.png',
});

await Assets.loadBundle('game');

// Use loaded assets
const playerTexture = Assets.get('player');
```

### 2. Memory Management
```javascript
// Always destroy when done
function cleanup() {
  sprite.destroy({ children: true, texture: false, baseTexture: false });
  container.destroy({ children: true });
  app.destroy(true, { children: true, texture: true });
}
```

### 3. Responsive Canvas
```javascript
function resize() {
  const parent = app.canvas.parentElement;
  app.renderer.resize(parent.clientWidth, parent.clientHeight);
}

window.addEventListener('resize', resize);
resize();
```

### 4. Event Handling
```javascript
sprite.eventMode = 'static'; // Enable interaction
sprite.cursor = 'pointer';

sprite.on('pointerdown', (event) => {
  console.log('Clicked!', event.global);
});

sprite.on('pointerover', () => sprite.tint = 0xff0000);
sprite.on('pointerout', () => sprite.tint = 0xffffff);
```

### 5. Animation Loop
```javascript
let elapsed = 0;

app.ticker.add((ticker) => {
  elapsed += ticker.deltaTime;
  sprite.x = Math.cos(elapsed * 0.1) * 100;
});
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot read property 'width' of undefined"
**Solution:** Wait for assets to load before using them
```javascript
await Assets.load('image.png');
const sprite = Sprite.from('image.png');
```

### Issue 2: Canvas not showing
**Solution:** Ensure canvas is added to DOM
```javascript
document.body.appendChild(app.canvas);
```

### Issue 3: Blurry graphics on high-DPI screens
**Solution:** Set resolution and autoDensity
```javascript
await app.init({
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
```

### Issue 4: Memory leaks
**Solution:** Destroy objects properly
```javascript
sprite.destroy({ children: true, texture: true, baseTexture: true });
```

### Issue 5: Poor performance
**Solution:** Use spritesheets, object pooling, and culling
```javascript
// See Performance Optimization section above
```

---

## 🎓 Additional Resources

- **Official Docs**: https://pixijs.com/8.x/guides
- **Examples**: https://pixijs.com/8.x/examples
- **Playground**: https://pixijs.com/playground
- **Discord Community**: https://discord.gg/pixijs
- **GitHub**: https://github.com/pixijs/pixijs

---

**Your Mines game is already well-integrated with PixiJS!** The HTML demo I created will let you showcase it easily. Just serve the files with a local server and open `index.html`.

