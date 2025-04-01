require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { createServer } = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const tweetRoutes = require("./routes/tweet.routes");
const uploadRoutes = require("./routes/upload.routes");
const searchRoutes = require("./routes/search.routes");
const trendsRoutes = require("./routes/trends.routes");

// Create Express app
const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// Middleware
app.use(helmet());
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    })
);
// Use 'combined' format in production, 'dev' otherwise
app.use(
    process.env.NODE_ENV === "production" ? morgan("combined") : morgan("dev")
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate limiting can be added here

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tweets", tweetRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/trends", trendsRoutes);

// Socket.io connection handling
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err); // Log the full error object

    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production" && statusCode === 500
            ? "Internal Server Error"
            : err.message || "An unexpected error occurred";

    res.status(statusCode).json({
        status: "error",
        message: message,
        // Include validation errors if present
        ...(err.data && { errors: err.data }),
        // Optionally include stack trace in development only
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
});

// --- Export app and server instances BEFORE starting the server ---
module.exports = { app, httpServer, io };

// --- Function to start the server (DB connection + listen) ---
const startServer = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(
            process.env.MONGODB_URI || "mongodb://localhost:27017/twitter-clone"
        );
        console.log("Connected to MongoDB");

        // Start server
        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};

// --- Start the server only if this file is run directly ---
if (require.main === module) {
    startServer();

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
        console.error("Unhandled Rejection:", err);
        // Close server & exit process
        if (httpServer && httpServer.listening) {
            httpServer.close(() => process.exit(1));
        } else {
            process.exit(1);
        }
    });
}
