const Notification = require("../models/notification.model");

/**
 * Get notifications for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15; // Default to 15 per page
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ recipient: userId })
            .populate("sender", "username name avatar") // Populate sender details
            // Optionally populate tweet details if needed, but can be large
            // .populate("tweet", "content")
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean for performance

        const total = await Notification.countDocuments({ recipient: userId });
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            read: false,
        });

        res.status(200).json({
            status: "success",
            data: {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    unreadCount, // Include unread count
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a specific notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { id } = req.params; // Notification ID

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: userId, read: false }, // Ensure user owns it and it's unread
            { read: true },
            { new: true } // Return the updated document (optional)
        );

        if (!notification) {
            // Either not found, user doesn't own it, or already read
            // Still return success, maybe with a specific message or status if needed
            return res.status(200).json({
                status: "success",
                message: "Notification not found or already marked as read.",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Notification marked as read.",
            data: { notification }, // Optionally return updated notification
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all notifications for the user as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const markAllNotificationsRead = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const result = await Notification.updateMany(
            { recipient: userId, read: false }, // Find all unread for the user
            { read: true } // Set read to true
        );

        res.status(200).json({
            status: "success",
            message: `Marked ${result.modifiedCount} notifications as read.`,
            data: { modifiedCount: result.modifiedCount },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
};
