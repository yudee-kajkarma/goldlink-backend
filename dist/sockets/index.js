import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import registerChatHandlers from './chat.socket.js';
export let io;
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
            methods: ['GET', 'POST'],
        },
    });
    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token || socket.handshake.headers?.token || socket.handshake.query?.token;
            if (typeof token === 'string') {
                token = token.replace(/^["']|["']$/g, '');
            }
            if (!token)
                return next(new Error('Authentication error: Token missing'));
            const decoded = jwt.verify(token, env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (!user || !user.isActive || !user.isApproved) {
                return next(new Error('Authentication error: Unauthorized'));
            }
            socket.user = user;
            next();
        }
        catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.user;
        console.log(`Socket connected: ${user.name} (${user.role})`);
        // Join personal room for personal notifications
        socket.join(`user:${user._id}`);
        registerChatHandlers(io, socket);
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${user._id}`);
        });
    });
    return io;
};
//# sourceMappingURL=index.js.map