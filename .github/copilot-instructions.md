# Copilot Coding Agent Instructions for Equicord (readReceipts fork)

## Scope of This Fork

This is a personal fork of the Equicord Discord client mod. **All development is focused exclusively on the `readReceipts` user plugin** located at:

```
src/userplugins/readReceipts/
```

Everything outside that directory is upstream Equicord code and should be treated as **read-only context**. Do not modify files in `src/plugins/`, `src/equicordplugins/`, `src/api/`, `src/utils/`, `src/webpack/`, `src/components/`, or any other directory unless the change is strictly required to support the readReceipts plugin and there is no alternative.

## Build, Test, and Lint

**Package manager:** pnpm (v10, installed via corepack)

```bash
# Install dependencies (always first)
corepack enable
pnpm install --frozen-lockfile

# Quick TypeScript check (fastest validation, run often)
pnpm testTsc

# Lint (ESLint with auto-fix)
pnpm lint:fix

# CSS lint (excludes userplugins by design)
pnpm lint-styles

# Full build (desktop standalone, used by CI)
pnpm buildStandalone

# Full test suite (build + tsc + lint + style lint + plugin JSON validation)
# This is what CI runs on every PR
pnpm test

# Web build (also tested in CI)
pnpm buildWeb

# Plugin structure validation
pnpm generatePluginJson
```

### CI Pipeline

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on pushes and PRs to `main` and `dev`:
1. `pnpm install --frozen-lockfile`
2. `pnpm test` (buildStandalone → testTsc → lint:fix → lint-styles → generatePluginJson)
3. `pnpm buildWeb`
4. `pnpm generatePluginJson`

### Recommended Validation Order

When making changes, validate in this order (fastest to slowest):
1. `pnpm testTsc` — catches type errors in seconds
2. `pnpm lint:fix` — catches style issues and auto-fixes them
3. `pnpm buildStandalone` — full build, confirms no bundling issues

## The readReceipts Plugin

**Location:** `src/userplugins/readReceipts/index.ts`

**What it does:** Appends an invisible read receipt link to outgoing Discord messages. When the recipient's client loads the message, the hidden link is fetched, acting as a read receipt. The link is stripped from the sender's own local render so it stays invisible to them.

**How it works:**
- Hooks `MessageActions.sendMessage` to append a hidden Markdown link (`[︀](baseUrl/uuid)`) to outgoing messages
- Uses `FluxDispatcher` to subscribe to `MESSAGE_CREATE` and `MESSAGE_UPDATE` events to strip the link from the sender's own rendered messages
- Uses `ChannelStore` to distinguish DMs from server channels
- Uses `UserStore.getCurrentUser()` to identify the current user
- Settings control the base URL and whether receipts are enabled in DMs and/or servers

**Current imports used:**
```typescript
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, MessageActions, UserStore } from "@webpack/common";
```

## Plugin Development Patterns

### Plugin Definition

Every plugin exports a default `definePlugin({...})` object:

```typescript
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    myOption: {
        type: OptionType.STRING,
        default: "value",
        description: "Description ending with a period."
    }
});

export default definePlugin({
    name: "PluginName",
    description: "What it does, ending with a period.",
    authors: [{ name: "AuthorName", id: 123456789n }],
    settings,
    start() { /* called when plugin enables */ },
    stop() { /* called when plugin disables, clean up here */ }
});
```

### Key APIs Available

- **Settings:** `definePluginSettings` from `@api/Settings` with `OptionType.STRING`, `BOOLEAN`, `NUMBER`, `SELECT`, `SLIDER`, `COMPONENT`
- **Webpack stores:** `UserStore`, `ChannelStore`, `GuildStore`, `MessageStore`, `SelectedChannelStore` from `@webpack/common`
- **Actions:** `FluxDispatcher`, `MessageActions`, `RestAPI` from `@webpack/common`
- **Message events:** `addMessagePreSendListener`, `removeMessagePreSendListener` from `@api/MessageEvents` (alternative to manually hooking sendMessage)
- **Flux events:** Use the `flux` property on the plugin object to subscribe declaratively:
  ```typescript
  flux: {
      MESSAGE_CREATE(event) { /* handle */ },
      MESSAGE_UPDATE(event) { /* handle */ }
  }
  ```
- **Data persistence:** `@api/DataStore` for IndexedDB storage
- **Logging:** `Logger` from `@utils/Logger` (never use `console.log`)

### Path Aliases (from tsconfig)

```
@api/*           → src/api/*
@utils/*         → src/utils/*
@components/*    → src/components/*
@webpack/*       → src/webpack/*
@webpack/common  → src/webpack/common
@plugins/*       → src/plugins/*
@equicordplugins/* → src/equicordplugins/*
```

## Coding Standards

### License Header

New files must use this header (year 2026):
```
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
```

Never edit existing license headers on upstream files.

### TypeScript Style

- Use optional chaining (`?.`), nullish coalescing (`??`), `const`, arrow functions
- Prefer early returns and flat control flow over deep nesting
- Trust type inference; don't annotate when obvious
- Never use `any` for Discord objects; import proper types from `@vencord/discord-types`
- Delete dead code instead of commenting it out

### ESLint Enforced Rules

- Double quotes for strings and JSX
- Semicolons required
- Arrow function parentheses only when needed
- Import sorting enforced (simple-import-sort)
- Unused imports are auto-removed
- GPL license header enforced on all source files

### Anti-Patterns to Avoid

- `value !== null && value !== undefined` → use `value != null`
- `value || defaultValue` → use `value ?? defaultValue`
- `settings?.store?.value` → use `settings.store.value` (settings is always defined)
- No raw DOM manipulation (`document.querySelector`, `MutationObserver`)
- No `console.log` → use `Logger` from `@utils/Logger`
- No hardcoded CDN URLs → use `IconUtils` from `@webpack/common`
- No template strings for combining class names → use `classes()` from `@utils/misc`

## Errors and Workarounds

### pnpm not found

pnpm is not installed globally. Enable it via corepack first:
```bash
corepack enable
pnpm install --frozen-lockfile
```

### npm warnings about strict-peer-dependencies

The `.npmrc` sets `strict-peer-dependencies=false` and `package-manager-strict=false`. These warnings from npm are expected and harmless when using corepack to activate pnpm.

### lint-styles excludes userplugins

The `lint-styles` script explicitly ignores `src/userplugins` via `--ignore-pattern`. If you add CSS files to the readReceipts plugin, they will not be checked by stylelint. You can optionally run stylelint manually against them for consistency, but CI will not enforce it.

### Full test suite is slow

`pnpm test` runs the full build pipeline. For quick iteration, use `pnpm testTsc` to catch type errors and `pnpm lint:fix` for style issues. Only run the full `pnpm test` when you are confident the changes are ready.

### Node version

The project requires Node >= 18. The CI uses Node 20. Locally, any Node 18+ should work.
