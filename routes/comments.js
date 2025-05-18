const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Create a comment
router.post('/:postId', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId)
            .populate('user', 'username');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const newComment = new Comment({
            user: req.user._id,
            post: req.params.postId,
            content: req.body.content
        });

        const comment = await newComment.save();
        await comment.populate('user', 'username profilePicture');

        // Add comment to post
        post.comments.push(comment._id);
        await post.save();

        // Create notification if the post owner is not the one commenting
        if (post.user._id.toString() !== req.user._id.toString()) {
            const content = `"${post.content.substring(0, 30)}${post.content.length > 30 ? '...' : ''}" commented by ${req.user.username}: "${req.body.content.substring(0, 30)}${req.body.content.length > 30 ? '...' : ''}"`;

            const notification = new Notification({
                recipient: post.user._id,
                sender: req.user._id,
                post: post._id,
                type: 'comment',
                content
            });

            await notification.save();
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get comments for a post - No auth required
router.get('/post/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.postId })
            .sort({ createdAt: -1 })
            .populate('user', 'username profilePicture');

        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update comment
router.put('/:id', auth, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        comment.content = req.body.content;
        await comment.save();
        await comment.populate('user', 'username profilePicture');

        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete comment
router.delete('/:id', auth, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Remove comment from post
        const post = await Post.findById(comment.post);
        post.comments = post.comments.filter(
            commentId => commentId.toString() !== comment._id.toString()
        );
        await post.save();

        await comment.remove();
        res.json({ message: 'Comment removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Like/Unlike comment
router.put('/like/:id', auth, async (req, res) => {
    try {
        const userId = req.user._id;

        // First check if the comment exists
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user has already liked the comment
        const hasLiked = comment.likes.includes(userId);

        // Use findOneAndUpdate with atomic operators
        const updatedComment = await Comment.findOneAndUpdate(
            { _id: req.params.id },
            hasLiked
                ? { $pull: { likes: userId } }  // Remove like if already liked
                : { $addToSet: { likes: userId } },  // Add like if not liked
            {
                new: true,
                runValidators: true
            }
        ).populate('user', 'username profilePicture');

        // Log the operation
        console.log('Like operation:', {
            commentId: req.params.id,
            userId: userId,
            action: hasLiked ? 'unliked' : 'liked',
            likesCount: updatedComment.likes.length
        });

        res.json(updatedComment);
    } catch (error) {
        console.error('Error in like comment:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router; 