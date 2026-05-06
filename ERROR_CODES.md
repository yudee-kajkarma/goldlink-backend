# Error Codes (GoldLink Backend)

This backend uses a mix of legacy `GL1xx` codes and newer `GL_*` codes.

## Standardized in this fix

- `GL_SRV_001`: Internal server error (never returns raw exception messages to clients).

## Existing patterns

- `GL_VAL` / `GL_VAL_00x`: Validation failures returned by request-body validation middleware (e.g., Zod/Zod-derived errors, multer size/type errors).
- `GL101`, `GL201`, `GL301`, `GL401`, etc.: Legacy application/auth/order error codes returned directly by controllers.

If you add new code, prefer:
1. `GL_SRV_001` for unexpected server failures.
2. `GL_VAL*` for input validation problems.

