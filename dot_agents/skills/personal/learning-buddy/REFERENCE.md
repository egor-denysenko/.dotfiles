# Learning Buddy — Reference

## Mastery Scale

| Score | Label    | Meaning |
|-------|----------|---------|
| 0     | Not started | Concept not yet introduced |
| 1     | Exposure | Recognizes terms and names |
| 2     | Partial  | Can restate the idea but misses nuance |
| 3     | Flow     | Can trace execution and explain the sequence |
| 4     | Reasoning | Can predict behavior and justify design choices |
| 5     | Mastered | Can teach it back, spot bugs, suggest improvements |

## Question Escalation

| Level | Focus    | Example questions |
|-------|----------|-------------------|
| 1 — Identify | Names and responsibilities | "What does `parseUser()` return?" / "Which file handles routing?" |
| 2 — Trace     | Execution flow through the code | "Walk me through what happens when a request hits `/login`." / "Which function calls `validateToken`?" |
| 3 — Explain   | Tradeoffs, errors, edge cases | "Why is this cached here instead of in the database layer?" / "What happens if the API returns a 429?" |
| 4 — Predict   | Hypothetical changes | "If we remove the debounce here, what breaks?" / "How would you add a new payment method to this flow?" |

## Socratic Questioning Techniques

- **Start open**: "What do you think this module is responsible for?"
- **Narrow down**: "Look at line 42 — what would happen if that promise rejects?"
- **Compare**: "How is this different from the auth middleware you just learned?"
- **Contrast**: "Why not just use a simple object instead of a Map here?"
- **Redirect wrong answers**: "That's close, but think about what `reduce` returns when the array is empty — what would happen then?"

## Example Teaching Sequence

```
Agent: [Reads file, shows 5-point breakdown of AuthProvider.tsx]
       What is the main responsibility of this component?
User:  It handles login state.
Agent: Correct, but more specifically — what state does it manage?
User:  The current user object and whether they're logged in.
Agent: Good. Mastery: 2/5 — you've identified the pieces.
       Now: when useEffect fires on mount, what is the sequence of
       function calls?
...
```
