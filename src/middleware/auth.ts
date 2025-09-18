import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UserRole, JWTPayload } from '../types';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Access token required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const payload = await this.authService.verifyToken(token);
        
        // Add user information to request
        req.user = payload;
        req.userId = payload.userId;
        req.userRole = payload.role;

        next();
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authentication',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Middleware to authorize specific roles
   */
  authorize = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || !req.userRole) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!allowedRoles.includes(req.userRole)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check specific permissions
   */
  requirePermission = (resource: string, action: string, context?: Record<string, any>) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || !req.userRole) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { RoleService } = require('../services/RoleService');
      const hasPermission = RoleService.hasPermission(req.userRole, resource, action, context);
      
      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: `Permission denied for ${action} on ${resource}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware for optional authentication (doesn't fail if no token)
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const payload = await this.authService.verifyToken(token);
          req.user = payload;
          req.userId = payload.userId;
          req.userRole = payload.role;
        } catch (error) {
          // Token is invalid, but we don't fail the request
          console.warn('Invalid token in optional auth:', error);
        }
      }

      next();
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      next(); // Continue without authentication
    }
  };

  /**
   * Middleware to ensure user can only access their own resources
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user || !req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
      
      // Admin can access any resource
      if (req.userRole === 'admin') {
        next();
        return;
      }

      // User can only access their own resources
      if (req.userId !== resourceUserId) {
        res.status(403).json({
          success: false,
          message: 'Access denied: can only access your own resources',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if user is inspector and can access specific inspector resources
   */
  requireInspectorAccess = (inspectorIdParam: string = 'inspectorId') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user || !req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const inspectorId = req.params[inspectorIdParam] || req.body[inspectorIdParam];
      
      // Admin and supervisor can access any inspector resource
      if (req.userRole === 'admin' || req.userRole === 'supervisor') {
        next();
        return;
      }

      // Inspector can only access their own resources
      if (req.userRole === 'inspector') {
        try {
          const { profile } = await this.authService.getUserWithProfile(req.userId);
          
          if (!profile || profile.inspectorId !== inspectorId) {
            res.status(403).json({
              success: false,
              message: 'Access denied: can only access your own inspector resources',
              timestamp: new Date().toISOString(),
            });
            return;
          }

          next();
        } catch (error) {
          console.error('Error checking inspector access:', error);
          res.status(500).json({
            success: false,
            message: 'Error verifying inspector access',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          timestamp: new Date().toISOString(),
        });
      }
    };
  };
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

// Export middleware functions
export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const requirePermission = authMiddleware.requirePermission;
export const optionalAuth = authMiddleware.optionalAuth;
export const requireOwnership = authMiddleware.requireOwnership;
export const requireInspectorAccess = authMiddleware.requireInspectorAccess;