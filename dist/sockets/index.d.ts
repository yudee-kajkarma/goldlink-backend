import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
export declare let io: Server;
export declare const initSocket: (httpServer: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
