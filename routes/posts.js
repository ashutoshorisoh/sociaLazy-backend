const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Map to store last like/unlike timestamps
const lastLikeAction = new Map();

// Helper function to generate a unique key for user-post combination
const getLikeKey = (userId, postId) => `${userId}-${postId}`;

// Create a post
router.post('/', auth, async (req, res) => {
    try {
        const { content, image } = req.body;
        const newPost = new Post({
            user: req.user._id,
            content,
            image
        });

        const post = await newPost.save();
        await post.populate('user', 'username profilePicture');

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all posts (with pagination) - No auth required
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'username profilePicture')
            .populate('comments');

        const total = await Post.countDocuments();

        res.json({
            posts,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalPosts: total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Search across posts and users
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        // Search in posts
        const posts = await Post.find({
            $or: [
                { content: { $regex: query, $options: 'i' } }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('user', 'username profilePicture')
            .limit(10);

        // Search in users
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { bio: { $regex: query, $options: 'i' } }
            ]
        })
            .select('username profilePicture bio')
            .limit(10);

        res.json({
            posts,
            users
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's posts - No auth required
router.get('/user/:userId', async (req, res) => {
    try {
        const posts = await Post.find({ user: req.params.userId })
            .sort({ createdAt: -1 })
            .populate('user', 'username profilePicture')
            .populate('comments');

        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single post - No auth required
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'username profilePicture')
            .populate('comments');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update post
router.put('/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { content, image } = req.body;
        if (content) post.content = content;
        if (image) post.image = image;

        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
    try {
        console.log('============ DELETE POST ROUTE HIT ============');
        console.log('Post ID to delete:', req.params.id);
        console.log('User ID requesting delete:', req.user._id);

        const post = await Post.findById(req.params.id);

        if (!post) {
            console.log('Post not found');
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            console.log('Unauthorized delete attempt');
            return res.status(401).json({ message: 'Not authorized' });
        }

        await Post.deleteOne({ _id: post._id });
        console.log('Post successfully deleted');
        console.log('Deleted post details:', {
            postId: post._id,
            userId: post.user,
            content: post.content.substring(0, 50) + '...',
            likesCount: post.likes.length,
            commentsCount: post.comments.length
        });
        console.log('=============================================');

        res.json({ message: 'Post removed' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Like/Unlike post
router.put('/like/:id', auth, async (req, res) => {
    console.log('============ LIKE/UNLIKE ROUTE HIT ============');
    console.log('Request received for post:', req.params.id);
    console.log('User ID:', req.user._id);
    console.log('=============================================');
    
    try {
        const userId = req.user._id;

        // First check if the post exists
        const post = await Post.findById(req.params.id)
            .populate('user', 'username');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user has already liked the post
        const hasLiked = post.likes.includes(userId);

        // Use findOneAndUpdate with atomic operators
        const updatedPost = await Post.findOneAndUpdate(
            { _id: req.params.id },
            hasLiked
                ? { $pull: { likes: userId } }  // Remove like if already liked
                : { $addToSet: { likes: userId } },  // Add like if not liked
            {
                new: true,
                runValidators: true
            }
        ).populate('user', 'username profilePicture');

        // Create notification if the post owner is not the one liking and it's a new like
        if (!hasLiked && post.user._id.toString() !== userId.toString()) {
            const content = `"${post.content.substring(0, 30)}${post.content.length > 30 ? '...' : ''}" liked by ${req.user.username}`;

            const notification = new Notification({
                recipient: post.user._id,
                sender: userId,
                post: post._id,
                type: 'like',
                content
            });

            await notification.save();
        }

        // Log the operation
        console.log('==================== LIKE OPERATION ====================');
        console.log('Post ID:', req.params.id);
        console.log('User ID:', userId);
        console.log('Action:', hasLiked ? 'UNLIKED' : 'LIKED');
        console.log('Likes Count:', updatedPost.likes.length);
        console.log('Updated Post:', JSON.stringify(updatedPost, null, 2));
        console.log('=====================================================');

        res.json(updatedPost);
    } catch (error) {
        console.error('Error in like post:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get trending posts
router.get('/trending', async (req, res) => {
    try {
        console.log('Fetching posts for trending...');
        
        // Get all posts first
        const posts = await Post.find()
            .populate('user', 'username profilePicture')
            .populate('comments');
        
        console.log(`Found ${posts.length} posts`);

        // Sort posts by number of likes
        const trendingPosts = posts
            .sort((a, b) => b.likes.length - a.likes.length)
            .slice(0, 10);
        
        console.log(`Returning ${trendingPosts.length} trending posts`);

        res.json({
            trendingPosts,
            lastUpdated: new Date()
        });

    } catch (error) {
        console.error('Detailed error in trending endpoint:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

module.exports = router; 