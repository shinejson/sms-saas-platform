# Session management: login check, inactivity logout, sign-out

## The problem this solves

Opening `http://localhost:3000/dashboard` after weeks away went **straight into
the dashboard**. The page only checked that a `sms_token` key existed in
localStorage:

```ts
const savedToken = localStorage.getItem('sms_token');
if (!savedToken) window.location.href = '/';   // the entire "auth check"
```

The token itself was months old and every API call behind the UI quietly
returned `401`, so the user saw an empty shell of a dashboard instead of the
login screen. Nothing tracked when the user was last active either, so a
session only ended when the 8-hour JWT expired - a browser left open on a
shared school computer stayed logged in all day.

## The model now

| Rule | Value (default) | Enforced by |
| --- | --- | --- |
| Inactivity timeout | `NEXT_PUBLIC_SESSION_IDLE_MINUTES` = 30 min | Access-token lifetime **and** the browser guard |
| Absolute session cap | `NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS` = 12 h | `sst` claim, checked on every request |
| Warning before logout | `NEXT_PUBLIC_SESSION_WARNING_SECONDS` = 60 s | `SessionTimeoutDialog` |
| Session validity | signature + expiry + account/tenant status | `GET /api/auth/session` |

The access token is minted with a lifetime **equal to the inactivity window**
and is slid forward (`POST /api/auth/refresh`) only while the user is actually
doing something. That is what makes "last activity" a real security boundary:
an abandoned tab stops being able to call the API after 30 minutes, whether or
not the UI co-operates. The `sst` (session start) claim is copied across every
rotation, so staying active can never push a session past the 12-hour cap.

## Moving parts

| File | Role |
| --- | --- |
| `src/lib/session.ts` | Policy constants, JWT claim decoding, localStorage session store, `evaluateStoredSession()` |
| `src/lib/auth.ts` | `generateToken` (idle-length TTL + `sst`), `rotateSessionToken`, `getBearerToken` |
| `src/lib/session-server.ts` | `authenticateRequest()` - signature, expiry, absolute cap, user/tenant status |
| `src/app/api/auth/session/route.ts` | `GET` - "is this session still valid?" (called on every protected page load) |
| `src/app/api/auth/refresh/route.ts` | `POST` - slides the inactivity window for an active user |
| `src/app/api/auth/logout/route.ts` | `POST` - writes the `Logout` audit entry with the reason |
| `src/hooks/useSessionGuard.ts` | The browser guard: verification, activity tracking, countdown, rotation, cross-tab sync, 401 interception |
| `src/components/SessionTimeoutDialog.tsx` | "Still there?" countdown dialog |
| `src/components/SessionCheckingScreen.tsx` | Blocks rendering until the session is verified |

## What happens on a protected page

1. **Local pre-flight** (`evaluateStoredSession`) - is there a token, is it
   structurally valid, is it inside its expiry, and was the user active within
   the inactivity window? Sessions that fail never render the page.
2. **Server verification** (`GET /api/auth/session`) - the token signature is
   re-checked, and the user and school must still be active. A deleted or
   suspended account is signed out even though its JWT is still "valid".
3. **Activity tracking** - pointer, keyboard, scroll and touch events update
   `sms_last_activity` (throttled to one write per 15 s, and shared across tabs
   through the `storage` event).
4. **Countdown** - a 1-second ticker compares `lastActivity + idleWindow`,
   token expiry and the absolute cap. 60 seconds before the earliest of them,
   the "Still there?" dialog appears. Passive mouse movement does **not**
   dismiss it - a deliberate action does.
5. **Rotation** - once the token is more than half spent *and* the user has
   been active recently, `POST /api/auth/refresh` issues a fresh token.
6. **Sign-out** - storage is cleared, `POST /api/auth/logout` records the
   reason in the audit log, and the user lands on `/?session=<reason>&next=…`
   where a banner explains what happened and the original destination is
   restored after signing in.

Any `401` from an `/api/*` route also ends the session immediately: the
dashboard can no longer sit there silently failing every request.

## Reasons shown to the user

| Reason | Message |
| --- | --- |
| `inactivity` | "You were signed out after 30 minutes of inactivity. Please sign in again." |
| `expired` | "Your session has expired. Please sign in again." |
| `invalid` | "Your session is no longer valid. Please sign in again." |
| `suspended` | "This account is suspended or deactivated. Contact your administrator." |
| `forbidden` | "You do not have access to that area…" (e.g. a non Super Admin on `/admin`) |
| `other-tab` | "You were signed out in another tab." |

## Audit trail

`Login` and `Logout` events are written to `AuditLog` (`entity = 'Session'`)
with the IP address and, for logouts, the reason - so an inactivity timeout can
be told apart from a deliberate sign-out when reviewing an account.

## Testing it by hand

* **Expired session** - sign in, then in DevTools run
  `localStorage.setItem('sms_last_activity', Date.now() - 31 * 60_000)` and
  reload `/dashboard`: you are redirected to the login screen with the
  inactivity banner.
* **Idle countdown** - sign in and leave the tab alone for 29 minutes; the
  "Still there?" dialog appears with a 60-second countdown.
* **Stale token** - paste an old token into `localStorage.sms_token` and open
  `/dashboard`: the page never renders, you land on the login screen.
* **Cross-tab** - sign out in one tab; other open tabs follow within a second.

Shorten `NEXT_PUBLIC_SESSION_IDLE_MINUTES` (e.g. to `1`) while testing.
