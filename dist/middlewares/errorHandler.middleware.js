export const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.errorCode = err.errorCode || 'GL_500';
    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            success: false,
            code: err.errorCode,
            message: err.message,
            stack: err.stack,
            error: err,
        });
    }
    else {
        // Production mode
        if (err.isOperational) {
            res.status(err.statusCode).json({
                success: false,
                code: err.errorCode,
                message: err.message,
            });
        }
        else {
            // Programming or other unknown error: don't leak error details
            console.error('ERROR 💥', err);
            res.status(500).json({
                success: false,
                code: 'GL_500',
                message: 'Something went very wrong!',
            });
        }
    }
};
//# sourceMappingURL=errorHandler.middleware.js.map