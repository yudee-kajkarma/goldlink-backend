import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import registerChatHandlers from './chat.socket.js';
import { JWT_SECRET } from '../config/jwt.js';

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

      const decoded: any = jwt.verify(token, JWT_SECRET);
      // #region agent log
      fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H2',location:'sockets/index.ts:33',message:'socket token verification path',data:{hasJwtSecret:Boolean(process.env.JWT_SECRET),hasToken:Boolean(token)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
