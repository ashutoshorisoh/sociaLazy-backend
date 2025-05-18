const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// Get user profile
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('followers', 'username profilePicture')
            .populate('following', 'username profilePicture');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { bio, profilePicture } = req.body;
        const user = await User.findById(req.user._id);

        if (bio) user.bio = bio;
        if (profilePicture) user.profilePicture = profilePicture;

        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Follow user
router.post('/follow/:id', auth, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const userToFollow = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (currentUser.following.includes(req.params.id)) {
            return res.status(400).json({ message: 'You are already following this user' });
        }

        await currentUser.updateOne({ $push: { following: req.params.id } });
        await userToFollow.updateOne({ $push: { followers: req.user._id } });

        res.json({ message: 'User followed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Unfollow user
router.post('/unfollow/:id', auth, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot unfollow yourself' });
        }

        const userToUnfollow = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!currentUser.following.includes(req.params.id)) {
            return res.status(400).json({ message: 'You are not following this user' });
        }

        await currentUser.updateOne({ $pull: { following: req.params.id } });
        await userToUnfollow.updateOne({ $pull: { followers: req.user._id } });

        res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Search users
router.get('/search/:query', auth, async (req, res) => {
    try {
        const searchQuery = req.params.query;
        const users = await User.find({
            $or: [
                { username: { $regex: searchQuery, $options: 'i' } },
                { bio: { $regex: searchQuery, $options: 'i' } }
            ]
        }).select('-password');

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get complete user profile with posts
router.get('/profile/:id', async (req, res) => {
    try {
        // Get user profile
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('followers', 'username profilePicture')
            .populate('following', 'username profilePicture');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's posts with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ user: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'username profilePicture')
            .populate({
                path: 'comments',
                populate: {
                    path: 'user',
                    select: 'username profilePicture'
                }
            });

        const totalPosts = await Post.countDocuments({ user: req.params.id });

        // Get user's stats
        const stats = {
            postsCount: totalPosts,
            followersCount: user.followers.length,
            followingCount: user.following.length
        };

        res.json({
            user,
            posts,
            stats,
            currentPage: page,
            totalPages: Math.ceil(totalPosts / limit),
            totalPosts
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user by username
router.delete('/username/:username', auth, async (req, res) => {
    try {
        console.log('============ DELETE USER ROUTE HIT ============');
        console.log('Username to delete:', req.params.username);
        console.log('User ID requesting delete:', req.user._id);

        const user = await User.findOne({ username: req.params.username });
        
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        if (user._id.toString() !== req.user._id.toString()) {
            console.log('Unauthorized delete attempt');
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Delete all posts by this user
        const deletedPosts = await Post.deleteMany({ user: user._id });
        console.log(`Deleted ${deletedPosts.deletedCount} posts`);

        // Remove user from followers and following lists of other users
        const followersUpdate = await User.updateMany(
            { followers: user._id },
            { $pull: { followers: user._id } }
        );
        const followingUpdate = await User.updateMany(
            { following: user._id },
            { $pull: { following: user._id } }
        );
        console.log(`Removed user from ${followersUpdate.modifiedCount} followers lists`);
        console.log(`Removed user from ${followingUpdate.modifiedCount} following lists`);

        // Delete the user
        await user.deleteOne();
        console.log('User successfully deleted');
        console.log('Deleted user details:', {
            userId: user._id,
            username: user.username,
            email: user.email,
            followersCount: user.followers.length,
            followingCount: user.following.length
        });
        console.log('=============================================');

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 