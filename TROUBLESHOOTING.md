# 🔧 Troubleshooting Guide - Invisible Boxes Issue

## 🎯 Problem: You can hear sounds but can't see the game boxes

This is a common issue with several possible causes. Let's fix it!

---

## 🔍 Step 1: Open Browser Developer Tools

1. **Press F12** (or right-click → Inspect)
2. **Go to the Console tab**
3. Look for errors (red text)

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error (Most Common!)

**Symptoms:**
```
Access to script at 'file://...' has been blocked by CORS policy
```

**Solution:** You MUST use a web server! Choose one:

#### Option A: Use NPM (Recommended)
```bash
npm install
npm run dev
```

#### Option B: Use Python
```bash
python -m http.server 3000
```

#### Option C: Use VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html`
3. Click "Open with Live Server"

#### Option D: Use npx (No installation)
```bash
npx serve
```

**DO NOT** open `index.html` by double-clicking it!

---

### Issue 2: Assets Not Loading

**Symptoms:**
- Console shows 404 errors
- "Failed to load resource" messages
- Network tab shows failed requests

**Solution:**

1. **Check file paths:**
   - Verify `assets/sprites/Diamond.png` exists
   - Verify `assets/sprites/Bomb.png` exists
   - Verify `assets/sprites/Explosion_Spritesheet.png` exists
   - Check all sound files in `assets/sounds/`

2. **Check file names (case-sensitive!):**
   - Windows is case-insensitive, but web servers are case-sensitive
   - Make sure file names match exactly

3. **Verify folder structure:**
```
Mines-Web/
├── index.html
├── src/
│   ├── main.js
│   ├── mines.js
│   └── ...
└── assets/
    ├── sprites/
    │   ├── Diamond.png
    │   ├── Bomb.png
    │   └── Explosion_Spritesheet.png
    └── sounds/
        └── *.ogg files
```

---

### Issue 3: Canvas Has Zero Size

**Symptoms:**
- Canvas element exists but is invisible
- Console shows: "Canvas has zero size!"

**Solution:**

Add this CSS to ensure the container has size:

```css
#mines {
    width: 600px !important;
    height: 600px !important;
    min-width: 600px;
    min-height: 600px;
}
```

Or check if parent elements have size:
```javascript
// In browser console
const mines = document.querySelector('#mines');
console.log('Width:', mines.clientWidth, 'Height:', mines.clientHeight);
```

---

### Issue 4: WebGL Not Supported

**Symptoms:**
- Console shows: "WebGL unsupported"
- Old browser or disabled WebGL

**Solution:**

1. **Update your browser** to the latest version
2. **Enable WebGL:**
   - Chrome: `chrome://flags` → Enable WebGL
   - Firefox: `about:config` → `webgl.disabled` → false
3. **Try a different browser** (Chrome, Firefox, Edge)

**Test WebGL:**
Visit: https://get.webgl.org/

---

### Issue 5: PixiJS Failed to Initialize

**Symptoms:**
- Console shows: "PIXI init failed"
- No canvas element created

**Solution:**

1. **Check PixiJS is installed:**
```bash
npm install pixi.js @pixi/sound
```

2. **Verify imports in `src/mines.js`:**
```javascript
import { Application, Container, Graphics, ... } from "pixi.js";
```

3. **Check for JavaScript errors** before PixiJS initializes

---

### Issue 6: Module Import Errors

**Symptoms:**
```
Failed to resolve module specifier "pixi.js"
Uncaught TypeError: Failed to resolve module
```

**Solution:**

This means you're not using a bundler. You need either:

**Option A: Use Vite (Recommended)**
```bash
npm install
npm run dev
```

**Option B: Use CDN instead of imports**

Replace imports in `src/mines.js` with:
```html
<!-- In index.html, before your script -->
<script src="https://pixijs.download/v8.x/pixi.min.js"></script>
<script src="https://pixijs.download/release/sound.js"></script>
```

Then change imports to:
```javascript
const { Application, Container, Graphics } = PIXI;
```

---

### Issue 7: Tiles Created But Invisible

**Symptoms:**
- No console errors
- Canvas exists and has size
- Sounds work on hover
- But tiles are invisible

**Solution:**

1. **Check tile colors aren't transparent:**

Open browser console and run:
```javascript
// Force tiles to be visible
const app = window.minesGame?.app;
if (app) {
    app.stage.children.forEach(child => {
        child.children.forEach(tile => {
            if (tile._card) {
                tile._card.tint = 0xff0000; // Make red
                tile.alpha = 1;
                tile.visible = true;
            }
        });
    });
}
```

2. **Check if tiles are off-screen:**
```javascript
const app = window.minesGame?.app;
console.log('Renderer size:', app.renderer.width, app.renderer.height);
console.log('Board position:', app.stage.children[0].position);
```

3. **Check background color isn't same as tiles:**
The tiles are yellow (`#E3E552`), make sure background is different.

---

## 🔬 Advanced Debugging

### Check PixiJS Initialization

Add this to browser console:
```javascript
console.log('PixiJS version:', PIXI?.VERSION);
console.log('Game object:', window.minesGame);
console.log('App:', window.minesGame?.app);
console.log('Stage children:', window.minesGame?.app?.stage?.children);
```

### Inspect Canvas

```javascript
const canvas = document.querySelector('#mines canvas');
console.log('Canvas:', canvas);
console.log('Width:', canvas.width, 'Height:', canvas.height);
console.log('Style:', canvas.style.cssText);
console.log('Computed style:', getComputedStyle(canvas));
```

### Check Tile Creation

```javascript
const tiles = window.minesGame?.app?.stage?.children[0]?.children;
console.log('Number of tiles:', tiles?.length);
console.log('First tile:', tiles?.[0]);
console.log('Tile position:', tiles?.[0]?.position);
console.log('Tile visible:', tiles?.[0]?.visible);
console.log('Tile alpha:', tiles?.[0]?.alpha);
```

### Force Render

```javascript
window.minesGame?.app?.renderer?.render(window.minesGame?.app?.stage);
```

---

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] Using a web server (not opening file directly)
- [ ] No CORS errors in console
- [ ] No 404 errors for assets
- [ ] Canvas element exists in DOM
- [ ] Canvas has non-zero width and height
- [ ] PixiJS initialized successfully
- [ ] No JavaScript errors in console
- [ ] WebGL is supported and enabled
- [ ] Browser is up to date
- [ ] All dependencies installed (`node_modules` exists)

---

## 🆘 Still Not Working?

### Quick Test: Use the Fallback Renderer

Your game has a DOM fallback! If PixiJS fails, it should automatically switch.

Check if you see HTML elements instead of canvas:
```javascript
document.querySelector('#mines').innerHTML;
```

### Try a Different Browser

- Chrome (recommended)
- Firefox
- Edge
- Safari (Mac)

### Clear Cache

1. Press `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
2. Clear cached images and files
3. Refresh the page (`Ctrl+F5` or `Cmd+Shift+R`)

### Reinstall Dependencies

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📝 Report the Issue

If nothing works, gather this info:

1. **Browser & Version:**
   - Open console and run: `navigator.userAgent`

2. **Console Errors:**
   - Copy all red errors from console

3. **Network Tab:**
   - Check if any files failed to load

4. **Canvas Info:**
   - Run the diagnostic scripts above

5. **Screenshot:**
   - Take a screenshot of the page and console

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ Canvas element visible in DOM
- ✅ Canvas has yellow/green border (from debug CSS)
- ✅ Console shows: "✅ Canvas initialized successfully!"
- ✅ Console shows: "PIXI OK" in green overlay
- ✅ You can see yellow tiles in a grid
- ✅ Tiles respond to hover (visual change + sound)
- ✅ No errors in console

---

## 🎉 Once It Works

1. Remove debug CSS (yellow borders)
2. Remove debug console logs
3. Build for production: `npm run build`
4. Deploy to Netlify/Vercel (see `DEPLOY_NOW.md`)

---

**Need more help?** Check the other documentation files or create an issue with the diagnostic info above!

