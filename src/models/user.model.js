const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Helper function to normalize Gmail addresses
const normalizeGmail = (email) => {
    if (!email) return email;
    const parts = email.split("@");
    if (parts.length === 2 && parts[1].toLowerCase() === "gmail.com") {
        // Remove dots from the local part (before @)
        const localPart = parts[0].replace(/\./g, "");
        return `${localPart}@${parts[1]}`;
    }
    return email;
};

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            trim: true,
            minlength: [3, "Username must be at least 3 characters"],
            maxlength: [20, "Username cannot exceed 20 characters"],
            match: [
                /^[a-zA-Z0-9_]+$/,
                "Username can only contain letters, numbers, and underscores",
            ],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
            // Apply normalization using a custom setter
            set: normalizeGmail,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false, // Don't include password in query results by default
        },
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [50, "Name cannot exceed 50 characters"],
        },
        bio: {
            type: String,
            trim: true,
            maxlength: [160, "Bio cannot exceed 160 characters"],
            default: "",
        },
        avatar: {
            type: String,
            default: "", // Default avatar URL will be set here
        },
        headerImage: {
            type: String,
            default: "", // Default header image URL will be set here
        },
        location: {
            type: String,
            trim: true,
            maxlength: [30, "Location cannot exceed 30 characters"],
            default: "",
        },
        website: {
            type: String,
            trim: true,
            maxlength: [100, "Website URL cannot exceed 100 characters"],
            default: "",
        },
        birthdate: {
            type: Date,
            select: false, // Private by default
        },
        following: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        followers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        bookmarks: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Tweet",
            },
        ],
        verified: {
            type: Boolean,
            default: false,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for tweet count
userSchema.virtual("tweetCount", {
    ref: "Tweet",
    localField: "_id",
    foreignField: "author",
    count: true,
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
    // Only hash the password if it's modified (or new)
    if (!this.isModified("password")) return next();

    try {
        // Generate a salt and hash the password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check if password is correct
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Add index for faster queries
// userSchema.index({ username: 1 }); // Removed: Redundant due to unique: true in schema
// userSchema.index({ email: 1 }); // Removed: Redundant due to unique: true in schema
userSchema.index({ bookmarks: 1 }); // Add index for bookmarks for faster lookups

// Add text index for search functionality
userSchema.index({ username: "text", name: "text", bio: "text" });

const User = mongoose.model("User", userSchema);

module.exports = User;
