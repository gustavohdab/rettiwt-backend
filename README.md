# Twitter Clone Backend API

A RESTful API for the Twitter Clone application built with Node.js, Express, MongoDB, and JWT authentication.

## Features

-   User authentication with JWT
-   User profile management
-   Tweet creation and interaction (like, retweet, reply)
-   Timeline and feed generation
-   Follow/unfollow functionality

## Tech Stack

-   **Node.js** and **Express** for the server
-   **MongoDB** with Mongoose for database
-   **JWT** for authentication
-   **express-validator** for input validation
-   **Jest** for testing

## Getting Started

### Prerequisites

-   Node.js 18+
-   MongoDB Connection String

### Installation

1. Clone the repository
2. Navigate to the backend directory:
    ```
    cd backend
    ```
3. Install dependencies:
    ```
    npm install
    ```
4. Copy the environment variables file:
    ```
    cp .env.example .env
    ```
5. Fill in the required environment variables in the `.env` file. Ensure you provide a valid `MONGODB_URI` and strong, unique secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`. The `.env.example` file documents all required variables, including those for file uploads (`UPLOAD_DIR`, `MAX_FILE_SIZE`).

### Environment Variables

Create a `.env` file in the `backend` root directory based on `.env.example`. The following variables are required:

-   `PORT`: The port the server will run on (e.g., `5000`).
-   `NODE_ENV`: Environment mode (`development` or `production`). Set to `production` for deployments.
-   `MONGODB_URI`: Your MongoDB connection string (e.g., `mongodb+srv://user:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority`).
-   `JWT_SECRET`: A strong, unique secret key for signing JWT access tokens.
-   `JWT_EXPIRES_IN`: Expiration time for access tokens (e.g., `15m`, `1h`, `7d`).
-   `JWT_REFRESH_SECRET`: A strong, unique secret key for signing JWT refresh tokens. Must be different from `JWT_SECRET`.
-   `JWT_REFRESH_EXPIRES_IN`: Expiration time for refresh tokens (e.g., `30d`, `60d`).
-   `FRONTEND_URL`: The URL of your frontend application for CORS configuration (e.g., `http://localhost:3000` or your deployed frontend URL).
-   `UPLOAD_DIR`: Directory where uploaded files will be stored relative to the backend root (e.g., `uploads`). Ensure this directory exists and the server has write permissions.
-   `MAX_FILE_SIZE`: Maximum allowed file size for uploads in bytes (e.g., `5242880` for 5MB).

### Running the Server

Development mode (with hot-reloading):

```
npm run dev
```

Production mode:

```
npm start
```

### Running Tests

```
npm test
```

## API Documentation

_Note: For detailed request/response examples, refer to API testing tools or frontend implementation._

### General Notes

-   **Authentication**: Protected routes require a `Bearer` token in the `Authorization` header.
-   **Error Handling**:
    -   Standard errors return a JSON object: `{ "status": "error", "message": "Error description" }`.
    -   Validation errors (status `422`) include an additional `errors` array: `{ "status": "error", "message": "Validation failed", "errors": [ { "field": "fieldName", "message": "Specific validation error" }, ... ] }`.
    -   Authentication/Authorization errors typically return `401` or `403`.
    -   Server errors return `500`.

### Authentication Endpoints

-   `POST /api/auth/register`: Register a new user.
-   `POST /api/auth/login`: Login user.
-   `POST /api/auth/refresh`: Refresh access token using a refresh token.
-   `GET /api/auth/me`: Get current authenticated user's details.
-   `POST /api/auth/logout`: (Informational - Logout is client-side token removal).

### User Endpoints

-   `GET /api/users/bookmarks`: Get current user's bookmarked tweets.
-   `PATCH /api/users/profile`: Update current user's profile.
-   `GET /api/users/:username`: Get user profile by username.
-   `POST /api/users/:username/follow`: Follow a user.
-   `DELETE /api/users/:username/follow`: Unfollow a user.
-   `GET /api/users/:username/followers`: Get user's followers.
-   `GET /api/users/:username/following`: Get users the specified user is following.

### Tweet Endpoints

-   `POST /api/tweets`: Create a new tweet (can include `inReplyTo` or `quotedTweet` IDs).
-   `GET /api/tweets/timeline`: Get the authenticated user's timeline.
-   `GET /api/tweets/user/:username`: Get tweets by a specific user.
-   `GET /api/tweets/user/:username/replies`: Get replies by a specific user.
-   `GET /api/tweets/user/:username/likes`: Get tweets liked by a specific user.
-   `GET /api/tweets/:id`: Get a specific tweet by ID.
-   `GET /api/tweets/:id/thread`: Get a tweet and its replies/thread.
-   `DELETE /api/tweets/:id`: Delete a tweet (author only).
-   `POST /api/tweets/:id/like`: Like a tweet.
-   `DELETE /api/tweets/:id/like`: Unlike a tweet.
-   `POST /api/tweets/:id/retweet`: Retweet a tweet.
-   `DELETE /api/tweets/:id/retweet`: Undo a retweet.
-   `POST /api/tweets/:id/bookmark`: Bookmark a tweet.
-   `DELETE /api/tweets/:id/bookmark`: Remove a bookmark.

### Search Endpoints

-   `GET /api/search?q={query}&type={type}&page={page}&limit={limit}`: Search for users, tweets, or hashtags.
    -   `q`: Search query (required).
    -   `type`: Optional filter (`users`, `tweets`, `hashtags`, `all`). If omitted or `all`, searches across all types.
    -   `page`, `limit`: Optional pagination. Applies primarily when a specific `type` is requested. When `type=all`, a limited number of results (e.g., 5) per category are returned, and pagination reflects the total count across all types.

### Trends Endpoints

-   `GET /api/trends`: Get trending topics/hashtags.
-   `GET /api/trends/suggestions`: Get "who to follow" suggestions.

### Upload Endpoints

-   `POST /api/upload/avatar`: Upload user avatar image.
-   `POST /api/upload/header`: Upload user header image.
-   `POST /api/upload/tweet`: Upload media for a tweet (images/GIFs).

## Deployment

This application uses a `Procfile` (`web: npm start`) which makes it suitable for deployment on platforms like Heroku, Render, or similar PaaS providers that support Node.js and Procfiles.

**General Steps:**

1.  **Set Environment Variables:** Configure all required environment variables (listed above) in your deployment environment's settings panel. Crucially, set `NODE_ENV=production`. Ensure secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) are strong and kept confidential.
2.  **Database:** Ensure your deployed application can connect to your MongoDB instance (e.g., using MongoDB Atlas and whitelisting the deployment service's IP address if necessary).
3.  **Build Step:** Depending on the platform, a build step might be required. Typically, `npm install --production` (or `npm ci`) is run to install dependencies.
4.  **Start Command:** The platform will use the `Procfile` (or a configured start command) to run `npm start`.
5.  **CORS:** Ensure the `FRONTEND_URL` environment variable is set to the correct URL of your deployed frontend application.
6.  **File Uploads:** The `UPLOAD_DIR` needs to be writable by the server process. Some platforms might require specific configuration for persistent file storage, or you might consider using a cloud storage service (like AWS S3, Google Cloud Storage) instead of the local filesystem for production uploads.

## License

MIT
