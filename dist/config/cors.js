/**
 * Comma-separated origins in CORS_ORIGINS, or omit / use * for allow-all (Socket.IO may require explicit origins when using credentials).
 */
export function getCorsOrigin() {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw || raw === '*') {
        return true;
    }
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
        return true;
    }
    if (list.length === 1) {
        return list[0];
    }
    return list;
}
//# sourceMappingURL=cors.js.map