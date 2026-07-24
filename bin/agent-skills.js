#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const PACKAGE_ROOT = path.join(__dirname, "..");
const DEFAULT_AI = "cursor";
const DEFAULT_SKILL = "odoo";
const DEFAULT_VERSION = "18.0";
const EXCLUDED_DIRS = new Set(["bin", "node_modules"]);
const GITHUB_REPO = "dubwerkz/agent-skills";
const NPM_PACKAGE = "@dubwerkz/agent-skills-cli";

// Config file path for storing last update check
const CONFIG_DIR = path.join(os.homedir(), ".agent-skills");
const UPDATE_CHECK_FILE = path.join(CONFIG_DIR, "update-check.json");
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CODEX_AGENTS_START = "<!-- agent-skills:codex-project:start -->";
const CODEX_AGENTS_END = "<!-- agent-skills:codex-project:end -->";

function printHelp() {
  const text = `
agent-skills - Install agent skills docs by version

Usage:
  agent-skills init --ai <assistant> <skill> [version]
  agent-skills init --ai <assistant> <skill> --version <version>
  agent-skills versions [skill]
  agent-skills skills
  agent-skills update
  agent-skills help

Options:
  --ai <assistant>        cursor | claude | codex | antigravity | kiro | docs | all
  --skill <skill>         Skill folder name (default: ${DEFAULT_SKILL})
  --version <version>     Version (default: ${DEFAULT_VERSION})
  --dest <path>           Destination directory (default: current directory)
  --project               Install Codex skills into this project's .codex/skills
  --force                 Overwrite existing files
  --dry-run               Show what would be copied
  --offline               Skip GitHub download, use bundled assets
  -V, --cli-version       Print CLI version
`;
  console.log(text.trim());
}

function printError(message) {
  console.error(`Error: ${message}`);
}

function getPackageVersion() {
  try {
    const pkg = require(path.join(PACKAGE_ROOT, "package.json"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Get last update check timestamp from config file
function getLastUpdateCheck() {
  try {
    if (fs.existsSync(UPDATE_CHECK_FILE)) {
      const data = fs.readFileSync(UPDATE_CHECK_FILE, "utf8");
      const config = JSON.parse(data);
      return config.lastCheck || 0;
    }
  } catch {
    // Ignore errors
  }
  return 0;
}

// Set last update check timestamp
function setLastUpdateCheck() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(
      UPDATE_CHECK_FILE,
      JSON.stringify({ lastCheck: Date.now() }),
      "utf8"
    );
  } catch {
    // Ignore errors
  }
}

// Background update check - runs asynchronously and notifies if update available
async function checkForUpdatesInBackground() {
  const lastCheck = getLastUpdateCheck();
  const now = Date.now();

  // Only check once per day
  if (now - lastCheck < UPDATE_CHECK_INTERVAL) {
    return;
  }

  setLastUpdateCheck();

  try {
    const currentVersion = getPackageVersion();
    const npmVersion = await fetchLatestNpmVersion();

    if (npmVersion && npmVersion !== currentVersion) {
      // Show update notification after a short delay (so it doesn't interfere with command output)
      setTimeout(() => {
        console.error(
          `\n\x1b[33m\x1b[1m╔════════════════════════════════════════╗\x1b[0m`
        );
        console.error(
          `\x1b[33m\x1b[1m║  Update Available ${currentVersion} → ${npmVersion}  ║\x1b[0m`
        );
        console.error(
          `\x1b[33m\x1b[1m╚════════════════════════════════════════╝\x1b[0m`
        );
        console.error(
          `Run \x1b[36mnpm update -g ${NPM_PACKAGE}\x1b[0m to update.\n`
        );
      }, 500);
    }
  } catch {
    // Silently ignore errors - background check should never break the CLI
  }
}

function getSkillDirs() {
  return fs
    .readdirSync(PACKAGE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => !EXCLUDED_DIRS.has(name))
    .filter((name) => {
      const full = path.join(PACKAGE_ROOT, name);
      const subdirs = fs.readdirSync(full, { withFileTypes: true });
      return subdirs.some((sub) => sub.isDirectory());
    })
    .sort();
}

function listSkills() {
  const skills = getSkillDirs();
  if (skills.length === 0) {
    console.log("No skills found.");
    return;
  }
  console.log("Available skills:");
  for (const skill of skills) console.log(`- ${skill}`);
}

function resolveSkillDir(skill) {
  const dir = path.join(PACKAGE_ROOT, skill);
  if (!fs.existsSync(dir)) {
    printError(`Skill not found: ${skill}`);
    console.log("");
    listSkills();
    process.exit(1);
  }
  return dir;
}

function listVersions(skill) {
  const skillDir = resolveSkillDir(skill);
  const versions = fs
    .readdirSync(skillDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (versions.length === 0) {
    console.log("No versions found.");
    return;
  }

  console.log(`Available versions for ${skill}:`);
  for (const v of versions) console.log(`- ${v}`);
}

function resolveVersionDir(skill, version) {
  const skillDir = resolveSkillDir(skill);
  const dir = path.join(skillDir, version);
  if (!fs.existsSync(dir)) {
    printError(`Version not found: ${skill}/${version}`);
    console.log("");
    listVersions(skill);
    process.exit(1);
  }
  return dir;
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyFile(source, dest, options) {
  const { force, dryRun } = options;
  if (!force && fs.existsSync(dest)) return false;
  if (dryRun) return true;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(source, dest);
  return true;
}

function copyDir(sourceDir, destDir, options, renameExt) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destName = renameExt
      ? renameExt(entry.name, entry.isDirectory())
      : entry.name;
    const destPath = path.join(destDir, destName);
    if (entry.isDirectory()) {
      copyDir(sourcePath, destPath, options, renameExt);
      continue;
    }
    copyFile(sourcePath, destPath, options);
  }
}

function normalize(value) {
  return String(value || "").trim();
}

function parseArgs(argv) {
  const args = {
    command: null,
    ai: null,
    skill: null,
    version: DEFAULT_VERSION,
    dest: process.cwd(),
    destExplicit: false,
    project: false,
    force: false,
    dryRun: false,
    offline: false,
    positionals: [],
  };

  const tokens = argv.slice(2);

  // Handle version and help flags before processing command
  for (const token of tokens) {
    if (token === "-V" || token === "--cli-version") {
      console.log(getPackageVersion());
      process.exit(0);
    }
    if (token === "-h" || token === "--help") {
      args.command = "help";
      return args;
    }
  }

  // First pass: collect all non-flag tokens (commands and positionals)
  const nonFlagTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("-")) {
      // Skip flag and its value
      if (
        token === "--ai" ||
        token === "--skill" ||
        token === "--version" ||
        token === "--dest"
      ) {
        i++; // Skip next token (flag value)
      }
    } else {
      nonFlagTokens.push(token);
    }
  }

  // Set command from first non-flag token
  args.command = nonFlagTokens[0] || "help";

  // Second pass: process all flags
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--ai") {
      args.ai = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token === "--skill") {
      args.skill = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token === "--version") {
      args.version = tokens[i + 1] || args.version;
      i += 1;
      continue;
    }
    if (token === "--dest") {
      args.dest = tokens[i + 1] || args.dest;
      args.destExplicit = true;
      i += 1;
      continue;
    }
    if (token === "--project") {
      args.project = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--offline") {
      args.offline = true;
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    // Non-flag tokens after command go to positionals
    if (token !== args.command) {
      args.positionals.push(token);
    }
  }

  return args;
}

function writeFileIfAllowed(dest, content, options) {
  const { force, dryRun } = options;
  if (!force && fs.existsSync(dest)) return false;
  if (dryRun) return true;
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content);
  return true;
}

function buildCommandContent(skill, version) {
  return `# ${skill} (${version})

Use the docs in \`.shared/${skill}/${version}/\` as the source of truth for this skill.
`;
}

function installShared(skill, versionDir, destRoot, options) {
  const targetDir = path.join(destRoot, ".shared", skill, options.version);
  copyDir(versionDir, targetDir, options, null);
  return targetDir;
}

function installCursor(skill, versionDir, destRoot, options) {
  const sharedDir = installShared(skill, versionDir, destRoot, options);
  const commandPath = path.join(destRoot, ".cursor", "commands", `${skill}.md`);
  const content = buildCommandContent(skill, options.version);
  writeFileIfAllowed(commandPath, content, options);
  return { sharedDir, commandPath };
}

function installAntigravity(skill, versionDir, destRoot, options) {
  const sharedDir = installShared(skill, versionDir, destRoot, options);
  const workflowPath = path.join(destRoot, ".agent", "workflows", `${skill}.md`);
  const content = buildCommandContent(skill, options.version);
  writeFileIfAllowed(workflowPath, content, options);
  return { sharedDir, workflowPath };
}

function installKiro(skill, versionDir, destRoot, options) {
  const sharedDir = installShared(skill, versionDir, destRoot, options);
  const steeringPath = path.join(destRoot, ".kiro", "steering", `${skill}.md`);
  const content = buildCommandContent(skill, options.version);
  writeFileIfAllowed(steeringPath, content, options);
  return { sharedDir, steeringPath };
}

function installDocs(skill, versionDir, destRoot, options) {
  const targetDir = path.join(destRoot, "docs", skill, options.version);
  copyDir(versionDir, targetDir, options, null);
  return targetDir;
}

function installClaude(skill, versionDir, destRoot, options) {
  const targetDir = path.join(destRoot, ".claude", "skills", skill, options.version);
  copyDir(versionDir, targetDir, options, null);
  return targetDir;
}

function getSkillName(versionDir) {
  const skillPath = path.join(versionDir, "SKILL.md");
  try {
    const text = fs.readFileSync(skillPath, "utf8");
    const match = /^name:\s*([^\n]+)$/m.exec(text);
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
  } catch {
    // Fall through to folder-name fallback.
  }
  return path.basename(versionDir).replace(/\.0$/, "");
}

function resolveCodexHome(args) {
  if (args.destExplicit) return args.dest;
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listProjectCodexSkills(projectRoot) {
  const skillsDir = path.join(projectRoot, ".codex", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(skillsDir, name, "SKILL.md")))
    .sort();
}

function readProjectCodexSkillMetadata(projectRoot, skillName) {
  const skillPath = path.join(projectRoot, ".codex", "skills", skillName, "SKILL.md");
  const metadata = { name: skillName, description: "" };
  try {
    const text = fs.readFileSync(skillPath, "utf8");
    const frontmatterMatch = /^---\s*\n([\s\S]*?)\n---/.exec(text);
    if (!frontmatterMatch) return metadata;
    const frontmatter = frontmatterMatch[1];
    const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter);
    if (nameMatch) metadata.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
    const descriptionMatch = /(?:^|\n)description:\s*(?:>|>-)?\s*\n?([\s\S]*?)(?=\n[^\s][A-Za-z0-9_-]*:\s|\s*$)/.exec(frontmatter);
    if (descriptionMatch) {
      metadata.description = descriptionMatch[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Fall through to defaults.
  }
  return metadata;
}

function summarizeSkillDescription(description) {
  const text = String(description || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 260) return text;
  return `${text.slice(0, 257).replace(/\s+\S*$/, "")}...`;
}

function formatOdooSkillLabel(skillName) {
  const match = /^odoo-(\d+)$/.exec(skillName);
  return match ? `Odoo ${match[1]}` : skillName;
}

function buildCodexAgentsBlock(projectRoot) {
  const skills = listProjectCodexSkills(projectRoot);
  const skillMetadata = skills.map((skillName) => ({
    id: skillName,
    ...readProjectCodexSkillMetadata(projectRoot, skillName),
  }));
  const odooSkills = skills.filter((name) => /^odoo-\d+$/.test(name));
  const lines = [
    CODEX_AGENTS_START,
    "## Agent Skills (Codex)",
    "",
    "- Project-local Codex skills are installed in `.codex/skills/`.",
    "- Treat this block as the project-local skill router. Before answering, planning, debugging, or editing, match the user's request and touched files against the installed skills below.",
  ];

  if (skillMetadata.length > 0) {
    lines.push("- Installed project-local skills:");
    for (const skill of skillMetadata) {
      const description = summarizeSkillDescription(skill.description) || "Use when the current task matches this skill's `SKILL.md` guidance.";
      lines.push(`  - \`${skill.name}\`: read and follow \`.codex/skills/${skill.id}/SKILL.md\` when context matches. Trigger summary: ${description}`);
    }
  }

  if (odooSkills.length > 0) {
    lines.push(
      "- MANDATORY Odoo routing: when a task involves Odoo, custom addons, `__manifest__.py`, Odoo Python models, fields, ORM, XML views, security CSV/XML, migrations, controllers, reports, QWeb, OWL assets, or an Odoo traceback, read and follow the installed project-local Odoo skill before answering, planning, debugging, or editing code."
    );
    for (const skillName of odooSkills) {
      lines.push(`- ${formatOdooSkillLabel(skillName)} context: use \`.codex/skills/${skillName}/SKILL.md\`.`);
    }
  } else {
    lines.push(
      "- When an Odoo skill is installed in `.codex/skills/`, use the matching installed version for Odoo work before answering or editing code."
    );
  }

  lines.push(
    "- Do not use Superpowers plugins or skills for Odoo tasks by default, including brainstorming, TDD, systematic debugging, planning, subagent-driven development, or verification workflows.",
    "- Only use Superpowers for Odoo work when the user explicitly asks for them or when higher-priority system/platform instructions require them.",
    CODEX_AGENTS_END,
    ""
  );
  return lines.join("\n");
}

function updateProjectAgents(projectRoot, args) {
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  if (args.dryRun) return agentsPath;

  const block = buildCodexAgentsBlock(projectRoot);
  const existing = fs.existsSync(agentsPath)
    ? fs.readFileSync(agentsPath, "utf8")
    : "";
  const managedBlockPattern = new RegExp(
    `${escapeRegExp(CODEX_AGENTS_START)}[\\s\\S]*?${escapeRegExp(CODEX_AGENTS_END)}\\n?`,
    "m"
  );
  const next = managedBlockPattern.test(existing)
    ? existing.replace(managedBlockPattern, block)
    : `${existing.replace(/\s*$/, "")}\n\n${block}`.replace(/^\n+/, "");

  ensureDir(path.dirname(agentsPath));
  fs.writeFileSync(agentsPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  return agentsPath;
}

function installCodex(versionDir, args) {
  const skillName = getSkillName(versionDir);
  const targetRoot = args.project
    ? path.join(args.dest, ".codex")
    : resolveCodexHome(args);
  const targetDir = path.join(targetRoot, "skills", skillName);
  copyDir(versionDir, targetDir, args, null);
  if (args.project) updateProjectAgents(args.dest, args);
  return targetDir;
}

function runInit(args) {
  const ai = normalize(args.ai || DEFAULT_AI).toLowerCase();
  const positional = args.positionals;
  const skill = normalize(args.skill || positional[0] || DEFAULT_SKILL);
  const version = normalize(args.version || positional[1] || DEFAULT_VERSION);
  const versionDir = resolveVersionDir(skill, version);

  const valid = new Set([
    "cursor",
    "claude",
    "codex",
    "antigravity",
    "kiro",
    "docs",
    "all",
  ]);
  if (!valid.has(ai)) {
    printError(`Unknown --ai value: ${ai}`);
    printHelp();
    process.exit(1);
  }

  const installArgs = { ...args, version };
  const results = [];
  if (ai === "cursor" || ai === "all") {
    const target = installCursor(skill, versionDir, args.dest, installArgs);
    results.push(`cursor -> ${target.commandPath}`);
    results.push(`shared -> ${target.sharedDir}`);
  }
  if (ai === "antigravity" || ai === "all") {
    const target = installAntigravity(skill, versionDir, args.dest, installArgs);
    results.push(`antigravity -> ${target.workflowPath}`);
    results.push(`shared -> ${target.sharedDir}`);
  }
  if (ai === "kiro" || ai === "all") {
    const target = installKiro(skill, versionDir, args.dest, installArgs);
    results.push(`kiro -> ${target.steeringPath}`);
    results.push(`shared -> ${target.sharedDir}`);
  }
  if (ai === "docs" || ai === "all") {
    const target = installDocs(skill, versionDir, args.dest, installArgs);
    results.push(`docs -> ${target}`);
  }
  if (ai === "claude" || ai === "all") {
    const target = installClaude(skill, versionDir, args.dest, installArgs);
    results.push(`claude -> ${target}`);
  }
  if (ai === "codex" || ai === "all") {
    const target = installCodex(versionDir, installArgs);
    results.push(`codex -> ${target}`);
  }

  if (args.dryRun) {
    console.log("Dry run. Planned installs:");
  } else {
    console.log("Install complete:");
  }
  for (const line of results) console.log(`- ${line}`);
}

// Fetch latest version from npm registry
function fetchLatestNpmVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "registry.npmjs.org",
      path: `/${NPM_PACKAGE.replace("/", "%2F")}`,
      method: "GET",
      headers: { "User-Agent": "agent-skills-cli" },
    };

    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const pkg = JSON.parse(data);
            resolve(pkg["dist-tags"]?.latest || null);
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

// Fetch latest release from GitHub
function fetchLatestGitHubRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: "GET",
      headers: {
        "User-Agent": "agent-skills-cli",
        Accept: "application/vnd.github.v3+json",
      },
    };

    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              resolve({ tag: release.tag_name, url: release.html_url });
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

// Update command
async function runUpdate(args) {
  const currentVersion = getPackageVersion();
  console.log(`Current version: ${currentVersion}`);
  console.log("Checking for updates...\n");

  if (!args.offline) {
    const [npmVersion, githubRelease] = await Promise.all([
      fetchLatestNpmVersion(),
      fetchLatestGitHubRelease(),
    ]);

    if (npmVersion && npmVersion !== currentVersion) {
      console.log(`\x1b[33mNew version available on npm: ${npmVersion}\x1b[0m`);
      console.log(`To update, run: \x1b[36mnpm install -g ${NPM_PACKAGE}@latest\x1b[0m\n`);
    } else {
      console.log(`\x1b[32mCLI is up to date!\x1b[0m\n`);
    }

    if (githubRelease) {
      console.log(`Latest GitHub release: ${githubRelease.tag}`);
      console.log(`Release notes: ${githubRelease.url}\n`);
    }
  } else {
    console.log("Offline mode: Skipping update check.");
  }
}

function main() {
  const args = parseArgs(process.argv);
  const cmd = normalize(args.command).toLowerCase();

  // Background update check (async, non-blocking)
  // Skip for update command and offline mode
  if (cmd !== "update" && !args.offline) {
    checkForUpdatesInBackground();
  }

  if (cmd === "skills") {
    listSkills();
    return;
  }

  if (cmd === "versions") {
    const skill = normalize(args.positionals[0] || args.skill || DEFAULT_SKILL);
    listVersions(skill);
    return;
  }

  if (cmd === "init") {
    runInit(args);
    return;
  }

  if (cmd === "update") {
    runUpdate(args).catch(() => {
      printError("Failed to check for updates. Check your internet connection.");
    });
    return;
  }

  printHelp();
}

main();
