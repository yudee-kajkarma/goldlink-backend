import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import registerChatHandlers from './chat.socket.js';
import { JWT_SECRET } from '../config/jwt.js';
import { getCorsOrigin } from '../config/cors.js';

export let io: Server;

export const initializeSocket = (httpServer: HttpServer) => {
  const corsOrigin = getCorsOrigin();
  io = new Server(httpServer, {
    cors: {
      // Align with Express: boolean true reflects the request Origin; avoids wildcard with credentials.
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const bearer =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : undefined;

      let token =
        socket.handshake.auth?.token ||
        bearer ||
        (typeof socket.handshake.headers?.token === 'string' ? socket.handshake.headers.token : undefined) ||
        socket.handshake.query?.token;
      
      // Handle cases where token might be sent with quotes from Postman
      if (typeof token === 'string') {
        token = token.replace(/^["']|["']$/g, '');
      }

      console.log(`Connection attempt with token: ${token ? 'Token Present' : 'Token Missing'}`);
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.isActive || !user.isApproved) {
        return next(new Error('Authentication error: Account is not active'));
      }

      // Attach user to socket
      (socket as any).user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${(socket as any).user._id}`);

    // Register Chat Event Handlers
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${(socket as any).user._id}`);
    });
  });

  return io;
};
