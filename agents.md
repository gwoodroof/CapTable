# Agent Context: CapTable Management SaaS

This file provides the authoritative context for AI agents working in this repository. Read it before making any changes. The [constitution](.specify/memory/constitution.md) supersedes this file on principles; this file covers architecture, conventions, and current state.

---

## Testing Standards

- Unit and integration test coverage should be maintained at 100%. This means that new features should be accompanied by updated tests. 
- Attempt to fix any test or type errors until the whole suite is green. 

---

## What Agents Must Not Do

- **Never** do a git commit or git push without being explicitly asked to do so. 

---

## Spec-Driven Development

We utilize spec-driven development (SDD). 

- When implementing a new or updated feature, if the specs, or plan, or constitution should be changed, propose the change to the developer with options for Yes (update specs), No (skip), or Other.