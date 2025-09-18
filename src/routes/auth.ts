import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService } from '../services/AuthService';
import { 
  LoginRequest, 
  RegisterRequest, 
  PasswordResetRequest, 
  PasswordResetConfirm,
  ChangePasswordRequest,
  UserRole 
} from '../types';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();
const authService = new AuthService();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    }),
  role: Joi.string().valid('admin', 'supervisor', 'inspector').required(),
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  inspectorId: Joi.string().uuid().optional(),
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required(),
});

const passwordResetConfirmSchema = Joi.object({
  token: Joi.string().uuid().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * @route POST /auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', validateRequest(loginSchema), async (req: Request, res: Response) => {
  try {
    const loginData: LoginRequest = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    const authResponse = await authService.login(loginData, ipAddress, userAgent);

    res.json({
      success: true,
      data: authResponse,
      message: 'Login successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Login failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /auth/register
 * @desc Register new user (Admin only)
 * @access Private (Admin)
 */
router.post('/register', 
  authenticate,
  authorize(['admin']),
  validateRequest(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const registerData: RegisterRequest = req.body;
      const authResponse = await authService.register(registerData);

      res.status(201).json({
        success: true,
        data: authResponse,
        message: 'User registered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route POST /auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', validateRequest(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: tokens,
      message: 'Token refreshed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Token refresh failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.user?.sessionId;

    await authService.logout(userId, sessionId);

    res.json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /auth/password-reset/request
 * @desc Request password reset
 * @access Public
 */
router.post('/password-reset/request', 
  validateRequest(passwordResetRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const resetRequest: PasswordResetRequest = req.body;
      await authService.requestPasswordReset(resetRequest);

      res.json({
        success: true,
        message: 'Password reset instructions sent to email',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route POST /auth/password-reset/confirm
 * @desc Confirm password reset
 * @access Public
 */
router.post('/password-reset/confirm',
  validateRequest(passwordResetConfirmSchema),
  async (req: Request, res: Response) => {
    try {
      const resetConfirm: PasswordResetConfirm = req.body;
      await authService.confirmPasswordReset(resetConfirm);

      res.json({
        success: true,
        message: 'Password reset successful',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Password reset confirm error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password reset failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route POST /auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const changeRequest: ChangePasswordRequest = req.body;
      
      await authService.changePassword(userId, changeRequest);

      res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { user, profile } = await authService.getUserWithProfile(userId);

    res.json({
      success: true,
      data: { user, profile },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route PUT /auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.userId;
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const profile = await authService.updateProfile(userId, updates);

    res.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Profile update failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /auth/verify
 * @desc Verify token validity
 * @access Private
 */
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        valid: true,
        user: req.user,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token verification failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;