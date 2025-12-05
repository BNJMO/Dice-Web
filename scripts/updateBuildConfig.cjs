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

function updateConfig() {
  const config = loadConfig();
  const nextConfig = {
    buildId: incrementBuildId(config.buildId),
    buildDate: formatBuildDate(),
    environment: config.environment || "Production",
  };

  fs.writeFileSync(buildConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
  console.log("Updated buildConfig.json:", nextConfig);
}

updateConfig();
