const Tweet = require("../models/tweet.model");
const User = require("../models/user.model");

/**
 * Get trending hashtags from the last 7 days
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTrendingHashtags = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Get tweets from the last 7 days
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Aggregate to find most used hashtags
        const trendingHashtags = await Tweet.aggregate([
            {
                $match: {
                    createdAt: { $gte: oneWeekAgo },
                    isDeleted: false,
                    hashtags: { $exists: true, $ne: [] },
                },
            },
            { $unwind: "$hashtags" },
            {
                $group: {
                    _id: "$hashtags",
                    count: { $sum: 1 },
                    tweets: { $push: "$_id" },
                    engagementSum: {
                        $sum: {
                            $add: [
                                "$engagementCount.likes",
                                "$engagementCount.retweets",
                                "$engagementCount.replies",
                            ],
                        },
                    },
                },
            },
            {
                $project: {
                    hashtag: "$_id",
                    count: 1,
                    tweetCount: { $size: "$tweets" },
                    engagementScore: "$engagementSum",
                    _id: 0,
                },
            },
            {
                $sort: {
                    count: -1,
                    engagementScore: -1,
                },
            },
            { $limit: parseInt(limit) },
        ]);

        res.status(200).json({
            status: "success",
            data: {
                trendingHashtags,
            },
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get popular tweets based on engagement metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPopularTweets = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get tweets with high engagement from the last 7 days
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const popularTweets = await Tweet.find({
            createdAt: { $gte: oneWeekAgo },
            isDeleted: false,
        })
            .sort({
                "engagementCount.likes": -1,
                "engagementCount.retweets": -1,
                "engagementCount.replies": -1,
                createdAt: -1,
            })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        const total = await Tweet.countDocuments({
            createdAt: { $gte: oneWeekAgo },
            isDeleted: false,
        });

        // Add bookmark status if user is authenticated
        if (req.user) {
            const user = await User.findById(req.user._id);
            const bookmarkedTweetIds = user.bookmarks.map((id) =>
                id.toString()
            );

            const tweetsWithBookmarkStatus = popularTweets.map((tweet) => {
                const tweetObj = tweet.toObject();
                tweetObj.bookmarked = bookmarkedTweetIds.includes(
                    tweet._id.toString()
                );
                return tweetObj;
            });

            res.status(200).json({
                status: "success",
                data: {
                    tweets: tweetsWithBookmarkStatus,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                },
            });
        } else {
            res.status(200).json({
                status: "success",
                data: {
                    tweets: popularTweets,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                },
            });
        }
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get tweets by hashtag
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTweetsByHashtag = async (req, res) => {
    try {
        const { hashtag } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        if (!hashtag) {
            return res.status(400).json({
                status: "error",
                message: "Hashtag parameter is required",
            });
        }

        // Remove # if present
        const cleanHashtag = hashtag.startsWith("#")
            ? hashtag.substring(1)
            : hashtag;

        const tweets = await Tweet.find({
            hashtags: cleanHashtag.toLowerCase(),
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        const total = await Tweet.countDocuments({
            hashtags: cleanHashtag.toLowerCase(),
            isDeleted: false,
        });

        // Add bookmark status if user is authenticated
        if (req.user) {
            const user = await User.findById(req.user._id);
            const bookmarkedTweetIds = user.bookmarks.map((id) =>
                id.toString()
            );

            const tweetsWithBookmarkStatus = tweets.map((tweet) => {
                const tweetObj = tweet.toObject();
                tweetObj.bookmarked = bookmarkedTweetIds.includes(
                    tweet._id.toString()
                );
                return tweetObj;
            });

            res.status(200).json({
                status: "success",
                data: {
                    hashtag: cleanHashtag,
                    tweets: tweetsWithBookmarkStatus,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                },
            });
        } else {
            res.status(200).json({
                status: "success",
                data: {
                    hashtag: cleanHashtag,
                    tweets: tweets,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                },
            });
        }
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get user recommendations for "Who to follow"
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRecommendedUsers = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        // Basic recommendation algorithm - users with most followers
        // In a real app, this would use more complex signals
        let recommendedUsers = await User.find({})
            .sort({ followerCount: -1 })
            .limit(parseInt(limit) + 50) // Fetch more to filter out followed users
            .select("username name avatar bio followerCount");

        // If user is logged in, filter out users they already follow and themselves
        if (req.user) {
            const currentUser = await User.findById(req.user._id);
            const followingIds = currentUser.following.map((id) =>
                id.toString()
            );

            // Filter out users that the current user already follows and the current user
            recommendedUsers = recommendedUsers.filter(
                (user) =>
                    !followingIds.includes(user._id.toString()) &&
                    user._id.toString() !== req.user._id.toString()
            );
        }

        // Return only the requested number of users
        recommendedUsers = recommendedUsers.slice(0, parseInt(limit));

        res.status(200).json({
            status: "success",
            data: {
                users: recommendedUsers,
            },
        });
    } catch (error) {
        console.error("Error getting recommended users:", error);
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = {
    getTrendingHashtags,
    getPopularTweets,
    getTweetsByHashtag,
    getRecommendedUsers,
};
