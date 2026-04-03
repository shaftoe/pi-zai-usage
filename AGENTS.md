# Development Guidelines for AI Agents

This file contains important rules and guidelines for AI agents working on this project. Follow these strictly to prevent regressions.

## Code Quality and Testing Requirements

### Rule: Always Run Tests and Checks Before Completing Changes

Before considering any change complete, **you MUST** run both of the following commands:

```bash
bun run test
bun run check
```

- `bun run test`: Runs all unit tests to ensure functionality is not broken
- `bun run check`: Runs both `bun run typecheck` (TypeScript type checking) and `bun run lint` (ESLint)

**Both commands must pass with zero failures and zero errors before a change can be considered complete.**

If either command fails:
1. Fix all reported issues
2. Re-run both commands to verify the fixes
3. Only then consider the change complete

This prevents regressions and ensures code quality standards are maintained.

## Date/Time Handling

### Rule: Use Temporal ONLY - No Date API

**DO NOT use:** `Date.now()`, `new Date()`, `Date.parse()`, or any native `Date` API.

**ALWAYS use:** `temporal-polyfill` (`Temporal` namespace)

## Provider name

The official name of the AI provider at [Z.ai](https://z.ai) is **Z.ai**. The dot in the name is part of the company's branding, and it is not referred to as "zAi," "z.ai," or "zai" without the dot in official contexts. The company was formerly known as Zhipu AI (or ZhipuAI) and rebranded to Z.ai in mid-2025 for easier recognition and pronunciation.
