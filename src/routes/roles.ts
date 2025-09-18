import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { RoleService } from '../services/RoleService';
import { UserRepository } from '../repositories/UserRepository';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest, validateParams, commonSchemas } from '../middleware/validation';
import { UserRole } from '../types';

const router = Router();
const userRepository = new UserRepository();

// Validation schemas
const assignRoleSchema = Joi.object({
  userId: commonSchemas.uuid,
  role: commonSchemas.userRole,
});

const userIdParamSchema = Joi.object({
  userId: commonSchemas.uuid,
});

/**
 * @route GET /roles
 * @desc Get all available roles with descriptions
 * @access Private (Admin, Supervisor)
 */
router.get('/',
  authenticate,
  authorize(['admin', 'supervisor']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = RoleService.getAllRoles().map(role => ({
        role,
        description: RoleService.getRoleDescription(role),
        capabilities: RoleService.getRoleCapabilities(role),
        level: RoleService.getRoleLevel(role),
      }));

      res.json({
        success: true,
        data: roles,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve roles',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /roles/:role/permissions
 * @desc Get permissions for a specific role
 * @access Private (Admin, Supervisor)
 */
router.get('/:role/permissions',
  authenticate,
  authorize(['admin', 'supervisor']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      
      if (!RoleService.getAllRoles().includes(role as UserRole)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const permissions = RoleService.getRolePermissions(role as UserRole);

      res.json({
        success: true,
        data: {
          role,
          permissions,
          description: RoleService.getRoleDescription(role as UserRole),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get role permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve role permissions',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route POST /roles/assign
 * @desc Assign role to user
 * @access Private (Admin, Supervisor with restrictions)
 */
router.post('/assign',
  authenticate,
  validateRequest(assignRoleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, role } = req.body;
      const assignerRole = req.userRole!;

      // Validate role assignment permissions
      const validation = RoleService.validateRoleAssignment(assignerRole, role);
      if (!validation.valid) {
        res.status(403).json({
          success: false,
          message: validation.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Prevent self-role modification for non-admins
      if (req.userId === userId && assignerRole !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Cannot modify your own role',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update user role
      const updatedUser = await userRepository.update(userId, { role });

      res.json({
        success: true,
        data: updatedUser,
        message: `Role assigned successfully to ${role}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Assign role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign role',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /roles/check-permission
 * @desc Check if current user has specific permission
 * @access Private
 */
router.get('/check-permission',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { resource, action } = req.query;
      
      if (!resource || !action) {
        res.status(400).json({
          success: false,
          message: 'Resource and action parameters are required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const hasPermission = RoleService.hasPermission(
        req.userRole!,
        resource as string,
        action as string
      );

      res.json({
        success: true,
        data: {
          hasPermission,
          role: req.userRole,
          resource,
          action,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Check permission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check permission',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /roles/user/:userId/permissions
 * @desc Get effective permissions for a user
 * @access Private (Admin, Supervisor, or own user)
 */
router.get('/user/:userId/permissions',
  authenticate,
  validateParams(userIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

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

      const permissions = RoleService.getRolePermissions(user.role);
      const capabilities = RoleService.getRoleCapabilities(user.role);

      res.json({
        success: true,
        data: {
          userId,
          role: user.role,
          permissions,
          capabilities,
          roleLevel: RoleService.getRoleLevel(user.role),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get user permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user permissions',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /roles/hierarchy
 * @desc Get role hierarchy information
 * @access Private (Admin, Supervisor)
 */
router.get('/hierarchy',
  authenticate,
  authorize(['admin', 'supervisor']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const hierarchy = RoleService.getAllRoles().map(role => ({
        role,
        level: RoleService.getRoleLevel(role),
        description: RoleService.getRoleDescription(role),
        canManage: RoleService.getAllRoles().filter(targetRole => 
          RoleService.canManageRole(role, targetRole)
        ),
      })).sort((a, b) => b.level - a.level);

      res.json({
        success: true,
        data: hierarchy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get role hierarchy error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve role hierarchy',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route GET /roles/allowed-fields/:resource
 * @desc Get allowed update fields for a resource based on user role
 * @access Private
 */
router.get('/allowed-fields/:resource',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { resource } = req.params;
      const { isOwnResource } = req.query;

      const allowedFields = RoleService.getAllowedUpdateFields(
        req.userRole!,
        resource,
        isOwnResource === 'true'
      );

      res.json({
        success: true,
        data: {
          resource,
          role: req.userRole,
          isOwnResource: isOwnResource === 'true',
          allowedFields,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Get allowed fields error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve allowed fields',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;