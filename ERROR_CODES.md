# Error Codes (GoldLink Backend)

All API error responses use the **`GL_*`** scheme (no legacy `GL101` / `GL201` style codes).

## Codes

| Code | Meaning |
|------|---------|
| `GL_SRV_001` | Unexpected internal server error (no raw exception text to clients). |
| `GL_VAL_001` | Request/body validation failed (Zod, business validation). |
| `GL_VAL_002` | Media/upload validation (missing file, key, etc.). |
| `GL_AUTH_001` | Authentication or authorization failure. |
| `GL_NOT_FOUND_001` | User or generic resource not found. |
| `GL_NOT_FOUND_002` | Order not found. |
| `GL_DB_001` | MongoDB not connected yet (`requireMongoReady`, `GET /readyz` while warming up). |
| `GL_RL_001` | Rate limit exceeded (`429 Too many requests`). |

When adding new errors, extend this table with the next `GL_*` suffix in the same category.

## Operational JSON (non-error)

- `GET /healthz` — `{ "success": true, "status": "ok" }`
- `GET /readyz` — success: `{ "success": true, "status": "ok" }`; DB not ready: `{ "success": false, "status": "not_ready", "message": "...", "errorCode": "GL_DB_001" }` (HTTP 503)
