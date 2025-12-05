const fs = require("fs");
const path = require("path");

const buildConfigPath = path.resolve(__dirname, "..", "buildConfig.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(buildConfigPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read buildConfig.json, using defaults:", error);
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(buildConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

function incrementBuildId(currentId = "0.0.0") {
  const parts = currentId.split(".").map((value) => Number.parseInt(value, 10));
  const [major = 0, minor = 0, patch = 0] = parts;

  const nextPatch = Number.isFinite(patch) ? patch + 1 : 1;
  const safeMinor = Number.isFinite(minor) ? minor : 0;
  const safeMajor = Number.isFinite(major) ? major : 0;

  return `${safeMajor}.${safeMinor}.${nextPatch}`;
}

function formatBuildDate() {
  return new Date().toLocaleString();
}

function ensureViteConfig(config) {
  const defaultVite = {
    vitePath: "/Mines-Demo/",
    localVitePath: "/Mines-Demo/",
    exportVitePath: "/_Games/dice_crash/",
  };

  return {
    ...defaultVite,
    ...(config.vite || {}),
  };
}

function applyVitePath(config, source) {
  const normalizedSource = source?.toLowerCase();

  if (normalizedSource === "export") {
    config.vite.vitePath = config.vite.exportVitePath;
    console.log("Set vitePath to exportVitePath:", config.vite.vitePath);
  } else if (normalizedSource === "local") {
    config.vite.vitePath = config.vite.localVitePath;
    console.log("Set vitePath to localVitePath:", config.vite.vitePath);
  }
}

function applyMetadata(config) {
  config.buildId = incrementBuildId(config.buildId);
  config.buildDate = formatBuildDate();
  config.environment = config.environment || "Production";
}

function updateConfig() {
  const args = process.argv.slice(2);
  const vitePathIndex = args.indexOf("--set-vite-path");
  const vitePathSource = vitePathIndex !== -1 ? args[vitePathIndex + 1] : undefined;
  const skipMetadata = args.includes("--skip-metadata");

  const config = loadConfig();
  config.vite = ensureViteConfig(config);
  config.environment = config.environment || "Production";

  if (vitePathSource) {
    applyVitePath(config, vitePathSource);
  }

  if (!skipMetadata) {
    applyMetadata(config);
  }

  saveConfig(config);
  console.log("Updated buildConfig.json:", config);
}

updateConfig();
