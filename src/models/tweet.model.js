const mongoose = require("mongoose");

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
        // Mentions extracted from content
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
tweetSchema.pre("save", function (next) {
    if (this.isModified("content")) {
        // Extract hashtags using Unicode-aware regex
        // Allows letters (including Unicode), numbers, and underscore
        const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
        this.hashtags = [];
        let match;
        while ((match = hashtagRegex.exec(this.content)) !== null) {
            // Store the extracted hashtag (group 1) in lowercase
            this.hashtags.push(match[1].toLowerCase());
        }

        // Mentions would need to be processed separately
        // after verifying the users exist
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
