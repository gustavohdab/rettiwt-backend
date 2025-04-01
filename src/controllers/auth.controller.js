const User = require("../models/user.model");
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} = require("../utils/jwt.utils");

// Helper function to normalize Gmail addresses (mirrors the one in user.model.js)
const normalizeGmail = (email) => {
    if (!email) return email;
    const parts = email.split("@");
    if (parts.length === 2 && parts[1].toLowerCase() === "gmail.com") {
        const localPart = parts[0].replace(/\./g, "");
        return `${localPart}@${parts[1]}`;
    }
    return email;
};

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
    try {
        const { username, email, password, name } = req.body;

        // Check if user already exists (using normalized email for check)
        const normalizedEmailForCheck = normalizeGmail(email);
        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmailForCheck }, { username }],
        });

        if (existingUser) {
            return res.status(409).json({
                status: "error",
                message:
                    existingUser.email === normalizedEmailForCheck
                        ? "Email already in use"
                        : "Username already taken",
            });
        }

        // Create new user instance (model's setter will normalize the email)
        const newUser = new User({
            username,
            email, // Pass original, setter handles normalization
            password,
            name,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                name
            )}&background=random`,
        });

        // Explicitly save the new user
        const user = await newUser.save();

        // Log successful creation after save
        console.log(
            `Register: User successfully saved with ID: ${user._id}, Email: ${user.email}`
        );

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user._id);

        // Remove password from response
        user.password = undefined;

        res.status(201).json({
            status: "success",
            data: {
                user,
                tokens: {
                    access: accessToken,
                    refresh: refreshToken,
                },
            },
        });
    } catch (error) {
        // Check for duplicate key error (code 11000)
        if (error.code === 11000) {
            let message = "Duplicate field value entered";
            if (error.keyPattern && error.keyPattern.email) {
                message = "Email already in use";
            } else if (error.keyPattern && error.keyPattern.username) {
                message = "Username already taken";
            }
            return res.status(409).json({
                status: "error",
                message: message,
            });
        }
        // Handle other errors
        res.status(400).json({
            status: "error",
            message: error.message || "Registration failed",
        });
    }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        // Check if usernameOrEmail and password are provided
        if (!usernameOrEmail || !password) {
            return res.status(400).json({
                status: "error",
                message: "Please provide username/email and password",
            });
        }

        // Normalize the input if it looks like an email
        let normalizedInput = usernameOrEmail;
        let isLikelyEmail = usernameOrEmail.includes("@");
        if (isLikelyEmail) {
            normalizedInput = normalizeGmail(
                usernameOrEmail.trim().toLowerCase()
            );
        }

        // Log the values being used for lookup
        console.log("Login Attempt - Original Input:", usernameOrEmail);
        console.log(
            "Login Attempt - Normalized Input for Query:",
            normalizedInput
        );

        // Determine query conditions
        const queryConditions = isLikelyEmail
            ? { email: normalizedInput } // Only query by normalized email if input contained '@'
            : {
                  $or: [
                      { username: usernameOrEmail },
                      { email: normalizedInput },
                  ],
              }; // Query by username OR normalized email

        // Find user
        const user = await User.findOne(queryConditions).select("+password");

        // Log whether user was found
        if (!user) {
            console.log(
                "Login Attempt - User Found: Not Found (using normalized input)"
            );
            return res.status(401).json({
                // Return early if not found
                status: "error",
                message: "Invalid credentials",
            });
        } else {
            console.log("Login Attempt - User Found: Yes, ID:", user._id);
        }

        // Check if password is correct
        if (!(await user.comparePassword(password))) {
            console.log(
                "Login Attempt - Password Check: Failed for User:",
                user._id
            );
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials",
            });
        }
        console.log(
            "Login Attempt - Password Check: Passed for User:",
            user._id
        );

        // // Update last login - Temporarily commented out for testing
        // user.lastLogin = new Date();
        // await user.save({ validateBeforeSave: false, hooks: false });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user._id);

        // Remove password from response
        user.password = undefined;

        res.status(200).json({
            status: "success",
            data: {
                user,
                tokens: {
                    access: accessToken,
                    refresh: refreshToken,
                },
            },
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(400).json({
            status: "error",
            message: error.message || "Login failed",
        });
    }
};

/**
 * Refresh access token using refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                status: "error",
                message: "Refresh token is required",
            });
        }

        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({
                status: "error",
                message: "Invalid or expired refresh token",
            });
        }

        // Find user
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            return res.status(401).json({
                status: "error",
                message: "User not found or inactive",
            });
        }

        // Generate new access token
        const accessToken = generateAccessToken(user);

        res.status(200).json({
            status: "success",
            data: {
                access: accessToken,
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
 * Get current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("following", "username name avatar")
            .populate("followers", "username name avatar");

        res.status(200).json({
            status: "success",
            data: {
                user,
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
 * Logout user (client-side - invalidate tokens)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = (req, res) => {
    // In a stateless JWT system, logout is handled client-side
    // by removing the tokens from storage

    res.status(200).json({
        status: "success",
        message: "Logged out successfully",
    });
};

module.exports = {
    register,
    login,
    refreshToken,
    getCurrentUser,
    logout,
};
