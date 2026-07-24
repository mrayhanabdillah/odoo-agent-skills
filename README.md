# Odoo Agent Skills

![Odoo Agent Skills Hero](lib/image/header-new.png)

[![npm version](https://img.shields.io/npm/v/@dubwerkz/odoo-agent-skills.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@dubwerkz/odoo-agent-skills)
[![npm downloads](https://img.shields.io/npm/dm/@dubwerkz/odoo-agent-skills.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@dubwerkz/odoo-agent-skills)
[![GitHub stars](https://img.shields.io/github/stars/dubwerkz/odoo-agent-skills?style=flat-square&color=yellow)](https://github.com/dubwerkz/odoo-agent-skills/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/dubwerkz/odoo-agent-skills?style=flat-square)](https://github.com/dubwerkz/odoo-agent-skills/commits/main)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/dubwerkz/odoo-agent-skills/pulls)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Version-aware Odoo skill packs for Codex and other AI coding assistants.

The project packages curated Odoo references, workflow guidance, and install tooling so an AI agent can load the right Odoo knowledge for the project it is editing.

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Quick Start](#quick-start)
- [Codex Project Install](#codex-project-install)
- [Codex Plugin](#codex-plugin)
- [CLI Usage](#cli-usage)
- [Available Skills](#available-skills)
- [Odoo Version Routing](#odoo-version-routing)
- [Supported Tools](#supported-tools)
- [Project Structure](#project-structure)
- [Development](#development)
- [Links](#links)

---

## Why This Exists

Generic AI coding assistants often mix Odoo versions or miss framework-specific details. Odoo Agent Skills gives the assistant project-local context for:

- Odoo 16, 17, 18, and 19 API differences
- module manifests, models, fields, views, security, reports, controllers, migrations, tests, and OWL
- Odoo-specific code review and trace workflows
- project-level routing rules through `AGENTS.md` for Codex
- clear guidance to avoid unrelated Superpowers workflows for Odoo tasks unless explicitly requested

| Without Odoo Agent Skills | With Odoo Agent Skills |
|---------------------------|-------------------------|
| May mix Odoo 16/17/18/19 syntax | Loads the installed Odoo version guide |
| Generic Python/XML suggestions | Odoo-specific ORM, XML, security, and manifest guidance |
| Manual context copy-paste | Project-local `.codex/skills` + `AGENTS.md` router |

---

## Quick Start

GitHub is the preferred install source.

```bash
# Install Odoo 18 skill locally into the current Codex project
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-18.0
```

This creates or updates:

```text
.codex/skills/odoo-18/SKILL.md
AGENTS.md
```

After that, Codex can detect Odoo context in the project and route to the installed project-local Odoo skill.

---

## Codex Project Install

Use `--project` when the skill should belong to one repository instead of your global Codex home.

```bash
# Odoo 16
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-16.0

# Odoo 17
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-17.0

# Odoo 18
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-18.0

# Odoo 19
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-19.0
```

Project install behavior:

- copies the selected skill into `.codex/skills/<skill-name>`
- creates `AGENTS.md` if it does not exist
- preserves existing `AGENTS.md` content
- updates only the managed `odoo-agent-skills` block on repeated installs
- tells Codex to use installed Odoo skills for Odoo files, addons, manifests, XML views, security, migrations, reports, controllers, OWL, and tracebacks
- tells Codex not to use Superpowers for Odoo work by default

---

## Codex Plugin

This repository also includes a Codex plugin manifest at `.codex-plugin/plugin.json`.

Plugin concept:

- a plugin bundles skills and metadata so Codex can discover them as one package
- plugin installation is useful for making the skill collection available in Codex
- project-local behavior still comes from the CLI `--project` install because it writes `.codex/skills` and `AGENTS.md` inside the repository

Recommended workflow:

1. Install or enable the plugin when you want the whole collection available in Codex.
2. Run `odoo-agent-skills init --ai codex --project ...` inside each Odoo repository that needs deterministic project routing.

---

## CLI Usage

Run from GitHub:

```bash
npx github:dubwerkz/odoo-agent-skills help
npx github:dubwerkz/odoo-agent-skills skills
npx github:dubwerkz/odoo-agent-skills versions skills
```

Install examples:

```bash
# Codex project-local install
npx github:dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-18.0

# Codex global install
npx github:dubwerkz/odoo-agent-skills init --ai codex --skill skills --version odoo-18.0

# Cursor install via CLI
npx github:dubwerkz/odoo-agent-skills init --ai cursor --skill skills --version odoo-18.0

# Docs-only export
npx github:dubwerkz/odoo-agent-skills init --ai docs --skill skills --version odoo-18.0
```

The npm package is still available as a fallback:

```bash
npx @dubwerkz/odoo-agent-skills help
npx @dubwerkz/odoo-agent-skills init --ai codex --project --skill skills --version odoo-18.0
```

---

## Available Skills

| Skill | Purpose |
|-------|---------|
| `skills/odoo-16.0` | Odoo 16 reference pack |
| `skills/odoo-17.0` | Odoo 17 reference pack |
| `skills/odoo-18.0` | Odoo 18 reference pack |
| `skills/odoo-19.0` | Odoo 19 reference pack |
| `skills/odoo-commit` | Odoo-style commit message and workflow guidance |
| `skills/code-review` | General code review workflow |
| `skills/dtg-base` | DTG Base development guidance |
| `skills/flow-diagram` | HTML/SVG flow and architecture diagram guidance |
| `skills/slide` | HTML/React slide deck guidance |

Agent-oriented guides are also included under `agents/`:

- `agents/odoo-code-review`
- `agents/odoo-code-tracer`
- `agents/planner.md`

---

## Odoo Version Routing

Install the Odoo skill that matches the target project version.

| Odoo version | Install version | Codex skill path |
|--------------|-----------------|------------------|
| 16.0 | `odoo-16.0` | `.codex/skills/odoo-16` |
| 17.0 | `odoo-17.0` | `.codex/skills/odoo-17` |
| 18.0 | `odoo-18.0` | `.codex/skills/odoo-18` |
| 19.0 | `odoo-19.0` | `.codex/skills/odoo-19` |

Key version differences covered by the guides:

| Topic | Odoo 16 | Odoo 17 | Odoo 18+ |
|-------|---------|---------|----------|
| Dynamic modifiers | `attrs` / `states` | direct expressions | direct expressions |
| List view root tag | `<tree>` | `<tree>` | `<list>` |
| Field aggregation | `group_operator=` | `group_operator=` | `aggregator=` |
| Chatter layout | explicit `oe_chatter` block | explicit `oe_chatter` block | `<chatter/>` shortcut |

---

## Supported Tools

| Tool | Install method |
|------|----------------|
| Codex | CLI `--ai codex`, ideally with `--project` |
| Cursor | CLI `--ai cursor` or `npx skills add dubwerkz/odoo-agent-skills` |
| Claude Code | `.claude-plugin` manifest or CLI `--ai claude` |
| Antigravity | CLI `--ai antigravity` |
| Kiro | CLI `--ai kiro` |
| Plain docs | CLI `--ai docs` |

---

## Project Structure

```text
odoo-agent-skills/
├── .codex-plugin/             # Codex plugin manifest
├── .claude-plugin/            # Claude Code plugin metadata
├── agents/                    # Agent workflows and reviewers
├── bin/                       # CLI (`odoo-agent-skills`)
├── docs/                      # Supporting docs
├── lib/                       # Shared assets
├── rules/                     # Style and security rules
├── skills/                    # Installable skill packs
├── tests/                     # Structural validation
├── CHANGELOG.md
├── package.json
└── README.md
```

---

## Development

Run validations before publishing or opening a PR:

```bash
node --check bin/odoo-agent-skills.js
npm test
npm pack --dry-run
```

Release notes are tracked in `CHANGELOG.md`. The package version in `package.json` must have a matching changelog section.

---

## Links

- [Repository](https://github.com/dubwerkz/odoo-agent-skills)
- [Issues](https://github.com/dubwerkz/odoo-agent-skills/issues)
- [Discussions](https://github.com/dubwerkz/odoo-agent-skills/discussions)
- [Releases](https://github.com/dubwerkz/odoo-agent-skills/releases)
- [npm Package](https://www.npmjs.com/package/@dubwerkz/odoo-agent-skills)

---

<div align="center">

_If this project helps your Odoo workflow, please consider giving it a star._

[![Star History Chart](https://api.star-history.com/svg?repos=dubwerkz/odoo-agent-skills&type=Date)](https://star-history.com/#dubwerkz/odoo-agent-skills&Date)

</div>
