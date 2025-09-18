import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { UserRepository } from '../repositories/UserRepository';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import { authenticate, authorize, requireOwnership } from '../middleware/auth';
import { validateRequest, validateQuery, validateParams, commonSchemas } from '../middleware/validation';
import { UserRole } from '../types';

const router = Router();
const userRepository = new UserRepository();
const userProfileRepository = new UserProfileRepository();

// Validation schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  role: commonSchemas.userRole.optional(),
  isActive: Joi.boolean().optional(),
});

const updateUserSchema = Joi.object({
  email: commonSchemas.email.optional(),
  role: commonSchemas.userRole.optional(),
  isActive: Joi.boolean().optional(),
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: commonSchemas.phone,
  avatarUrl: Joi.string().uri().optional(),
  preferences: Joi.object().optional(),
  inspectorId: commonSchemas.optionalUuid,
});

const userIdParamSchema = Joi.object({
  userId: commonSchemas.uuid,
});

/**
 * @route GET /users
 * @desc Get all users (Admin and Supervisor only)
 * @access Private (Admin, Supervisor)
 */
router.get('/',
  authenticate,
  authorize(['admin', 'supervisor']),
  validateQuery(getUsersQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, role, isActive } = req.query as any;
      
      const { users, total } = await userRepository.findAll(
        page,
        limit,
        role as UserRole,
        isActive
      );

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /users/:userId
 * @desc Get user by ID
 * @access Private (Admin, Supervisor, or own user)
 */
router.get('/:userId',
  authenticate,
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      // Check if user can access this resource
      if (req.userRole !== 'admin' && req.userRole !== 'supervisor' && req.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const profile = await userProfileRepository.findByUserId(userId);

      res.json({
        success: true,
        data: { user, profile },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route PUT /users/:userId
 * @desc Update user (Admin only)
 * @access Private (Admin)
 */
router.put('/:userId',
  authenticate,
  authorize(['admin']),
  validateParams(userIdParamSchema),
  validateRequest(updateUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if email is being updated and if it already exists
      if (updates.email) {
        const emailExists = await userRepository.emailExists(updates.email, userId);
        if (emailExists) {
          res.status(400).json({
            success: false,
            message: 'Email already exists',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const user = await userRepository.update(userId, updates);

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update user error:', error);
      
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route PUT /users/:userId/profile
 * @desc Update user profile
 * @access Private (Admin, Supervisor, or own user)
 */
router.put('/:userId/profile',
  authenticate,
  validateParams(userIdParamSchema),
  validateRequest(updateProfileSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if user can access this resource
      if (req.userRole !== 'admin' && req.userRole !== 'supervisor' && req.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Find existing profile
      const existingProfile = await userProfileRepository.findByUserId(userId);
      if (!existingProfile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const profile = await userProfileRepository.update(existingProfile.id, updates);

      res.json({
        success: true,
        data: profile,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route DELETE /users/:userId
 * @desc Deactivate user (Admin only)
 * @access Private (Admin)
 */
router.delete('/:userId',
  authenticate,
  authorize(['admin']),
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Prevent admin from deactivating themselves
      if (req.userId === userId) {
        res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await userRepository.delete(userId);

      res.json({
        success: true,
        message: 'User deactivated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Delete user error:', error);
      
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /users/:userId/sessions
 * @desc Get user sessions (Admin or own user)
 * @access Private (Admin or own user)
 */
router.get('/:userId/sessions',
  authenticate,
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if user can access this resource
      if (req.userRole !== 'admin' && req.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // This would require implementing session management in the service
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          sessions: [],
          message: 'Session management not yet implemented',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /users/profiles
 * @desc Get all user profiles with user info (Admin and Supervisor only)
 * @access Private (Admin, Supervisor)
 */
router.get('/profiles/all',
  authenticate,
  authorize(['admin', 'supervisor']),
  validateQuery(getUsersQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { page, limit } = req.query as any;
      
      const { profiles, total } = await userProfileRepository.findAllWithUsers(page, limit);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          profiles,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get profiles error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profiles',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;