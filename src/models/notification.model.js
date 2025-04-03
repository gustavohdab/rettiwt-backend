const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        // User who receives the notification
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // User who triggered the notification (optional, e.g., for system messages)
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // Type of notification
        type: {
            type: String,
            required: true,
            enum: ["like", "reply", "follow", "mention", "retweet", "quote"], // Add more types as needed
        },
        // Optional reference to the related tweet
        tweet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tweet",
        },
        // Optional snippet of the related tweet content
        tweetSnippet: {
            type: String,
            maxlength: 100, // Keep snippets relatively short
            trim: true,
        },
        // Read status
        read: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 }); // For fetching user notifications, sorted
notificationSchema.index({ recipient: 1, read: 1 }); // For counting unread

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
