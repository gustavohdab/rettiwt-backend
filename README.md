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
-   **Zod** for validation
-   **Jest** for testing

## Getting Started

### Prerequisites

-   Node.js 18+
-   MongoDB

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
5. Fill in the required environment variables in the `.env` file

### Running the Server

Development mode:

```
npm run dev
```

Production mode:

```
npm start
```

## API Documentation

### Authentication

#### Register a new user

```
POST /api/auth/register
```

Request body:

```json
{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "name": "John Doe"
}
```

#### Login

```
POST /api/auth/login
```

Request body:

```json
{
    "usernameOrEmail": "johndoe",
    "password": "password123"
}
```

#### Refresh token

```
POST /api/auth/refresh
```

Request body:

```json
{
    "refreshToken": "your-refresh-token"
}
```

#### Get current user

```
GET /api/auth/me
```

Headers:

```
Authorization: Bearer your-access-token
```

### Users

#### Get user profile

```
GET /api/users/:username
```

#### Update user profile

```
PATCH /api/users/profile
```

Headers:

```
Authorization: Bearer your-access-token
```

Request body:

```json
{
    "name": "New Name",
    "bio": "New bio",
    "location": "New location",
    "website": "https://example.com"
}
```

#### Follow a user

```
POST /api/users/:username/follow
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Unfollow a user

```
DELETE /api/users/:username/follow
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Get user followers

```
GET /api/users/:username/followers
```

#### Get user following

```
GET /api/users/:username/following
```

### Tweets

#### Create a tweet

```
POST /api/tweets
```

Headers:

```
Authorization: Bearer your-access-token
```

Request body:

```json
{
    "content": "Hello world!",
    "media": [
        {
            "type": "image",
            "url": "https://example.com/image.jpg",
            "altText": "Example image"
        }
    ],
    "quotedTweetId": "optional-tweet-id",
    "inReplyToId": "optional-tweet-id"
}
```

#### Get a tweet

```
GET /api/tweets/:id
```

#### Delete a tweet

```
DELETE /api/tweets/:id
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Like a tweet

```
POST /api/tweets/:id/like
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Unlike a tweet

```
DELETE /api/tweets/:id/like
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Retweet a tweet

```
POST /api/tweets/:id/retweet
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Undo retweet

```
DELETE /api/tweets/:id/retweet
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Get user timeline

```
GET /api/tweets/timeline?page=1&limit=10
```

Headers:

```
Authorization: Bearer your-access-token
```

#### Get user tweets

```
GET /api/tweets/user/:username?page=1&limit=10
```

#### Get user replies

```
GET /api/tweets/user/:username/replies?page=1&limit=10
```

## Testing

Run tests:

```
npm test
```

## License

MIT
