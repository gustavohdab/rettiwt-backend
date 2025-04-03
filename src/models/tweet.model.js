const mongoose = require("mongoose");
const User = require("./user.model"); // Ensure User model is imported for validation

const tweetSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, "Tweet content is required"],
            trim: true,
            maxlength: [280, "Tweet cannot exceed 280 characters"],
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Tweet must have an author"],
        },
        media: [
            {
                type: {
                    type: String,
                    enum: ["image", "video", "gif"],
                    required: true,
                },
                url: {
                    type: String,
                    required: true,
                },
                altText: String,
            },
        ],
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        retweets: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        // For quote tweets
        quotedTweet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tweet",
        },
        // For replies
        inReplyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tweet",
        },
        // For tracking engagement
        engagementCount: {
            likes: {
                type: Number,
                default: 0,
            },
            retweets: {
                type: Number,
                default: 0,
            },
            replies: {
                type: Number,
                default: 0,
            },
            quotes: {
                type: Number,
                default: 0,
            },
        },
        // Metadata for analytics
        analytics: {
            impressions: {
                type: Number,
                default: 0,
            },
            profileClicks: {
                type: Number,
                default: 0,
            },
            linkClicks: {
                type: Number,
                default: 0,
            },
        },
        // Tweet visibility
        isPublic: {
            type: Boolean,
            default: true,
        },
        // Hashtags extracted from content
        hashtags: [
            {
                type: String,
                trim: true,
            },
        ],
        // Mentions extracted from content (stores validated User IDs)
        mentions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        // For soft deletes
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for replies to this tweet
tweetSchema.virtual("replies", {
    ref: "Tweet",
    localField: "_id",
    foreignField: "inReplyTo",
});

// Virtual for quote tweets of this tweet
tweetSchema.virtual("quotes", {
    ref: "Tweet",
    localField: "_id",
    foreignField: "quotedTweet",
});

// Pre-save middleware to extract hashtags and mentions
tweetSchema.pre("save", async function (next) {
    // Make async for User query
    if (this.isModified("content")) {
        // --- Extract Hashtags ---
        const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
        this.hashtags = [];
        let hashMatch;
        while ((hashMatch = hashtagRegex.exec(this.content)) !== null) {
            this.hashtags.push(hashMatch[1].toLowerCase());
        }

        // --- Extract and Validate Mentions ---
        const mentionRegex = /@([a-zA-Z0-9_]+)/g; // Basic mention regex
        const potentialUsernames = [];
        let mentionMatch;
        while ((mentionMatch = mentionRegex.exec(this.content)) !== null) {
            // Avoid duplicates and self-mentions implicitly later
            potentialUsernames.push(mentionMatch[1]);
        }

        this.mentions = []; // Reset mentions array
        if (potentialUsernames.length > 0) {
            try {
                // Find users matching the potential usernames (case-insensitive)
                const foundUsers = await User.find({
                    username: {
                        $in: potentialUsernames.map(
                            (name) => new RegExp(`^${name}$`, "i")
                        ),
                    },
                }).select("_id"); // Only select IDs

                this.mentions = foundUsers.map((user) => user._id);
            } catch (error) {
                console.error("Error validating mentions:", error);
                // Decide if failure here should block saving? For now, just log error.
                // Potentially call next(error) to stop save.
            }
        }
        // --------------------------------------
    }
    next();
});

// Indexes for faster queries
tweetSchema.index({ author: 1, createdAt: -1 });
tweetSchema.index({ hashtags: 1 });
tweetSchema.index({ "engagementCount.likes": -1 });
tweetSchema.index({ inReplyTo: 1 });

// Add text index for search functionality
tweetSchema.index({ content: "text" });

const Tweet = mongoose.model("Tweet", tweetSchema);

module.exports = Tweet;
