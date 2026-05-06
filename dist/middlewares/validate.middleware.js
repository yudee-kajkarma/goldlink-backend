export const validateBody = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errorCode: 'GL_VAL_001',
            errors: parsed.error.flatten(),
        });
        return;
    }
    req.body = parsed.data;
    next();
};
//# sourceMappingURL=validate.middleware.js.map