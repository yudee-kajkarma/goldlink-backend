import { Server, Socket } from 'socket.io';
import Order from '../models/order.model.js';
import { Message } from '../models/message.model.js';
import { sendNotification } from '../services/notification.service.js';

export default function registerChatHandlers(io: Server, socket: Socket) {
  const user = (socket as any).user;

  // Super Logger: Logs every event received
  socket.onAny((eventName, ...args) => {
    console.log(`[SOCKET EVENT] ${eventName}:`, JSON.stringify(args));
  });

  // Ping test
  socket.on('ping', () => {
    socket.emit('pong', { message: 'Connection is alive!', time: new Date() });
  });

  // Helper to validate order access
  const validateOrderAccess = async (orderId: string) => {
    try {
      if (!orderId) throw new Error('orderId is undefined in validateOrderAccess');
      const order = await Order.findById(orderId.trim());
      if (!order) {
        console.error(`DEBUG: Order ${orderId} not found in database.`);
        throw new Error(`Order ${orderId} not found`);
      }

      const userId = user._id.toString();
      const createdBy = order.createdBy.toString();
      const assignedTo = order.assignedTo.toString();

      if (userId !== createdBy && userId !== assignedTo) {
        console.error(`DEBUG AUTH FAILURE: User ${userId} is not Staff(${createdBy}) or Karigar(${assignedTo})`);
        throw new Error('Unauthorized to access this order chat');
      }

      return order;
    } catch (error: any) {
      console.error(`ERROR in validateOrderAccess: ${error.message}`);
      throw error;
    }
  };

  // Join Order Room
  socket.on('join_order', async (payload, callback) => {
    try {
      console.log('--- join_order raw payload ---', payload);
      // Aggressive parsing
      let data = payload;
      if (typeof payload === 'string') data = JSON.parse(payload);
      if (Array.isArray(payload)) data = payload[0]; // Postman sometimes sends as array
      
      const { orderId } = data;
      if (!orderId) throw new Error('DEBUG: orderId is required in payload');

      console.log(`DEBUG: Attempting to join room ${orderId} for user ${user._id}`);
      await validateOrderAccess(orderId);
      
      await socket.join(orderId.toString().trim());
      console.log(`DEBUG: User ${user._id} (${user.role}) successfully joined room: ${orderId}`);
      
      // Verification
      const clients = await io.in(orderId).fetchSockets();
      console.log(`DEBUG: Verification - users in room ${orderId}: ${clients.length}`);

      if (typeof callback === 'function') callback({ success: true, roomSize: clients.length });
      socket.emit('chat_debug', { message: 'Joined room successfully', roomSize: clients.length, orderId });
    } catch (error: any) {
      console.error(`DEBUG JOIN ERROR: ${error.message}`);
      socket.emit('chat_error', { message: error.message });
      if (typeof callback === 'function') callback({ success: false, error: error.message });
    }
  });

  // Send Message
  socket.on('send_message', async (payload, callback) => {
    try {
      console.log('--- send_message raw payload ---', payload);
      // Aggressive parsing
      let data = payload;
      if (typeof payload === 'string') data = JSON.parse(payload);
      if (Array.isArray(payload)) data = payload[0];

      const { orderId, content, messageType = 'text', mediaUrl, duration } = data;
      if (!orderId) throw new Error('DEBUG: orderId is required');

      if (messageType === 'text' && !content) {
        throw new Error('DEBUG: content is required for text messages');
      }

      if (['image', 'video', 'voice'].includes(messageType) && !mediaUrl) {
        throw new Error(`DEBUG: mediaUrl is required for ${messageType} messages`);
      }

      const order = await validateOrderAccess(orderId);

      const newMessage = await Message.create({
        orderId,
        senderId: user._id,
        messageType,
        content: content || '',
        mediaUrl,
        duration
      });

      const clients = await io.in(orderId).fetchSockets();
      console.log(`DEBUG: Broadcasting message to ${clients.length} users in room ${orderId}`);
      
      // Broadcast to room
      io.to(orderId).emit('receive_message', newMessage);
      console.log('DEBUG: Message emitted to room');

      if (typeof callback === 'function') callback({ success: true, message: newMessage });

      // Send notification to the other participant
      const userIdStr = user._id.toString();
      const recipientId = userIdStr === order.createdBy.toString() ? order.assignedTo : order.createdBy;
      
      sendNotification(recipientId.toString(), 'New Message', content);

    } catch (error: any) {
      console.error(`DEBUG SEND ERROR: ${error.message}`);
      socket.emit('chat_error', { message: error.message });
      if (typeof callback === 'function') callback({ success: false, error: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', async (payload) => {
    try {
      const { orderId } = payload;
      if (!orderId) return;

      await validateOrderAccess(orderId);
      socket.to(orderId).emit('typing', { userId: user._id });
    } catch (error) {
      // Silently fail for typing events
    }
  });

  // Message read
  socket.on('message_read', async (payload, callback) => {
    try {
      const { messageId } = payload;
      if (!messageId) throw new Error('messageId is required');

      const message = await Message.findById(messageId);
      if (!message) throw new Error('Message not found');

      const orderIdStr = message.orderId.toString();
      await validateOrderAccess(orderIdStr);

      message.isRead = true;
      await message.save();

      io.to(orderIdStr).emit('message_read', { messageId });
      
      if (typeof callback === 'function') callback({ success: true });
    } catch (error: any) {
      if (typeof callback === 'function') callback({ success: false, error: error.message });
    }
  });
}
