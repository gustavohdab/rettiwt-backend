const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const createDestination = (dest) => {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    return dest;
};

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;

        // Determine upload path based on file type
        if (req.uploadType === "avatar") {
            uploadPath = createDestination("./uploads/avatars");
        } else if (req.uploadType === "header") {
            uploadPath = createDestination("./uploads/headers");
        } else {
            // Default to tweet media
            uploadPath = createDestination("./uploads/tweets");
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: userId_timestamp_originalname
        const userId = req.user._id;
        const filename = `${userId}_${Date.now()}${path.extname(
            file.originalname
        )}`;
        cb(null, filename);
    },
});

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
    // Accept images and videos
    if (
        file.mimetype.startsWith("image/") ||
        file.mimetype.startsWith("video/")
    ) {
        cb(null, true);
    } else {
        cb(new Error("Only images and videos are allowed"), false);
    }
};

// Create different upload middlewares based on context
const upload = {
    // For tweet uploads (multiple files)
    tweetMedia: (req, res, next) => {
        req.uploadType = "tweet";
        return multer({
            storage,
            fileFilter,
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        }).array("media", 4)(req, res, next); // Max 4 files
    },

    // For avatar uploads (single file)
    avatar: (req, res, next) => {
        req.uploadType = "avatar";
        return multer({
            storage,
            fileFilter: (req, file, cb) => {
                // Only accept images for avatars
                if (file.mimetype.startsWith("image/")) {
                    cb(null, true);
                } else {
                    cb(new Error("Only images are allowed for avatars"), false);
                }
            },
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
        }).single("avatar")(req, res, next);
    },

    // For header/banner uploads (single file)
    header: (req, res, next) => {
        req.uploadType = "header";
        return multer({
            storage,
            fileFilter: (req, file, cb) => {
                // Only accept images for headers
                if (file.mimetype.startsWith("image/")) {
                    cb(null, true);
                } else {
                    cb(new Error("Only images are allowed for headers"), false);
                }
            },
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        }).single("header")(req, res, next);
    },
};

module.exports = upload;
