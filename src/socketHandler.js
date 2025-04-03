const jwt = require("jsonwebtoken");
const User = require("./models/user.model");

// Placeholder for storing connected users if needed (consider alternatives like Redis for scalability)
const connectedUsers = new Map(); // Map<userId, socketId>

const initializeSocketIO = (io) => {
    // Middleware for Socket.IO authentication
    io.use(async (socket, next) => {
        const token =
            socket.handshake.auth.token ||
            socket.handshake.headers.cookie
                ?.split("; ")
                .find((row) => row.startsWith("access_token="))
                ?.split("=")[1];

        if (!token) {
            console.error("Socket Auth Error: No token provided.");
            return next(new Error("Authentication error: No token provided."));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id)
                .select("_id username")
                .lean();

            if (!user) {
                console.error(
                    `Socket Auth Error: User not found for token user ID: ${decoded.id}`
                );
                return next(new Error("Authentication error: User not found."));
            }

            // Attach user info to the socket object for later use
            socket.user = user;
            console.log(
                `Socket authenticated for user: ${user.username} (ID: ${user._id})`
            );
            next();
        } catch (err) {
            console.error("Socket Auth Error:", err.message);
            return next(new Error("Authentication error: Invalid token."));
        }
    });

    io.on("connection", (socket) => {
        console.log(
            `User connected: ${socket.user.username} (Socket ID: ${socket.id})`
        );

        // Join a room specific to the user ID
        const userId = socket.user._id.toString();
        socket.join(userId);
        connectedUsers.set(userId, socket.id);
        console.log(`User ${socket.user.username} joined room: ${userId}`);

        // --- Example: Listening for a message from the client ---
        // socket.on('client:message', (data) => {
        //   console.log(`Message from ${socket.user.username}:`, data);
        //   // Example: Broadcast to the user's room
        //   // io.to(userId).emit('server:message', { text: `Server received: ${data.text}` });
        // });

        socket.on("disconnect", (reason) => {
            console.log(
                `User disconnected: ${socket.user.username} (Socket ID: ${socket.id}). Reason: ${reason}`
            );
            const disconnectedUserId = [...connectedUsers.entries()].find(
                ([_, socketId]) => socketId === socket.id
            )?.[0];
            if (disconnectedUserId) {
                connectedUsers.delete(disconnectedUserId);
                console.log(
                    `Removed user ${disconnectedUserId} from connected users map.`
                );
            }
            // No need to explicitly leave rooms, Socket.IO handles it on disconnect.
        });

        socket.on("error", (err) => {
            console.error(
                `Socket Error for user ${socket.user?.username || "UNKNOWN"}:`,
                err
            );
        });
    });

    console.log("Socket.IO initialized and connection listeners attached.");
};

// Function to get the io instance (useful for emitting events from controllers)
// This assumes you pass 'io' to this module somehow or make it a singleton.
// A better approach might be dependency injection or a dedicated service.
let ioInstance;
const setIoInstance = (io) => {
    ioInstance = io;
};
const getIoInstance = () => {
    if (!ioInstance) {
        throw new Error("Socket.IO instance has not been set.");
    }
    return ioInstance;
};

module.exports = {
    initializeSocketIO,
    setIoInstance,
    getIoInstance,
    connectedUsers,
};
