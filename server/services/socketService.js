const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: true, // In production, replace with specific frontend URL
            credentials: true
        }
    });

    // Authentication Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            console.warn('[SOCKET-AUTH] REJECTED: No token provided');
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            console.log(`[SOCKET-AUTH] GRANTED: User ${decoded.userId}`);
            next();
        } catch (err) {
            console.error('[SOCKET-AUTH] REJECTED: Invalid token', err.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`[SOCKET] User connected: ${userId} (SocketID: ${socket.id})`);

        // Join a private room for this user
        socket.join(`user_${userId}`);

        socket.on('disconnect', () => {
            console.log(`[SOCKET] User disconnected: ${userId} (SocketID: ${socket.id})`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized!');
    }
    return io;
};

/**
 * Emit an event to a specific user
 * @param {string} userId - The target user's ID
 * @param {string} event - Event name
 * @param {any} data - Data to send
 */
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user_${userId}`).emit(event, data);
        console.log(`[SOCKET] Emitted ${event} to user_${userId}`);
    }
};

/**
 * Emit an event to a group of users by role
 * @param {string} role - The target role
 * @param {string} event - Event name
 * @param {any} data - Data to send
 */
// This would require tracking sockets by role, can be implemented if needed.
// For now, we mainly need targeted user notifications.

const broadcast = (event, data) => {
    if (io) {
        io.emit(event, data);
        console.log(`[SOCKET] Broadcasted ${event} to all clients`);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitToUser,
    broadcast
};
