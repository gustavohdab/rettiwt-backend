const Tweet = require("../models/tweet.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model"); // Import Notification model
const { getIoInstance } = require("../socketHandler"); // Import Socket.IO instance getter

/**
 * Create a new tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const createTweet = async (req, res, next) => {
    try {
        const { content, media = [], quotedTweetId, inReplyToId } = req.body;
        const currentUser = req.user;

        // Create the tweet object
        let tweet = new Tweet({
            content,
            author: currentUser._id,
            media,
            quotedTweet: quotedTweetId || null,
            inReplyTo: inReplyToId || null,
            // Mentions will be populated by the pre-save hook
        });

        // Save the tweet (pre-save hook runs here)
        await tweet.save();

        // Re-fetch the tweet to ensure we have the populated mentions array
        // (Alternatively, the hook could potentially attach validated users to `this`)
        tweet = await Tweet.findById(tweet._id).lean();
        if (!tweet) {
            throw new Error("Failed to re-fetch tweet after save.");
        } // Basic check

        // --- Update Engagement Counts & Create Reply/Quote Notifications ---
        const updatePromises = [];
        let parentTweetAuthorId = null;
        let quotedTweetAuthorId = null; // Added for quote notification
        let quotedTweetContent = null; // Added for quote notification snippet

        // Handle Reply
        if (inReplyToId) {
            const parentTweet = await Tweet.findByIdAndUpdate(
                inReplyToId,
                { $inc: { "engagementCount.replies": 1 } },
                { new: false, projection: { author: 1, content: 1 } } // Get author & content
            );
            if (parentTweet) {
                parentTweetAuthorId = parentTweet.author;
                // Use parent tweet content for reply notification snippet
                quotedTweetContent = parentTweet.content;
            }
            updatePromises.push(parentTweet); // Add promise
        }
        // Create Reply Notification (if applicable and not replying to self)
        if (
            parentTweetAuthorId &&
            parentTweetAuthorId.toString() !== currentUser._id.toString()
        ) {
            try {
                const snippet =
                    quotedTweetContent?.substring(0, 100) +
                    (quotedTweetContent?.length > 100 ? "..." : "");
                const notification = new Notification({
                    recipient: parentTweetAuthorId,
                    sender: currentUser._id,
                    type: "reply",
                    tweet: tweet._id,
                    tweetSnippet: snippet,
                });
                await notification.save();
                const populatedNotification = await Notification.findById(
                    notification._id
                )
                    .populate("sender", "username name avatar")
                    .lean();
                const io = getIoInstance();
                io.to(parentTweetAuthorId.toString()).emit(
                    "notification:new",
                    populatedNotification
                );
                console.log(
                    `Socket event notification:new emitted to room ${parentTweetAuthorId.toString()} for reply`
                );
            } catch (notificationError) {
                console.error(
                    "Error creating/emitting reply notification:",
                    notificationError
                );
            }
        }

        // Handle Quote Tweet
        if (quotedTweetId) {
            const quotedTweet = await Tweet.findByIdAndUpdate(
                quotedTweetId,
                {
                    $inc: { "engagementCount.quotes": 1 },
                },
                { new: false, projection: { author: 1, content: 1 } }
            ); // Get author & content

            if (quotedTweet) {
                quotedTweetAuthorId = quotedTweet.author;
                // Use the QUOTED tweet's content for the quote notification snippet
                quotedTweetContent = quotedTweet.content;
            }
            updatePromises.push(quotedTweet); // Add promise

            // Create Quote Notification (if applicable and not quoting self)
            if (
                quotedTweetAuthorId &&
                quotedTweetAuthorId.toString() !== currentUser._id.toString()
            ) {
                try {
                    const snippet =
                        quotedTweetContent?.substring(0, 100) +
                        (quotedTweetContent?.length > 100 ? "..." : "");
                    const notification = new Notification({
                        recipient: quotedTweetAuthorId,
                        sender: currentUser._id,
                        type: "quote",
                        tweet: tweet._id, // The new tweet that *contains* the quote
                        tweetSnippet: snippet, // Snippet of the *original* tweet being quoted
                    });
                    await notification.save();
                    const populatedNotification = await Notification.findById(
                        notification._id
                    )
                        .populate("sender", "username name avatar")
                        .lean();
                    const io = getIoInstance();
                    io.to(quotedTweetAuthorId.toString()).emit(
                        "notification:new",
                        populatedNotification
                    );
                    console.log(
                        `Socket event notification:new emitted to room ${quotedTweetAuthorId.toString()} for quote`
                    );
                } catch (notificationError) {
                    console.error(
                        "Error creating/emitting quote notification:",
                        notificationError
                    );
                }
            }
        }

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises.filter((p) => p));
        }
        // ----------------------------------------------------------

        // --- Create Mention Notifications ---
        if (tweet.mentions && tweet.mentions.length > 0) {
            // Use Promise.allSettled to handle multiple notification creations concurrently
            // and avoid stopping if one fails.
            const mentionNotificationPromises = tweet.mentions.map(
                async (mentionedUserId) => {
                    // Don't notify self
                    if (
                        mentionedUserId.toString() ===
                        currentUser._id.toString()
                    ) {
                        return { status: "skipped", reason: "self-mention" };
                    }

                    try {
                        const snippet =
                            tweet.content?.substring(0, 100) +
                            (tweet.content?.length > 100 ? "..." : "");
                        const notification = new Notification({
                            recipient: mentionedUserId,
                            sender: currentUser._id,
                            type: "mention",
                            tweet: tweet._id,
                            tweetSnippet: snippet,
                        });
                        await notification.save();

                        // Populate and emit
                        const populatedNotification =
                            await Notification.findById(notification._id)
                                .populate("sender", "username name avatar")
                                .lean();
                        const io = getIoInstance();
                        io.to(mentionedUserId.toString()).emit(
                            "notification:new",
                            populatedNotification
                        );
                        console.log(
                            `Socket event notification:new emitted to room ${mentionedUserId.toString()} for mention`
                        );
                        return { status: "fulfilled", value: mentionedUserId };
                    } catch (notificationError) {
                        console.error(
                            `Error creating/emitting mention notification for ${mentionedUserId}:`,
                            notificationError
                        );
                        return {
                            status: "rejected",
                            reason: notificationError,
                        };
                    }
                }
            );
            // Wait for all mention notifications to settle (optional)
            await Promise.allSettled(mentionNotificationPromises);
        }
        // ----------------------------------

        // Populate author information for the response and socket event
        const populatedTweetForResponse = await Tweet.findById(tweet._id) // Use the refetched lean tweet ID
            .populate("author", "username name avatar")
            .lean();

        // --- Calculate and Emit Trending Hashtags ---
        try {
            const io = getIoInstance();

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
                { $limit: 10 },
            ]);

            // Emit trending update
            io.emit("trends:update", { trendingHashtags });
            console.log(
                "Socket event trends:update emitted with new trending hashtags"
            );
        } catch (trendsError) {
            console.error("Error calculating trending hashtags:", trendsError);
        }
        // -----------------------------------------

        // --- Emit Socket.IO Event ---
        try {
            const io = getIoInstance();
            // Emit to all connected clients initially
            io.emit("tweet:new", { tweet: populatedTweetForResponse });
            console.log(
                `Socket event tweet:new emitted for tweet ${populatedTweetForResponse._id}`
            );
        } catch (socketError) {
            // Log socket error but don't fail the HTTP request
            console.error(
                "Socket.IO emission error in createTweet:",
                socketError
            );
        }
        // ---------------------------

        res.status(201).json({
            status: "success",
            data: {
                tweet: populatedTweetForResponse, // Send the populated tweet
            },
        });
    } catch (error) {
        // Pass error to the central error handler
        next(error);
    }
};

/**
 * Get a tweet by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Increment impressions
        await Tweet.findByIdAndUpdate(id, {
            $inc: { "analytics.impressions": 1 },
        });

        // Check if user is authenticated and has bookmarked this tweet
        let tweetResponse = tweet.toObject();
        if (req.user) {
            const user = await User.findById(req.user._id);
            tweetResponse.bookmarked = user.bookmarks.includes(tweet._id);
        }

        res.status(200).json({
            status: "success",
            data: {
                tweet: tweetResponse,
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
 * Get a tweet with its replies (thread)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTweetThread = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get the main tweet
        const tweet = await Tweet.findById(id)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Get replies to this tweet
        const replies = await Tweet.find({
            inReplyTo: id,
            isDeleted: false,
        })
            .sort({ createdAt: 1 }) // Oldest first for a conversation
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get the total count for pagination
        const total = await Tweet.countDocuments({
            inReplyTo: id,
            isDeleted: false,
        });

        // Add bookmarked status if user is authenticated
        let tweetResponse = tweet.toObject();
        let repliesResponse = replies.map((reply) => reply.toObject());
        let parentTweetResponse = null;

        if (req.user) {
            const user = await User.findById(req.user._id);
            const bookmarkedTweetIds = user.bookmarks.map((id) =>
                id.toString()
            );

            // Check if main tweet is bookmarked
            tweetResponse.bookmarked = bookmarkedTweetIds.includes(
                tweet._id.toString()
            );

            // Check if each reply is bookmarked
            repliesResponse = repliesResponse.map((reply) => {
                reply.bookmarked = bookmarkedTweetIds.includes(
                    reply._id.toString()
                );
                return reply;
            });

            // Check if parent tweet (if exists) is bookmarked
            if (tweet.inReplyTo && typeof tweet.inReplyTo === "object") {
                parentTweetResponse = tweet.inReplyTo.toObject();
                parentTweetResponse.bookmarked = bookmarkedTweetIds.includes(
                    parentTweetResponse._id.toString()
                );
            }
        } else if (tweet.inReplyTo && typeof tweet.inReplyTo === "object") {
            parentTweetResponse = tweet.inReplyTo.toObject();
        }

        // Increment impressions
        await Tweet.findByIdAndUpdate(id, {
            $inc: { "analytics.impressions": 1 },
        });

        res.status(200).json({
            status: "success",
            data: {
                tweet: tweetResponse,
                parentTweet: parentTweetResponse || undefined,
                replies: repliesResponse,
                pagination: {
                    page,
                    limit,
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

/**
 * Delete a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user is the author
        if (tweet.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: "error",
                message: "You are not authorized to delete this tweet",
            });
        }

        // Soft delete
        await Tweet.findByIdAndUpdate(id, { isDeleted: true });

        res.status(200).json({
            status: "success",
            message: "Tweet deleted successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Like a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const likeTweet = async (req, res, next) => {
    try {
        const { id } = req.params; // Tweet ID
        const currentUser = req.user; // Authenticated user

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            const err = new Error("Tweet not found");
            err.statusCode = 404;
            throw err;
        }

        // Check if user has already liked
        if (tweet.likes.includes(currentUser._id)) {
            const err = new Error("You have already liked this tweet");
            err.statusCode = 400;
            throw err;
        }

        // Add user to likes array and increment count
        // Use findByIdAndUpdate and retrieve the updated document to get the author ID
        const updatedTweet = await Tweet.findByIdAndUpdate(
            id,
            {
                $addToSet: { likes: currentUser._id }, // Use $addToSet to be safe
                $inc: { "engagementCount.likes": 1 },
            },
            { new: true } // Return the updated document
        ).lean(); // Use lean() here to get plain object for snippet

        // --- Create Notification (only if not liking own tweet) ---
        if (updatedTweet.author.toString() !== currentUser._id.toString()) {
            try {
                // Create snippet from the liked tweet's content
                const snippet =
                    updatedTweet.content?.substring(0, 100) +
                    (updatedTweet.content?.length > 100 ? "..." : "");

                const notification = new Notification({
                    recipient: updatedTweet.author,
                    sender: currentUser._id,
                    type: "like",
                    tweet: updatedTweet._id,
                    tweetSnippet: snippet, // Add the snippet
                });
                await notification.save();

                // Populate sender for the socket event
                const populatedNotification = await Notification.findById(
                    notification._id
                )
                    .populate("sender", "username name avatar")
                    .lean();

                // Emit event to the tweet author
                const io = getIoInstance();
                io.to(updatedTweet.author.toString()).emit(
                    "notification:new",
                    populatedNotification
                );
                console.log(
                    `Socket event notification:new emitted to room ${updatedTweet.author.toString()} for like`
                );
            } catch (notificationError) {
                console.error(
                    "Error creating/emitting like notification:",
                    notificationError
                );
                // Don't fail the main request if notification fails
            }
        }
        // -----------------------------------------------------------

        res.status(200).json({
            status: "success",
            message: "Tweet liked successfully",
        });
    } catch (error) {
        next(error); // Pass error to central handler
    }
};

/**
 * Unlike a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unlikeTweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has liked
        if (!tweet.likes.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have not liked this tweet",
            });
        }

        // Remove user from likes array and decrement count
        await Tweet.findByIdAndUpdate(id, {
            $pull: { likes: req.user._id },
            $inc: { "engagementCount.likes": -1 },
        });

        res.status(200).json({
            status: "success",
            message: "Tweet unliked successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Retweet a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const retweetTweet = async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            const err = new Error("Tweet not found");
            err.statusCode = 404;
            throw err;
        }

        if (tweet.retweets.includes(currentUser._id)) {
            const err = new Error("You have already retweeted this tweet");
            err.statusCode = 400;
            throw err;
        }

        const updatedTweet = await Tweet.findByIdAndUpdate(
            id,
            {
                $addToSet: { retweets: currentUser._id },
                $inc: { "engagementCount.retweets": 1 },
            },
            { new: true }
        ).lean();

        if (updatedTweet.author.toString() !== currentUser._id.toString()) {
            try {
                const snippet =
                    updatedTweet.content?.substring(0, 100) +
                    (updatedTweet.content?.length > 100 ? "..." : "");
                const notification = new Notification({
                    recipient: updatedTweet.author,
                    sender: currentUser._id,
                    type: "retweet",
                    tweet: updatedTweet._id,
                    tweetSnippet: snippet,
                });
                await notification.save();

                const populatedNotification = await Notification.findById(
                    notification._id
                )
                    .populate("sender", "username name avatar")
                    .lean();
                const io = getIoInstance();
                io.to(updatedTweet.author.toString()).emit(
                    "notification:new",
                    populatedNotification
                );
                console.log(
                    `Socket event notification:new emitted to room ${updatedTweet.author.toString()} for retweet`
                );
            } catch (notificationError) {
                console.error(
                    "Error creating/emitting retweet notification:",
                    notificationError
                );
            }
        }

        res.status(200).json({
            status: "success",
            message: "Tweet retweeted successfully",
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Undo retweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const undoRetweet = async (req, res) => {
    try {
        const { id } = req.params;

        const tweet = await Tweet.findById(id);

        if (!tweet || tweet.isDeleted) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Check if user has retweeted
        if (!tweet.retweets.includes(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "You have not retweeted this tweet",
            });
        }

        // Remove user from retweets array and decrement count
        await Tweet.findByIdAndUpdate(id, {
            $pull: { retweets: req.user._id },
            $inc: { "engagementCount.retweets": -1 },
        });

        res.status(200).json({
            status: "success",
            message: "Retweet removed successfully",
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Get user timeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTimeline = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const includeReplies = req.query.includeReplies === "true";

        // Get users the authenticated user is following
        const following = req.user.following;
        following.push(req.user._id); // Include user's own tweets

        // Base query
        const baseQuery = {
            author: { $in: following },
            isDeleted: false,
        };

        // If we should exclude replies, add that condition
        if (!includeReplies) {
            baseQuery.inReplyTo = null;
        }

        // Get tweets from followed users and user's own tweets
        const tweets = await Tweet.find(baseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            })
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments(baseQuery);

        // Get user's bookmarks to check if tweets are bookmarked
        const user = await User.findById(req.user._id);
        const bookmarkedTweetIds = user.bookmarks.map((id) => id.toString());

        // Add bookmarked field to each tweet
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
                tweets: tweetsWithBookmarkStatus,
                pagination: {
                    page,
                    limit,
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

/**
 * Get tweets liked by a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserLikedTweets = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get tweets that the user has liked
        // First get the IDs of tweets user liked
        const likedTweetIds = await Tweet.find(
            { likes: user._id, isDeleted: false },
            "_id"
        ).lean();

        // Then fetch the full tweet details
        const tweets = await Tweet.find({
            _id: { $in: likedTweetIds.map((t) => t._id) },
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = likedTweetIds.length;

        res.status(200).json({
            status: "success",
            data: {
                tweets,
                pagination: {
                    page,
                    limit,
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

/**
 * Get user tweets
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserTweets = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const mediaOnly = req.query.mediaOnly === "true";

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Build query
        const query = {
            author: user._id,
            isDeleted: false,
            // If there's a inReplyTo field, it's a reply, not a tweet
            inReplyTo: null,
        };

        // If mediaOnly is true, only get tweets with media
        if (mediaOnly) {
            query["media.0"] = { $exists: true };
        }

        // Get user's tweets
        const tweets = await Tweet.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "quotedTweet",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments(query);

        res.status(200).json({
            status: "success",
            data: {
                tweets,
                pagination: {
                    page,
                    limit,
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

/**
 * Get user replies
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserReplies = async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        // Get user's replies
        const tweets = await Tweet.find({
            author: user._id,
            isDeleted: false,
            inReplyTo: { $ne: null }, // Must have inReplyTo field
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("author", "username name avatar")
            .populate({
                path: "inReplyTo",
                populate: {
                    path: "author",
                    select: "username name avatar",
                },
            });

        // Get total count for pagination
        const total = await Tweet.countDocuments({
            author: user._id,
            isDeleted: false,
            inReplyTo: { $ne: null },
        });

        res.status(200).json({
            status: "success",
            data: {
                tweets,
                pagination: {
                    page,
                    limit,
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

/**
 * Bookmark a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bookmarkTweet = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Verify the tweet exists and is not deleted
        const tweet = await Tweet.findOne({ _id: id, isDeleted: false });
        if (!tweet) {
            return res.status(404).json({
                status: "error",
                message: "Tweet not found",
            });
        }

        // Add the tweet to user's bookmarks if not already there
        const updated = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { bookmarks: id } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Tweet bookmarked successfully",
            bookmarked: true,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

/**
 * Remove bookmark from a tweet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unbookmarkTweet = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Remove the tweet from user's bookmarks
        const updated = await User.findByIdAndUpdate(
            userId,
            { $pull: { bookmarks: id } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Bookmark removed successfully",
            bookmarked: false,
        });
    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
    }
};

module.exports = {
    createTweet,
    getTweet,
    getTweetThread,
    deleteTweet,
    likeTweet,
    unlikeTweet,
    retweetTweet,
    undoRetweet,
    getTimeline,
    getUserTweets,
    getUserReplies,
    getUserLikedTweets,
    bookmarkTweet,
    unbookmarkTweet,
};
