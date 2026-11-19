# AUTH-RATE-1 — Login rate limit does not hold in production

**Type:** Bug / security  
**Priority:** High  
**Labels:** api, auth, login, redis, nginx

## Summary

`POST /api/data/login` is limited to 5 requests per minute per IP, stored in process memory. Behind the frontend nginx that limit is one shared bucket for every user, it resets on restart, and a few failed attempts from one shop Wi-Fi lock the whole shop.

## Current behavior

Limiter: `services/api-store-platform/src/middleware/rateLimiter.ts` (`loginRateLimiter`).  
Wired only on login: `services/api-store-platform/src/apis/api.routes.ts` (`POST .../login`).

- Window: 60 seconds. Max: 5. Key: `req.ip` via `ipKeyGenerator`.
- Store: `express-rate-limit` memory store. The file already notes this is per process.
- Over the limit: HTTP 429, `errorCode: TOO_MANY_REQUESTS`, message hardcodes “after 1 minute.”
- Successful logins count. `skipSuccessfulRequests` is not set.
- `app.ts` never sets `trust proxy`. `web/store-platform-frontend/nginx.conf` proxies `/api/data/` and sets `X-Forwarded-For` / `X-Real-IP`. Express therefore sees the nginx address as `req.ip`, so every browser shares one counter.
- `rate-limit-redis` and `ioredis` are dependencies and unused. The live Redis client is `redis` (node-redis) inside `redisCache`, and only when `REDIS_ENABLED=true`.
- `POST .../refresh` has a comment `// refreshRateLimiter`. That middleware does not exist. The web app calls refresh about every 14 minutes per logged-in tab (`useSilentRefresh.ts`).
- Login UI already maps status 429 to `login.tooManyAttempts`.

## Expected

1. **Client IP, not the proxy.** Trust only the nginx hop already in front of the API (`trust proxy` set to that hop count, not `true`). The limiter key must be the browser address nginx forwards. A client must not be able to pick a fresh bucket by sending its own `X-Forwarded-For`.

2. **Two counters, not one IP bucket.**
   - Per browser IP: **30 attempts / 15 minutes** (all outcomes). Stops one address trying many emails.
   - Per normalized email (trim + lowercase): **5 failed attempts / 15 minutes**. Count failures only (`skipSuccessfulRequests: true`). Stops guessing one account from many addresses, and one cashier’s typos no longer lock everyone else on the shop network.

3. **Shared store when Redis is on.** Use the already-installed `rate-limit-redis` with the existing node-redis client (`sendCommand` on the `redisCache` connection). Do not open a second connection with `ioredis`. When Redis is disabled or errors, keep the in-memory store and allow the login (do not fail closed and block every login). Log that the limit is per process. Production with Redis on must keep one counter across restarts and processes.

4. **429 stays the same contract.** Status 429, `errorCode: TOO_MANY_REQUESTS`, `standardHeaders: true` (`RateLimit-*` and `Retry-After`). The message must describe the 15-minute window, not “1 minute.” The login page can keep the existing `login.tooManyAttempts` string if that copy matches the new window; update the string if it still says one minute.

## How to implement

- `rateLimiter.ts`: two limiters, both applied on `POST .../login` (IP first, then email). Email key from the login body; missing/invalid email falls back to the IP key so the route still limits.
- `redisCache`: expose the connected client’s `sendCommand` (the client is private today). Build the Redis store only after Redis is enabled and connected.
- `app.ts`: `trust proxy` for the one nginx hop. Do not trust an arbitrary chain.
- One small API test: 6th failed login for the same email inside the window returns 429; a different email on the same IP still reaches the handler; the 31st attempt from one IP returns 429. In-memory store is enough for the test (Redis off).

## Acceptance

- [ ] Two users on one public IP can each fail login 4 times in 15 minutes and the 5th user on that IP can still log in.
- [ ] The 6th failed attempt for the same email in 15 minutes returns 429 with `TOO_MANY_REQUESTS`, even from a new IP.
- [ ] A successful login does not consume that email’s failure budget.
- [ ] The 31st login attempt from one browser IP in 15 minutes returns 429 even when each attempt uses a different email.
- [ ] With the app behind `nginx.conf`, the key is the browser IP. Spoofing `X-Forwarded-For` from the browser does not create a new bucket.
- [ ] With Redis enabled, restarting the API does not reset the counters.
- [ ] With Redis disabled, login still works and the limit stays in memory for that process.
- [ ] `POST /refresh` is unchanged. The commented refresh limiter stays off.

## Out of scope

- A limiter on `/refresh`. Copying the login numbers there would log people out: silent refresh runs every 14 minutes per tab, and it is broken until `trust proxy` is correct. Separate ticket after this one.
- Global API rate limit, password change, logout.
- RIVO chat quota (`report-ai.md`, RA-BUG-6).
- Password-reset flow (`reset-pass.md`).
