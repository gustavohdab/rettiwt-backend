const User = require("../models/user.model");
const Tweet = require("../models/tweet.model");

/**
 * Search for users, tweets, hashtags, or all
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const search = async (req, res) => {
    try {
        const { q, type = "all", page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({
                status: "error",
                message: "Search query is required",
            });
        }

        let results = {};
        let total = 0;

        // Search users
        if (type === "users" || type === "all") {
            const users = await User.find(
                { $text: { $search: q } },
                { score: { $meta: "textScore" } }
            )
                .sort({ score: { $meta: "textScore" } })
                .skip(type === "users" ? skip : 0)
                .limit(type === "users" ? limit : 5)
                .select("username name avatar bio");

            results.users = users;

            if (type === "users") {
                total = await User.countDocuments({ $text: { $search: q } });
            }
        }

        // Search tweets
        if (type === "tweets" || type === "all") {
            const tweets = await Tweet.find(
                {
                    $text: { $search: q },
                    isDeleted: false,
                },
                { score: { $meta: "textScore" } }
            )
                .sort({ score: { $meta: "textScore" } })
                .skip(type === "tweets" ? skip : 0)
                .limit(type === "tweets" ? limit : 5)
                .populate("author", "username name avatar")
                .populate({
                    path: "quotedTweet",
                    populate: {
                        path: "author",
                        select: "username name avatar",
                    },
                });

            results.tweets = tweets;

            if (type === "tweets") {
                total = await Tweet.countDocuments({
                    $text: { $search: q },
                    isDeleted: false,
                });
            }
        }

        // Search hashtags
        if (type === "hashtags" || type === "all") {
            // Find relevant hashtags
            const hashtagQuery = q.startsWith("#") ? q.substring(1) : q;

            const hashtagResults = await Tweet.aggregate([
                {
                    $match: {
                        hashtags: { $regex: hashtagQuery, $options: "i" },
                    },
                },
                { $unwind: "$hashtags" },
                {
                    $match: {
                        hashtags: { $regex: hashtagQuery, $options: "i" },
                    },
                },
                { $group: { _id: "$hashtags", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $skip: type === "hashtags" ? skip : 0 },
                { $limit: type === "hashtags" ? parseInt(limit) : 5 },
                { $project: { _id: 0, hashtag: "$_id", count: 1 } },
            ]);

            results.hashtags = hashtagResults.map((h) => h.hashtag);

            if (type === "hashtags") {
                // Get total count for hashtags
                const totalHashtagsCount = await Tweet.aggregate([
                    {
                        $match: {
                            hashtags: { $regex: hashtagQuery, $options: "i" },
                        },
                    },
                    { $unwind: "$hashtags" },
                    {
                        $match: {
                            hashtags: { $regex: hashtagQuery, $options: "i" },
                        },
                    },
                    { $group: { _id: "$hashtags" } },
                    { $count: "total" },
                ]);

                total =
                    totalHashtagsCount.length > 0
                        ? totalHashtagsCount[0].total
                        : 0;
            }
        }

        // For "all" type, calculate total differently
        if (type === "all") {
            const userCount = await User.countDocuments({
                $text: { $search: q },
            });
            const tweetCount = await Tweet.countDocuments({
                $text: { $search: q },
                isDeleted: false,
            });

            // Count hashtags
            const hashtagQuery = q.startsWith("#") ? q.substring(1) : q;
            const hashtagCount = await Tweet.aggregate([
                {
                    $match: {
                        hashtags: { $regex: hashtagQuery, $options: "i" },
                    },
                },
                { $unwind: "$hashtags" },
                {
                    $match: {
                        hashtags: { $regex: hashtagQuery, $options: "i" },
                    },
                },
                { $group: { _id: "$hashtags" } },
                { $count: "total" },
            ]);

            const hashtagTotal =
                hashtagCount.length > 0 ? hashtagCount[0].total : 0;

            results.counts = {
                users: userCount,
                tweets: tweetCount,
                hashtags: hashtagTotal,
                total: userCount + tweetCount + hashtagTotal,
            };

            total = userCount + tweetCount + hashtagTotal;
        }

        // Add bookmark status to tweets if user is authenticated
        if (req.user && results.tweets && results.tweets.length > 0) {
            const user = await User.findById(req.user._id);
            const bookmarkedTweetIds = user.bookmarks.map((id) =>
                id.toString()
            );

            results.tweets = results.tweets.map((tweet) => {
                const tweetObj = tweet.toObject();
                tweetObj.bookmarked = bookmarkedTweetIds.includes(
                    tweet._id.toString()
                );
                return tweetObj;
            });
        }

        res.status(200).json({
            status: "success",
            data: {
                results,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = {
    search,
};
