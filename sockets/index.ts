import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import registerChatHandlers from './chat.socket.js';

export let io: Server;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // You can restrict this in production
      methods: ['GET', 'POST'],
    },
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.token || socket.handshake.query?.token;
      
      // Handle cases where token might be sent with quotes from Postman
      if (typeof token === 'string') {
        token = token.replace(/^["']|["']$/g, '');
      }

      console.log(`Connection attempt with token: ${token ? 'Token Present' : 'Token Missing'}`);
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
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
