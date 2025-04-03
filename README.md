# Twitter Clone Backend API

This is the RESTful API and real-time WebSocket server for the Twitter Clone project, built with Node.js, Express, MongoDB, Mongoose, and Socket.IO. It provides the data and real-time communication layer for the [frontend application](../frontend/README.md).

## Features

-   User Authentication (JWT: Access & Refresh Tokens)
-   User Profile Management (View, Update with Image Uploads)
-   Tweet Management (Create, Read, Delete)
-   Tweet Interactions (Like, Retweet, Reply, Quote Tweet)
-   Timeline Generation (User-specific feeds)
-   Follow/Unfollow Functionality
-   Bookmark Management
-   Search (Users, Tweets, Hashtags) with Pagination
-   Trending Hashtags & User Suggestions
-   Real-time Updates via WebSockets (Socket.IO):
    -   New Tweets
    -   Follow/Unfollow Actions
-   Input Validation
-   Secure Password Hashing (bcrypt)
-   Media Uploads (User Avatars, Headers, Tweet Media) with Multer

## Tech Stack

-   **Runtime**: [Node.js](https://nodejs.org/) (v18+)
-   **Framework**: [Express](https://expressjs.com/) 4.x
-   **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/) ODM
-   **Real-time**: [Socket.IO](https://socket.io/) 4.x
-   **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/) (`jsonwebtoken`)
-   **Password Hashing**: [bcrypt](https://github.com/kelektiv/node.bcrypt.js)
-   **Validation**: [express-validator](https://express-validator.github.io/docs/)
-   **File Uploads**: [Multer](https://github.com/expressjs/multer)
-   **Security**: [Helmet](https://helmetjs.github.io/), [CORS](https://github.com/expressjs/cors)
-   **Logging**: [Morgan](https://github.com/expressjs/morgan)
-   **Testing**: [Jest](https://jestjs.io/), [Supertest](https://github.com/visionmedia/supertest)
-   **Development**: [Nodemon](https://nodemon.io/), [ESLint](https://eslint.org/)

## Getting Started

### Prerequisites

-   Node.js (v18 or later - check `.nvmrc` if available)
-   MongoDB Instance (Local or Cloud like MongoDB Atlas)
-   npm or yarn

### Installation

1.  Clone the repository (if you haven't already).
2.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
3.  Install dependencies:
    ```bash
    npm install
    # or yarn install
    ```
4.  Set up environment variables (see below).

### Environment Variables

Create a `.env` file in the `backend` root directory by copying the example file:

```bash
cp .env.example .env
```

Fill in the required environment variables. **Ensure you use strong, unique secrets.**

-   `PORT`: Port for the server (default: `5000`).
-   `NODE_ENV`: Environment (`development` or `production`).
-   `MONGODB_URI`: Your MongoDB connection string.
-   `JWT_SECRET`: Secret key for signing JWT access tokens.
-   `JWT_EXPIRES_IN`: Access token expiration time (e.g., `15m`, `1h`).
-   `JWT_REFRESH_SECRET`: Secret key for signing JWT refresh tokens (must differ from `JWT_SECRET`).
-   `JWT_REFRESH_EXPIRES_IN`: Refresh token expiration time (e.g., `7d`, `30d`).
-   `FRONTEND_URL`: URL of the frontend application for CORS (e.g., `http://localhost:3000` or deployed frontend URL).
-   `UPLOAD_DIR`: (Optional, if using local uploads) Directory for uploads relative to root (e.g., `uploads`). Ensure it exists and is writable.
-   `MAX_FILE_SIZE`: (Optional, if using local uploads) Max file size in bytes (e.g., `5242880` for 5MB).

### Running the Server

Development mode (with Nodemon for auto-restarts):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The API will be available at `http://localhost:PORT` (e.g., `http://localhost:5000`).

### Running Tests

Execute the test suite (using Jest):

```bash
npm test
```

## API Documentation

_Note: This provides a high-level overview. Refer to the route definitions (`src/routes/`) and controllers (`src/controllers/`) for detailed implementation._

### General Notes

-   **Base Path**: All API routes are prefixed with `/api`.
-   **Authentication**: Most routes require a valid JWT access token sent as a `Bearer` token in the `Authorization` header.
-   **Error Handling**: Consistent JSON error responses are provided (see existing README section for structure).
-   **Validation**: Input validation is performed using `express-validator`.

### REST API Endpoints

#### Authentication (`/api/auth`)

-   `POST /register`: Register a new user.
-   `POST /login`: Login and receive JWT access/refresh tokens.
-   `POST /refresh`: Obtain a new access token using a valid refresh token.
-   `GET /me`: Get the authenticated user's profile details.
-   `POST /logout`: (Informational - handled client-side by clearing tokens).

#### Users (`/api/users`)

-   `GET /bookmarks`: Get authenticated user's bookmarked tweets.
-   `PATCH /profile`: Update authenticated user's profile (name, bio, location, website). Requires `multipart/form-data` if uploading avatar/header.
-   `GET /recommendations/paginated`: Get paginated list of user suggestions (for "Who to Follow" page).
-   `GET /:username`: Get user profile by username.
-   `POST /:username/follow`: Follow a user.
-   `DELETE /:username/follow`: Unfollow a user.
-   `GET /:username/followers`: Get list of followers for a user.
-   `GET /:username/following`: Get list of users a specific user is following.

#### Tweets (`/api/tweets`)

-   `POST /`: Create a new tweet (supports text, media, `inReplyTo`, `quotedTweet`).
-   `GET /timeline`: Get the authenticated user's home timeline (paginated).
-   `GET /user/:username`: Get tweets by a specific user (paginated).
-   `GET /user/:username/replies`: Get replies by a specific user (paginated).
-   `GET /user/:username/likes`: Get tweets liked by a specific user (paginated).
-   `GET /:id`: Get a single tweet by its ID.
-   `GET /:id/thread`: Get a tweet and its full reply thread.
-   `DELETE /:id`: Delete a tweet (author only).
-   `POST /:id/like`: Like a tweet.
-   `DELETE /:id/like`: Unlike a tweet.
-   `POST /:id/retweet`: Retweet a tweet.
-   `DELETE /:id/retweet`: Undo a retweet.
-   `POST /:id/bookmark`: Bookmark a tweet.
-   `DELETE /:id/bookmark`: Remove a bookmark.

#### Search (`/api/search`)

-   `GET /?q={query}&type={type}&page={page}&limit={limit}`: Search across users, tweets, and hashtags.

#### Trends (`/api/trends`)

-   `GET /`: Get currently trending hashtags/topics.
-   `GET /suggestions`: Get "who to follow" suggestions (for sidebar).
-   `GET /hashtag/:hashtag`: Get tweets associated with a specific hashtag (paginated).

#### Uploads (`/api/upload`)

-   `POST /avatar`: Upload user avatar image (requires auth).
-   `POST /header`: Upload user header image (requires auth).
-   `POST /tweet`: (Potentially deprecated - check tweet creation endpoint) Upload media for a tweet.

### WebSocket Events (Socket.IO)

The server emits and listens for events for real-time updates. Authentication is handled via middleware upon connection.

**Emitted Events (Server -> Client):**

-   `tweet:new` (payload: `Tweet` object): Emitted when a new tweet is created that should appear on connected clients' timelines.
-   `user:follow` (payload: `{ followerId: string, followingId: string }`): Emitted when a user follows another.
-   `user:unfollow` (payload: `{ followerId: string, followingId: string }`): Emitted when a user unfollows another.

**Listened Events (Client -> Server):**

-   _(Currently, primary real-time communication is server -> client based on actions like tweet creation/follow.)_

## Project Structure

-   `src/`: Main source code directory.
    -   `config/`: Configuration files (database, passport).
    -   `controllers/`: Request handlers logic.
    -   `middleware/`: Custom Express middleware (auth, validation, error handling).
    -   `models/`: Mongoose data models.
    -   `routes/`: API route definitions.
    -   `services/`: Business logic separated from controllers (optional layer).
    -   `socket/`: WebSocket (Socket.IO) setup and event handlers.
    -   `utils/`: Utility functions.
    -   `index.js`: Server entry point.
-   `tests/`: Automated tests (Jest/Supertest).
-   `uploads/`: Default directory for local file uploads (if configured).
-   `.env`: Environment variables (ignored by Git).
-   `.env.example`: Example environment variables file.
-   `package.json`: Project dependencies and scripts.

## License

MIT
