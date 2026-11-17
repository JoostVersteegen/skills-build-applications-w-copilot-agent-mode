# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Keep the UI thin and deterministic by consuming the shared API client in `octofit-tracker/frontend/src`, rendering loading/empty/error/success states per route, and avoiding direct fetch logic in components.
- Logic tier decision: Use Express routes/services to validate input, map invalid IDs to 4xx responses, and aggregate activity/team/workout rules in one place instead of pushing business logic into the frontend.
- Data tier decision: Treat MongoDB/Mongoose as the source of truth for schema-level invariants and seed fixtures; enforce required fields and relationships in the schemas so the API can rely on valid records.
- Activity tracking approach: Accept `userId`, `teamId`, `type`, and `minutes`, validate both IDs against existing records, and persist `user`, `team`, `type`, `minutes`, plus computed `points` and `occurredAt` without exposing cast errors as 500s.
- Team management approach: Require `name` at creation time, preserve `mascot`, and expose members as a populated reference array while keeping the route contract strict on invalid input.
- Leaderboard approach: Aggregate team activity points by summing each team’s activities, sort descending by total points, and assign a 1-based rank in the final response.
- Workout suggestions approach: Match the requested user email to a seeded user, inspect recent activity patterns or fitness goal, and return a first suggestion whose `focus` aligns with that pattern and includes an explanatory `reason`.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`  
  Failing here means the Mongoose schemas and seed data do not yet enforce the required contract for users, teams, activities, and workout suggestions. The current red baseline shows missing validation on required model fields.
- API command: `npm run test:api --prefix octofit-tracker/backend`  
  Failing here means the Express logic is not honoring the contract: invalid payloads should return deliberate 4xxs, the leaderboard should aggregate team totals, and workout suggestions should match a seeded user’s pattern.
- Frontend command: `npm test --prefix octofit-tracker/frontend`  
  Failing here means the presentation layer is not yet rendering the expected activity, team, leaderboard, and suggestion UI states from the API contract.
- Backend build command: `npm run build --prefix octofit-tracker/backend`  
  Use this to catch TypeScript and runtime-setup issues after the data/API layers are corrected.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`  
  Use this to confirm the Vite app still builds once the UI contract is implemented and the shared API client is correctly used.
