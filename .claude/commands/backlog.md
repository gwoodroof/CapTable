# /backlog — Work through the project backlog

Read [Backlog.md](../../Backlog.md) and tackle items based on the arguments provided:

| Arguments | Scope |
|---|---|
| `feature next` | First unchecked item in **FEATURES & ENHANCEMENTS** . Ask me any clarifying questions as necessary and one by one |
| `feature all` | All unchecked items in **FEATURES & ENHANCEMENTS**, in order |
| `bug next` | First unchecked item in **KNOWN BUGS** |
| `bug all` | All unchecked items in **KNOWN BUGS**, in order |
| `next` | First unchecked item in both sections — bugs first, then features. Ask me any clarifying questions as necessary and one by one |
| `all` | All unchecked items in both sections — bugs first, then features, one at a time |

## How to work each item

For every item, follow this sequence in full before moving to the next:

1. **Identify** the target item(s) per the arguments above.
2. **Plan** — state what you will implement in one short paragraph before writing any code.
3. **Implement** the feature or fix. Keep changes minimal and scoped to the item as described.
4. **Update tests** — add or update unit, integration, and/or E2E tests as appropriate.
5. **Update `specs/001-cap-table-saas/spec.md`** — reflect the new behavior; assign the next available story number for anything new.
6. **Mark complete in `Backlog.md`** — change `- [ ]` to `- [x]`, append a one-sentence implementation note, then move the entire entry to the **top** of the `# FRONTLOG` section. For BUGS, add 'BUG: ' to the beginning of the description. 
7. For `all` variants, repeat steps 2–6 for each subsequent item **one at a time**.

## Rules

- Work items in the order they appear in `Backlog.md`. Never skip or reorder.
- Finish and frontlog each item before starting the next.
- If an item is ambiguous, ask one clarifying question before starting work.
- Keep `FRONTLOG` in reverse-chronological order (most recently completed at the top).

Arguments: $ARGUMENTS
