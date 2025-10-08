# 🚀 Complete Deployment Guide for Mines Game

This guide covers multiple ways to deploy your PixiJS Mines game to the web.

---

## 📋 Table of Contents

1. [Quick Deploy (No Build Required)](#quick-deploy-no-build-required)
2. [Production Build](#production-build)
3. [Deploy to Netlify](#deploy-to-netlify)
4. [Deploy to Vercel](#deploy-to-vercel)
5. [Deploy to GitHub Pages](#deploy-to-github-pages)
6. [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
7. [Deploy to Firebase Hosting](#deploy-to-firebase-hosting)
8. [Deploy to AWS S3](#deploy-to-aws-s3)
9. [Custom Domain Setup](#custom-domain-setup)

---

## 🎯 Quick Deploy (No Build Required)

### Option 1: Netlify Drop (Easiest!)

1. **Build your project:**
```bash
npm install
npm run build
```

2. **Go to Netlify Drop:**
   - Visit: https://app.netlify.com/drop
   - Drag and drop your `dist` folder
   - Done! Your site is live instantly

### Option 2: Vercel CLI

```bash
npm install -g vercel
npm run build
vercel --prod
```

Follow the prompts, and your site will be live in seconds!

---

## 🏗️ Production Build

Before deploying, always create an optimized production build:

```bash
# Install dependencies (first time only)
npm install

# Create production build
npm run build
```

This creates a `dist/` folder with:
- ✅ Minified JavaScript
- ✅ Optimized assets
- ✅ Compressed files
- ✅ Production-ready code

**The `dist/` folder is what you deploy!**

---

## 🌐 Deploy to Netlify

### Method 1: Drag & Drop (Recommended for Beginners)

1. Build your project:
```bash
npm run build
```

2. Go to [Netlify](https://app.netlify.com/)
3. Sign up/login (free account)
4. Drag the `dist` folder to the drop zone
5. Your site is live! 🎉

### Method 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### Method 3: Git Integration (Continuous Deployment)

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com/)
3. Click "New site from Git"
4. Connect your GitHub repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click "Deploy site"

**Every push to your repo will auto-deploy!** 🚀

### Custom Domain on Netlify

1. Go to Site Settings → Domain Management
2. Click "Add custom domain"
3. Follow DNS configuration instructions

---

## ⚡ Deploy to Vercel

### Method 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
npm run build
vercel --prod
```

### Method 2: Git Integration

1. Push code to GitHub
2. Go to [Vercel](https://vercel.com/)
3. Click "Import Project"
4. Select your repository
5. Vercel auto-detects Vite settings
6. Click "Deploy"

**Configuration (if needed):**
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Custom Domain on Vercel

1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as shown

---

## 📄 Deploy to GitHub Pages

### Method 1: Manual Deployment

```bash
# Build the project
npm run build

# Create gh-pages branch and push dist folder
git subtree push --prefix dist origin gh-pages
```

### Method 2: GitHub Actions (Automated)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

**Enable GitHub Pages:**
1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` / `root`
4. Save

Your site will be at: `https://yourusername.github.io/repository-name/`

### Fix Base Path for GitHub Pages

Update `vite.config.js`:

```javascript
export default defineConfig({
  base: '/repository-name/', // Replace with your repo name
  // ... rest of config
});
```

---

## ☁️ Deploy to Cloudflare Pages

### Method 1: Dashboard

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Click "Create a project"
3. Connect your Git repository
4. Configure build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click "Save and Deploy"

### Method 2: Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Build
npm run build

# Deploy
wrangler pages publish dist
```

---

## 🔥 Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize Firebase in your project
firebase init hosting

# Select options:
# - Public directory: dist
# - Single-page app: Yes
# - GitHub auto-deploy: Optional

# Build your project
npm run build

# Deploy
firebase deploy --only hosting
```

**Your site will be at:** `https://your-project.web.app`

---

## 📦 Deploy to AWS S3 + CloudFront

### Step 1: Create S3 Bucket

```bash
# Install AWS CLI
# Download from: https://aws.amazon.com/cli/

# Configure AWS credentials
aws configure

# Create bucket
aws s3 mb s3://your-bucket-name

# Enable static website hosting
aws s3 website s3://your-bucket-name --index-document index.html
```

### Step 2: Upload Files

```bash
# Build project
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Make files public
aws s3 cp s3://your-bucket-name s3://your-bucket-name --recursive --acl public-read
```

### Step 3: Setup CloudFront (Optional, for CDN)

1. Go to AWS CloudFront Console
2. Create distribution
3. Origin: Your S3 bucket
4. Default root object: `index.html`
5. Wait for deployment (~15 minutes)

---

## 🌍 Custom Domain Setup

### For Netlify/Vercel/Cloudflare:

1. **Add domain in platform dashboard**
2. **Update DNS records at your domain registrar:**

```
Type: CNAME
Name: www
Value: your-site.netlify.app (or vercel.app, pages.dev)

Type: A
Name: @
Value: [IP provided by platform]
```

3. **Wait for DNS propagation** (5 minutes - 48 hours)
4. **Enable HTTPS** (usually automatic)

### SSL Certificate

Most platforms provide free SSL certificates automatically via Let's Encrypt.

---

## 🔍 Deployment Checklist

Before deploying, ensure:

- ✅ All assets load correctly locally
- ✅ No console errors in production build
- ✅ `npm run build` completes successfully
- ✅ Test the `dist` folder locally: `npx serve dist`
- ✅ Update base path if deploying to subdirectory
- ✅ Environment variables configured (if any)
- ✅ Analytics/tracking codes added (if needed)
- ✅ Favicon and meta tags set
- ✅ Mobile responsive design tested
- ✅ Cross-browser compatibility checked

---

## 🐛 Common Deployment Issues

### Issue: 404 on page refresh

**Solution:** Configure your hosting for SPA routing:

**Netlify:** Create `public/_redirects`:
```
/*    /index.html   200
```

**Vercel:** Create `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Issue: Assets not loading

**Solution:** Check base path in `vite.config.js`:
```javascript
base: './' // For relative paths
// or
base: '/your-repo-name/' // For GitHub Pages
```

### Issue: CORS errors

**Solution:** Ensure all assets are served from same domain or configure CORS headers.

### Issue: Large bundle size

**Solution:** Optimize build:
```javascript
// vite.config.js
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
});
```

---

## 📊 Performance Optimization

### Enable Compression

Most platforms enable gzip/brotli automatically. Verify with:
```bash
curl -H "Accept-Encoding: gzip" -I https://your-site.com
```

### Add Caching Headers

**Netlify:** Create `netlify.toml`:
```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

**Vercel:** Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## 🎉 Recommended Platforms

| Platform | Best For | Free Tier | Custom Domain | SSL | CDN |
|----------|----------|-----------|---------------|-----|-----|
| **Netlify** | Beginners | ✅ 100GB/mo | ✅ | ✅ | ✅ |
| **Vercel** | Next.js/React | ✅ 100GB/mo | ✅ | ✅ | ✅ |
| **Cloudflare Pages** | Performance | ✅ Unlimited | ✅ | ✅ | ✅ |
| **GitHub Pages** | Open Source | ✅ 1GB | ✅ | ✅ | ❌ |
| **Firebase** | Google Ecosystem | ✅ 10GB/mo | ✅ | ✅ | ✅ |

**My Recommendation:** Start with **Netlify** or **Vercel** for the easiest experience!

---

## 🆘 Need Help?

- Check platform documentation
- Search Stack Overflow
- Ask in platform Discord/forums
- Check browser console for errors

---

**Happy Deploying! 🚀**

