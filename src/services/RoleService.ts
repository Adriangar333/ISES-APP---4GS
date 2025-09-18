import { UserRole, Permission, RolePermissions } from '../types';

export class RoleService {
  private static rolePermissions: RolePermissions[] = [
    {
      role: 'admin',
      permissions: [
        { resource: '*', action: '*' }, // Admin has all permissions
      ],
    },
    {
      role: 'supervisor',
      permissions: [
        // Zone management
        { resource: 'zones', action: 'read' },
        { resource: 'zones', action: 'update' },
        
        // Inspector management
        { resource: 'inspectors', action: '*' },
        
        // Route management
        { resource: 'routes', action: '*' },
        
        // Assignment management
        { resource: 'assignments', action: '*' },
        
        // Monitoring and reporting
        { resource: 'monitoring', action: '*' },
        { resource: 'reports', action: '*' },
        { resource: 'exports', action: '*' },
        
        // User management (limited)
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'update', conditions: { role: 'inspector' } },
        
        // Profile management
        { resource: 'profiles', action: '*' },
      ],
    },
    {
      role: 'inspector',
      permissions: [
        // Route access (own routes only)
        { resource: 'routes', action: 'read', conditions: { own: true } },
        { resource: 'routes', action: 'update', conditions: { own: true } },
        
        // Assignment access (own assignments only)
        { resource: 'assignments', action: 'read', conditions: { own: true } },
        
        // Profile management (own profile only)
        { resource: 'profiles', action: 'read', conditions: { own: true } },
        { resource: 'profiles', action: 'update', conditions: { own: true } },
        
        // User management (own user only)
        { resource: 'users', action: 'read', conditions: { own: true } },
        { resource: 'users', action: 'update', conditions: { own: true, fields: ['profile'] } },
        
        // Zone information (read-only)
        { resource: 'zones', action: 'read' },
        
        // Inspector information (read-only, own data)
        { resource: 'inspectors', action: 'read', conditions: { own: true } },
      ],
    },
  ];

  /**
   * Check if a user role has permission for a specific resource and action
   */
  static hasPermission(
    userRole: UserRole,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    const rolePermissions = this.rolePermissions.find(rp => rp.role === userRole);
    
    if (!rolePermissions) {
      return false;
    }

    return rolePermissions.permissions.some(permission => {
      // Check resource match
      const resourceMatch = permission.resource === '*' || permission.resource === resource;
      
      // Check action match
      const actionMatch = permission.action === '*' || permission.action === action;
      
      if (!resourceMatch || !actionMatch) {
        return false;
      }

      // Check conditions if they exist
      if (permission.conditions) {
        if (!context) {
          return false; // Conditions required but no context provided
        }
        return this.checkConditions(permission.conditions, context);
      }

      return true;
    });
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): Permission[] {
    const rolePermissions = this.rolePermissions.find(rp => rp.role === role);
    return rolePermissions ? rolePermissions.permissions : [];
  }

  /**
   * Get all available roles
   */
  static getAllRoles(): UserRole[] {
    return ['admin', 'supervisor', 'inspector'];
  }

  /**
   * Check if a role can manage another role
   */
  static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    const hierarchy = {
      admin: 3,
      supervisor: 2,
      inspector: 1,
    };

    return hierarchy[managerRole] > hierarchy[targetRole];
  }

  /**
   * Get role hierarchy level
   */
  static getRoleLevel(role: UserRole): number {
    const hierarchy = {
      admin: 3,
      supervisor: 2,
      inspector: 1,
    };

    return hierarchy[role] || 0;
  }

  /**
   * Check if user can access resource based on ownership
   */
  static canAccessOwnResource(
    userRole: UserRole,
    resource: string,
    action: string,
    userId: string,
    resourceUserId: string
  ): boolean {
    // Admin can access any resource
    if (userRole === 'admin') {
      return true;
    }

    // Check if user has permission for the resource
    if (!this.hasPermission(userRole, resource, action, { own: true })) {
      return false;
    }

    // Check ownership
    return userId === resourceUserId;
  }

  /**
   * Check if user can access inspector resource
   */
  static canAccessInspectorResource(
    userRole: UserRole,
    resource: string,
    action: string,
    userId: string,
    inspectorId: string,
    userInspectorId?: string
  ): boolean {
    // Admin and supervisor can access any inspector resource
    if (userRole === 'admin' || userRole === 'supervisor') {
      return this.hasPermission(userRole, resource, action);
    }

    // Inspector can only access their own resources
    if (userRole === 'inspector') {
      return this.hasPermission(userRole, resource, action, { own: true }) && 
             userInspectorId === inspectorId;
    }

    return false;
  }

  /**
   * Get allowed fields for update operations based on role
   */
  static getAllowedUpdateFields(
    userRole: UserRole,
    resource: string,
    isOwnResource: boolean = false
  ): string[] {
    const fieldPermissions = {
      users: {
        admin: ['email', 'role', 'isActive'],
        supervisor: ['email', 'isActive'],
        inspector: isOwnResource ? ['email'] : [],
      },
      profiles: {
        admin: ['firstName', 'lastName', 'phone', 'avatarUrl', 'preferences', 'inspectorId'],
        supervisor: ['firstName', 'lastName', 'phone', 'avatarUrl', 'preferences', 'inspectorId'],
        inspector: isOwnResource ? ['firstName', 'lastName', 'phone', 'avatarUrl', 'preferences'] : [],
      },
      inspectors: {
        admin: ['name', 'identification', 'email', 'phone', 'preferredZones', 'maxDailyRoutes', 'isActive'],
        supervisor: ['name', 'email', 'phone', 'preferredZones', 'maxDailyRoutes', 'isActive'],
        inspector: isOwnResource ? ['email', 'phone', 'preferredZones'] : [],
      },
    };

    const resourceFields = fieldPermissions[resource as keyof typeof fieldPermissions];
    if (!resourceFields) {
      return [];
    }

    return resourceFields[userRole] || [];
  }

  /**
   * Validate role assignment
   */
  static validateRoleAssignment(
    assignerRole: UserRole,
    targetRole: UserRole
  ): { valid: boolean; message?: string } {
    // Admin can assign any role
    if (assignerRole === 'admin') {
      return { valid: true };
    }

    // Supervisor can only assign inspector role
    if (assignerRole === 'supervisor') {
      if (targetRole === 'inspector') {
        return { valid: true };
      }
      return { 
        valid: false, 
        message: 'Supervisors can only assign inspector role' 
      };
    }

    // Inspector cannot assign roles
    return { 
      valid: false, 
      message: 'Inspectors cannot assign roles' 
    };
  }

  /**
   * Check conditions against context
   */
  private static checkConditions(
    conditions: Record<string, any>,
    context: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get role description
   */
  static getRoleDescription(role: UserRole): string {
    const descriptions = {
      admin: 'Full system access with all administrative privileges',
      supervisor: 'Manage inspectors, routes, assignments, and monitoring',
      inspector: 'Access assigned routes and update progress',
    };

    return descriptions[role] || 'Unknown role';
  }

  /**
   * Get role capabilities summary
   */
  static getRoleCapabilities(role: UserRole): string[] {
    const capabilities = {
      admin: [
        'Manage all users and roles',
        'Configure system settings',
        'Access all data and reports',
        'Manage zones and boundaries',
        'Full inspector and route management',
      ],
      supervisor: [
        'Manage inspectors and assignments',
        'Create and optimize routes',
        'Monitor real-time progress',
        'Generate reports and exports',
        'View system analytics',
      ],
      inspector: [
        'View assigned routes',
        'Update route progress',
        'Report incidents',
        'Manage personal profile',
        'Access mobile interface',
      ],
    };

    return capabilities[role] || [];
  }
}