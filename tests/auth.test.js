const request = require("supertest");
const { app, httpServer } = require("../src/index");
const mongoose = require("mongoose");
const User = require("../src/models/user.model");

beforeAll(async () => {
    // Connect to MongoDB before running tests
    const url =
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/twitter-clone-test";
    if (!mongoose.connection.readyState) {
        await mongoose.connect(url);
    }
});

afterAll(async () => {
    // Clean up the database after tests
    if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase(); // Drop the test database
        await mongoose.connection.close();
    }
    // Close the HTTP server to allow Jest to exit gracefully
    if (httpServer && httpServer.listening) {
        httpServer.close();
    }
});

describe("Auth API", () => {
    // Test user data
    const testUser = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        name: "Test User",
    };
    let accessToken = "";
    let refreshToken = ""; // Assuming refresh token is needed

    // Setup before EACH test: Register User (DB cleaned in afterAll)
    beforeEach(async () => {
        // Ensure users collection is clear before registering the specific test user
        await User.deleteMany({});

        // Register the user via the API endpoint
        const registerRes = await request(app)
            .post("/api/auth/register")
            .send(testUser); // Use the testUser defined in the describe block

        // Check if registration was successful
        if (
            registerRes.statusCode !== 201 ||
            !registerRes.body ||
            registerRes.body.status !== "success" ||
            !registerRes.body.data ||
            !registerRes.body.data.user ||
            !registerRes.body.data.tokens
        ) {
            console.error(
                "Registration failed in auth beforeEach:",
                registerRes.body
            );
            throw new Error("Failed to register test user in auth beforeEach.");
        }

        // Use tokens directly from registration response
        accessToken = registerRes.body.data.tokens.access;
        refreshToken = registerRes.body.data.tokens.refresh;

        // No need to log in again here
    });

    it("should register a new user", async () => {
        // Clear user first for this specific test, as beforeEach already registered one
        await User.deleteMany({});
        const res = await request(app)
            .post("/api/auth/register")
            .send(testUser);
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty("status", "success");
        expect(res.body.data).toHaveProperty("tokens");
        expect(res.body.data.user).toHaveProperty(
            "username",
            testUser.username
        );
    });

    it("should not register a user with an existing email", async () => {
        // beforeEach already registered the user
        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...testUser, username: "anotheruser" });
        expect(res.statusCode).toEqual(409);
        expect(res.body).toHaveProperty("status", "error");
        expect(res.body.message).toMatch(/Email already in use/i);
    });

    it("should log in an existing user", async () => {
        // beforeEach already logged in the user, we just verify the structure again
        const res = await request(app).post("/api/auth/login").send({
            usernameOrEmail: testUser.email,
            password: testUser.password,
        });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("status", "success");
        expect(res.body.data).toHaveProperty("tokens");
        expect(res.body.data.user).toHaveProperty(
            "username",
            testUser.username
        );
    });

    it("should not log in with incorrect password", async () => {
        // beforeEach already registered the user
        const res = await request(app).post("/api/auth/login").send({
            usernameOrEmail: testUser.email,
            password: "wrongpassword",
        });
        expect(res.statusCode).toEqual(401); // Unauthorized
        expect(res.body).toHaveProperty("status", "error");
        expect(res.body.message).toContain("Invalid credentials");
    });

    // --- New Tests ---

    it("should get the current user with a valid token", async () => {
        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("status", "success");
        expect(res.body.data.user).toHaveProperty(
            "username",
            testUser.username
        );
        expect(res.body.data.user).toHaveProperty("email", testUser.email);
        expect(res.body.data.user).not.toHaveProperty("password"); // Ensure password is not sent
    });

    it("should not get the current user without a token", async () => {
        const res = await request(app).get("/api/auth/me");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toContain(
            "Not authenticated. Please log in to access this resource."
        );
    });

    it("should not get the current user with an invalid/expired token", async () => {
        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer invalidtoken`);
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toContain("Token is invalid or expired.");
    });

    it("should refresh the access token with a valid refresh token", async () => {
        // Note: This assumes the refresh token is sent in the body.
        // Adjust if your implementation uses cookies.
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: refreshToken });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("status", "success");
        expect(res.body.data).toHaveProperty("access");
        expect(typeof res.body.data.access).toBe("string");
        expect(res.body.data.access.length).toBeGreaterThan(0);
    });

    it("should not refresh token with an invalid refresh token", async () => {
        const res = await request(app)
            .post("/api/auth/refresh")
            .send({ refreshToken: "invalidrefreshtoken" });

        expect(res.statusCode).toEqual(401); // Or 403 depending on implementation
        expect(res.body.message).toContain("Invalid or expired refresh token");
    });

    it("should log out the user with a valid token", async () => {
        const res = await request(app)
            .post("/api/auth/logout")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("status", "success");
        expect(res.body.message).toContain("Logged out successfully");
    });

    it("should not log out without a token", async () => {
        const res = await request(app).post("/api/auth/logout");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toContain(
            "Not authenticated. Please log in to access this resource."
        );
    });
});
