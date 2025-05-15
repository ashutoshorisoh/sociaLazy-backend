# Devscovery - Social Media Platform for Developers

A full-stack social media platform built for developers to connect, share ideas, and collaborate. Features include user authentication, post creation, likes, comments, and real-time notifications. The platform supports trending posts, user profiles, and a robust search functionality across posts and users.

Built with Node.js, Express, MongoDB, and JWT authentication, this platform provides a secure and scalable solution for developer communities. The API is RESTful and follows best practices for authentication, data validation, and error handling.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication Endpoints](#1-authentication-endpoints)
  - [User Endpoints](#2-user-endpoints)
  - [Post Endpoints](#3-post-endpoints)
  - [Comment Endpoints](#4-comment-endpoints)
- [Error Responses](#error-responses)
- [Notes](#notes)

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer your_jwt_token
```

## API Endpoints

### 1. Authentication Endpoints

#### Register User

```
POST /auth/register
```

Request Body:

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

#### Login User

```
POST /auth/login
```

Request Body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

#### Get Current User

```
GET /auth/me
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response:

```json
{
  "id": "user_id",
  "username": "johndoe",
  "email": "john@example.com",
  "profilePicture": "url_to_picture",
  "bio": "user_bio",
  "followers": [],
  "following": []
}
```

### 2. User Endpoints

#### Get User Profile

```
GET /users/:id
```

Response:

```json
{
  "id": "user_id",
  "username": "johndoe",
  "email": "john@example.com",
  "profilePicture": "url_to_picture",
  "bio": "user_bio",
  "followers": [
    {
      "id": "follower_id",
      "username": "follower_name",
      "profilePicture": "url_to_picture"
    }
  ],
  "following": [
    {
      "id": "following_id",
      "username": "following_name",
      "profilePicture": "url_to_picture"
    }
  ]
}
```

#### Update User Profile

```
PUT /users/profile
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Request Body:

```json
{
  "bio": "New bio",
  "profilePicture": "new_picture_url"
}
```

Response: Updated user object

#### Follow User

```
POST /users/follow/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response:

```json
{
  "message": "User followed successfully"
}
```

#### Unfollow User

```
POST /users/unfollow/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response:

```json
{
  "message": "User unfollowed successfully"
}
```

#### Search Users

```
GET /users/search/:query
```

Response:

```json
[
  {
    "id": "user_id",
    "username": "username",
    "profilePicture": "url_to_picture",
    "bio": "user_bio"
  }
]
```

### 3. Post Endpoints

#### Create Post

```
POST /posts
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Request Body:

```json
{
  "content": "Post content",
  "image": "optional_image_url"
}
```

Response: Created post object

#### Get All Posts

```
GET /posts?page=1&limit=10
```

Query Parameters:

- `page`: Page number (default: 1)
- `limit`: Posts per page (default: 10)
  Response:

```json
{
  "posts": [
    {
      "id": "post_id",
      "content": "post_content",
      "image": "image_url",
      "user": {
        "id": "user_id",
        "username": "username",
        "profilePicture": "profile_picture_url"
      },
      "likes": ["user_id1", "user_id2"],
      "comments": [
        {
          "id": "comment_id",
          "content": "comment_content",
          "user": {
            "id": "user_id",
            "username": "username"
          }
        }
      ],
      "createdAt": "timestamp"
    }
  ],
  "currentPage": 1,
  "totalPages": 10,
  "totalPosts": 100
}
```

#### Get User's Posts

```
GET /posts/user/:userId
```

Response: Array of posts

#### Get Single Post

```
GET /posts/:id
```

Response: Single post object

#### Update Post

```
PUT /posts/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Request Body:

```json
{
  "content": "Updated content",
  "image": "updated_image_url"
}
```

Response: Updated post object

#### Delete Post

```
DELETE /posts/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response:

```json
{
  "message": "Post removed"
}
```

#### Like/Unlike Post

```
PUT /posts/like/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response: Updated post object

### 4. Comment Endpoints

#### Create Comment

```
POST /comments/:postId
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Request Body:

```json
{
  "content": "Comment content"
}
```

Response: Created comment object

#### Get Comments for Post

```
GET /comments/post/:postId
```

Response: Array of comments

#### Update Comment

```
PUT /comments/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Request Body:

```json
{
  "content": "Updated comment content"
}
```

Response: Updated comment object

#### Delete Comment

```
DELETE /comments/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response:

```json
{
  "message": "Comment removed"
}
```

#### Like/Unlike Comment

```
PUT /comments/like/:id
```

Headers Required:

```
Authorization: Bearer your_jwt_token
```

Response: Updated comment object

## Error Responses

All endpoints may return these error responses:

```json
{
  "message": "Error message"
}
```

Common status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Server Error

## Notes

1. All timestamps are in ISO format
2. Image URLs should be valid URLs
3. Pagination is available for posts listing
4. Authentication is required for all write operations
5. Public access is allowed for reading posts and user profiles
6. JWT tokens expire after 24 hours

## Setup and Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

4. Start the server:

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Technologies Used

- Node.js
- Express.js
- MongoDB
- JWT Authentication
- bcryptjs for password hashing
- express-validator for input validation
