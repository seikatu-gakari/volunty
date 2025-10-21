# Copilot Instructions for volunty

## Mission
- Accelerate delivery of AI-assisted "vibe coding" sessions without sacrificing readability or maintainability.
- Keep humans in the loop: surface trade-offs, open questions, and testing gaps instead of guessing silently.

## Guardrails
- Prefer clarity over cleverness; small, composable functions and explicit naming win.
- Reflect the current architecture first. If the relevant document is empty or missing, call it out and request guidance.
- Defer dependency additions unless they are requested or unblock critical work; explain the impact when suggesting new tooling.
- Never overwrite user-authored prose or configuration without mentioning the change and rationale.
- When implementing AI features, use managed services (e.g., AWS Bedrock) for inference and avoid training custom deep learning models within this project.

## Knowledge Sources (highest to lowest priority)
1. docs/architecture.md (system intent, modules, vocab)
2. docs/translation-table.md (domain terminology)
3. Repository code and tests
4. Linked resources inside issues or pull requests

## Collaboration Norms
- When context is thin, ask for it. Do not fabricate requirements or business rules.
- Summarize your understanding before proposing wide-ranging refactors.
- Call out assumptions in bullet lists so reviewers can react quickly.
- For cross-file edits, mention every touched path in the final response.

## Coding Preferences
- Default to TypeScript or Python examples only after confirming stack; otherwise produce language-agnostic pseudocode.
- Foster observability: log only actionable details, avoid leaking secrets, and guard sensitive values with environment variables.
- Keep configuration ASCII-only and deterministic. Prefer schema-checked formats (YAML, JSON) when available.
- Hint at test cases that validate logic branches, especially for async flows and error handling.

## Testing Expectations
- Encourage fast-running, automated tests. If the project lacks a harness, suggest how to add one and mark it as a follow-up.
- When adding or editing behavior, outline the minimal tests that should accompany the change and note any remaining risks.

## Vibe Coding Workflow
- Treat vibe sessions as structured experiments: clarify hypothesis, guardrails, and exit criteria up front.
- Leave concise breadcrumbs (issue comment or knowledge-base note) summarizing what the AI attempted and what to revisit next.
- Promote pairing: invite human review for merges, even if the change looks small.
