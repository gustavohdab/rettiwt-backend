const express = require("express");
const { protect } = require("../middleware/auth.middleware"); // Assuming auth middleware exists
const {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} = require("../controllers/notification.controller");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/v1/notifications
router.get("/", getNotifications);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", markNotificationRead);

// POST /api/v1/notifications/read-all (Using POST for action, could also be PATCH)
router.post("/read-all", markAllNotificationsRead);

module.exports = router;
