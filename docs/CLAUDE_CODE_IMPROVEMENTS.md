# Claude Code Best Practices - Improvement Plan

This document analyzes Claude Code best practices against our personal-finance-mcp codebase and provides an actionable improvement plan.

## Analysis Summary

### ✅ Already Implemented

1. **CLAUDE.md file exists** - Comprehensive documentation at project root
2. **Tool allowlist configured** - `.claude/settings.local.json` with safe operations
3. **gh CLI integration** - Using GitHub for PRs and issues
4. **MCP client usage** - Connected to Vercel MCP server
5. **Prompt engineering documented** - `docs/CLAUDE_PROMPT_ENGINEERING_GUIDE.md`

### 🟡 Partially Implemented

1. **CLAUDE.md optimization** - Comprehensive but could add emphasis and structure
2. **Tool allowlist** - Good foundation but could add more safe operations
3. **Git workflows** - Documented but could add more automation

### ❌ Not Implemented

1. **Custom slash commands** - No `.claude/commands/` directory
2. **MCP server configuration** - No `.mcp.json` file for team sharing
3. **Headless automation** - No CI/CD integration with Claude
4. **Multi-Claude workflows** - Not documented

---

## High-Priority Improvements

### 1. Create Custom Slash Commands

**Why:** Automate common workflows for this project (fixing issues, running tests, deployments)

**Action Items:**
- Create `.claude/commands/` directory
- Add commands for:
  - `fix-github-issue.md` - Pull and fix GitHub issues
  - `run-integration-tests.md` - Run full integration test suite with error handling
  - `deploy-vercel.md` - Deploy to Vercel with verification
  - `create-migration.md` - Create new database migration with validation
  - `test-plaid-sandbox.md` - Test Plaid integration in sandbox mode
  - `update-docs.md` - Update CLAUDE.md and README after changes

**Example command** (`.claude/commands/fix-github-issue.md`):
```markdown
Please analyze and fix GitHub issue: $ARGUMENTS

Follow these steps:
1. Use `gh issue view $ARGUMENTS` to get issue details
2. Read all referenced files mentioned in the issue
3. Search codebase for related files using Grep and Read tools
4. Create a plan and confirm with me before implementing
5. Implement the fix following our code style (TypeScript, ES modules)
6. Run `npm run typecheck` and `npm run test:integration` to verify
7. Update CLAUDE.md if this reveals new patterns or gotchas
8. Create descriptive commit message (max 7 lines, see Git Commit Guidelines)
9. Push and create PR using `gh pr create`

Important: Follow all guidelines in CLAUDE.md Git Commit Guidelines section.
```

---

### 2. Optimize CLAUDE.md Structure

**Why:** Current CLAUDE.md is comprehensive but could be more scannable and emphasize critical instructions

**Action Items:**

#### a. Add emphasis to critical instructions
```markdown
**IMPORTANT:** All database migrations must be append-only. NEVER edit existing migrations.

**YOU MUST:** Run `npm run typecheck` after making code changes.

**CRITICAL:** Commit messages must be maximum 7 lines total.
```

#### b. Add "Quick Start" section at the top
```markdown
## Quick Start

**Common Commands:**
- `npm run dev` - Start development server
- `npm run typecheck` - Type check (do this often!)
- `npm test` - Run tests
- `gh pr create` - Create pull request

**Before You Start:**
- Read the Git Commit Guidelines section below
- All migrations go in `migrations/` folder with sequential numbering
- NEVER edit README.md (human-maintained)
```

#### c. Add "Common Gotchas" section
```markdown
## Common Gotchas

1. **Widget metadata injection** - We use a handler wrapper pattern, not manual tool registration (see "Why Our Current Implementation Works" section)
2. **Plaid sandbox credentials** - Use `user_good` / `pass_good` for testing
3. **Environment variables** - Require `ENCRYPTION_KEY`, `JWT_SECRET`, `SUPABASE_URL`, `CLERK_*` keys
4. **Transaction storage** - Always read from database, not Plaid API (except during refresh)
```

---

### 3. Expand Tool Allowlist

**Why:** Reduce friction for common safe operations

**Action Items:**

Add to `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build:*)",
      "Bash(npm run dev:*)",
      "Bash(npm install)",
      "Bash(npm test:*)",
      "Bash(npm run test:integration:*)",
      "Bash(npm run typecheck)",
      "Bash(npm run sandbox:*)",
      "Bash(curl:*)",
      "Bash(git status)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push)",
      "Bash(git mv:*)",
      "Bash(gh issue:*)",
      "Bash(gh pr:*)",
      "Bash(rm:*)",
      "Edit",
      "Write"
    ]
  }
}
```

**Rationale:**
- `npm run typecheck` - Always safe, frequently needed
- `git` commands - Easy to undo with version control
- `gh` commands - Safe GitHub interactions
- `Edit`/`Write` - File operations are easily revertable with git

---

### 4. Create Shared MCP Configuration

**Why:** Make MCP servers available to all team members automatically

**Action Items:**

Create `.mcp.json` (checked into git):
```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    }
  }
}
```

Add to `.gitignore`:
```
.mcp.local.json
```

Add to CLAUDE.md:
```markdown
## MCP Servers

This project uses the following MCP servers (configured in `.mcp.json`):

- **Vercel** - Deploy and monitor Vercel deployments
  - Requires `VERCEL_TOKEN` environment variable
  - Get token from: https://vercel.com/account/tokens

To add personal MCP servers without committing, use `.mcp.local.json`.
```

---

## Medium-Priority Improvements

### 5. Add Testing Workflow Documentation

**Action Items:**

Add to CLAUDE.md under "Common Commands":
```markdown
## Testing Workflow

**Recommended TDD workflow:**
1. Write tests first (tell Claude: "Write tests, do NOT implement yet")
2. Confirm tests fail: `npm test`
3. Commit tests: `git add . && git commit -m "Add tests for X"`
4. Implement code to pass tests
5. Iterate until all tests pass
6. Run full suite: `npm run test:integration`
7. Commit implementation

**Integration testing:**
- Tests use Supabase test database
- Run with: `npm run test:integration`
- See `test/README.md` for details
```

---

### 6. Add Visual Feedback Documentation

**Action Items:**

Add to CLAUDE.md:
```markdown
## Working with Widgets

When modifying ChatGPT widgets:

1. **Make changes** to widget source in `widgets/src/`
2. **Build widgets**: `cd widgets && npm run build:all`
3. **Test locally**: Start dev server and test in ChatGPT
4. **Take screenshots**: Use cmd+ctrl+shift+4 (macOS) to screenshot
5. **Paste screenshots**: Paste into Claude for visual verification
6. **Iterate**: Ask Claude to compare screenshot vs. expected design

Widget build output goes to `public/widgets/` and is committed to git.
```

---

### 7. Document Multi-Claude Workflows

**Action Items:**

Add to CLAUDE.md:
```markdown
## Advanced: Multi-Claude Workflows

For complex tasks, consider using multiple Claude instances:

### Parallel Feature Development

Use git worktrees for independent features:

```bash
# Create worktrees
git worktree add ../finance-mcp-feature-a feature-a
git worktree add ../finance-mcp-feature-b feature-b

# Open separate terminals
cd ../finance-mcp-feature-a && claude  # Tab 1
cd ../finance-mcp-feature-b && claude  # Tab 2

# Clean up when done
git worktree remove ../finance-mcp-feature-a
```

### Code + Review Pattern

1. **Claude 1**: Implement feature
2. **Claude 2**: Review implementation (fresh context)
3. **Claude 3**: Apply feedback from review

This separation often yields better results than single-context iteration.
```

---

## Low-Priority / Future Improvements

### 8. Headless Mode Automation

**Potential use cases:**
- **Issue triage**: Label new GitHub issues automatically
- **Lint runner**: Pre-commit hook for subjective code review
- **Migration validator**: Check new migrations follow conventions
- **Documentation sync**: Ensure CLAUDE.md stays current after changes

**Example CI workflow** (`.github/workflows/claude-review.yml`):
```yaml
name: Claude Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          npx claude -p "Review this PR for code quality issues beyond what linters catch. Check for typos, misleading names, stale comments." \
            --output-format stream-json \
            --dangerously-skip-permissions
```

---

## Implementation Priority

**Week 1:**
1. ✅ Create custom slash commands (highest ROI)
2. ✅ Optimize CLAUDE.md structure
3. ✅ Expand tool allowlist

**Week 2:**
4. ✅ Create shared MCP configuration
5. ✅ Add testing workflow docs

**Week 3:**
6. ✅ Add visual feedback docs
7. ✅ Document multi-Claude workflows

**Future:**
8. ⏳ Headless automation (evaluate after team grows)

---

## Metrics for Success

Track these to measure improvement:

- **Time to onboard new contributors** (target: <30 min)
- **Successful first-attempt implementations** (target: >70%)
- **Permission prompts per session** (target: <5)
- **Documentation questions from team** (target: declining trend)

---

## Next Steps

1. Review this plan with the team
2. Create GitHub issues for high-priority items
3. Implement custom slash commands first (biggest immediate impact)
4. Iterate on CLAUDE.md based on usage patterns
5. Revisit this plan quarterly to assess progress
