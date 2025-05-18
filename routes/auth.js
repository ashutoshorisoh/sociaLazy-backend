const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const Post = require('../models/Post');

// Register user
router.post('/register', [
    body('username')
        .trim()
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores')
        .custom(value => {
            // Check for potentially harmful patterns
            const harmfulPatterns = [
                /console\.log/i,
                /alert\(/i,
                /eval\(/i,
                /script/i,
                /function/i,
                /document\./i,
                /window\./i,
                /localStorage/i,
                /sessionStorage/i,
                /cookie/i,
                /fetch\(/i,
                /axios/i,
                /http/i,
                /https/i,
                /\.js/i,
                /\.php/i,
                /\.html/i,
                /\.css/i,
                /\.sql/i,
                /\.env/i,
                /process\./i,
                /require\(/i,
                /import/i,
                /export/i,
                /module\./i,
                /__dirname/i,
                /__filename/i
            ];

            if (harmfulPatterns.some(pattern => pattern.test(value))) {
                throw new Error('Username contains unacceptable content');
            }
            return true;
        }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        console.log('============ REGISTER ROUTE HIT ============');
        console.log('Request body:', {
            username: req.body.username,
            email: req.body.email,
            password: '***' // Don't log actual password
        });

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: errors.array().map(err => ({
                    field: err.param,
                    message: err.msg
                }))
            });
        }

        const { username, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (user) {
            console.log('User already exists:', {
                existingEmail: user.email === email,
                existingUsername: user.username === username
            });
            return res.status(400).json({ 
                success: false,
                message: 'User already exists',
                error: 'USER_EXISTS'
            });
        }

        // Create new user
        user = new User({
            username,
            email,
            password
        });

        await user.save();
        console.log('New user created:', {
            userId: user._id,
            username: user.username,
            email: user.email
        });

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        console.log('JWT token created');

        console.log('Registration successful');
        console.log('=============================================');

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: 'REGISTRATION_FAILED'
        });
    }
});

// Login user
router.post('/login', [
    body(['login', 'username', 'email']).optional().trim(),
    body('password').exists()
], async (req, res) => {
    try {
        console.log('============ LOGIN ROUTE HIT ============');
        console.log('Request body:', {
            login: req.body.login,
            username: req.body.username,
            email: req.body.email,
            password: '***' // Don't log actual password
        });

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { login, username, email, password } = req.body;
        
        // Use whichever identifier is provided
        const identifier = login || username || email;
        
        if (!identifier) {
            console.log('No identifier provided');
            return res.status(400).json({ message: 'Please provide username, email, or login' });
        }

        console.log('Attempting login with identifier:', identifier);

        // Check if user exists with either email or username
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });

        if (!user) {
            console.log('User not found');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('User found:', {
            userId: user._id,
            username: user.username,
            email: user.email
        });

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Invalid password');
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('Password verified');

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        console.log('JWT token created');

        console.log('Login successful');
        console.log('=============================================');

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: 'LOGIN_FAILED'
        });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        // Get user profile with followers and following
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('followers', 'username profilePicture')
            .populate('following', 'username profilePicture');

        // Get user's posts with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ user: req.user._id })
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

        const totalPosts = await Post.countDocuments({ user: req.user._id });

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

// Check if current user is following another user
router.get('/following/:userId', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const targetUser = await User.findById(req.params.userId);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isFollowing = currentUser.following.includes(req.params.userId);

        res.json({
            isFollowing,
            currentUserId: currentUser._id,
            targetUserId: targetUser._id
        });
    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 