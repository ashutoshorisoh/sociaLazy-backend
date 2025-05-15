const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

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
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await post.remove();
        res.json({ message: 'Post removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Like/Unlike post
router.put('/like/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'username');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const likeIndex = post.likes.indexOf(req.user._id);
        if (likeIndex === -1) {
            // Add like
            post.likes.push(req.user._id);

            // Create notification if the post owner is not the one liking
            if (post.user._id.toString() !== req.user._id.toString()) {
                const content = `"${post.content.substring(0, 30)}${post.content.length > 30 ? '...' : ''}" liked by ${req.user.username}`;

                const notification = new Notification({
                    recipient: post.user._id,
                    sender: req.user._id,
                    post: post._id,
                    type: 'like',
                    content
                });

                await notification.save();
            }
        } else {
            // Remove like
            post.likes.splice(likeIndex, 1);
        }

        await post.save();
        res.json(post);
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