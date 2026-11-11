# API layer

The UI only talks to `src/api/index.ts`, which exposes typed async endpoints (`leadsApi`, `tasksApi`,
`campaignsApi`, `firmApi`, `integrationsApi`, `eventsApi`, `configApi`) plus the `useQuery` hook.

Until the backend is ready those endpoints run against an in-memory mock:

| File | Role |
| --- | --- |
| `types.ts` | Data contracts the backend should return |
| `mockData.ts` | Seed data and static config (stages, sources, owners, form options) |
| `mockServer.ts` | In-memory tables and business rules (stage moves, automations, campaign sends) |
| `index.ts` | The endpoint functions the UI calls |

## Connecting the real backend

Replace the body of each function in `index.ts` with a `fetch()` call that returns the same type. Nothing else
in the UI changes. Delete `mockServer.ts` and `mockData.ts` when done. `useQuery` re-runs every query after any
mutation; with a real backend swap its subscription for your own cache (React Query, SWR) or call `store.commit()`
equivalents after mutations.

`index.ts` also imports `toast` for a few mock-only side effects (a real backend would not toast; the UI would).
