import { RoleService } from '../../services/RoleService';
import { UserRole } from '../../types';

describe('RoleService', () => {
  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {
      const result = RoleService.hasPermission('admin', 'zones', 'delete');
      expect(result).toBe(true);
    });

    it('should return true for supervisor with allowed permission', () => {
      const result = RoleService.hasPermission('supervisor', 'routes', 'read');
      expect(result).toBe(true);
    });

    it('should return false for inspector with disallowed permission', () => {
      const result = RoleService.hasPermission('inspector', 'zones', 'delete');
      expect(result).toBe(false);
    });

    it('should return true for inspector with allowed permission', () => {
      const result = RoleService.hasPermission('inspector', 'routes', 'read', { own: true });
      expect(result).toBe(true);
    });

    it('should return false for inspector without ownership context', () => {
      const result = RoleService.hasPermission('inspector', 'routes', 'read');
      expect(result).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for admin role', () => {
      const permissions = RoleService.getRolePermissions('admin');
      expect(permissions).toHaveLength(1);
      expect(permissions[0]).toEqual({ resource: '*', action: '*' });
    });

    it('should return permissions for supervisor role', () => {
      const permissions = RoleService.getRolePermissions('supervisor');
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'inspectors' && p.action === '*')).toBe(true);
    });

    it('should return permissions for inspector role', () => {
      const permissions = RoleService.getRolePermissions('inspector');
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'routes' && p.action === 'read')).toBe(true);
    });
  });

  describe('getAllRoles', () => {
    it('should return all available roles', () => {
      const roles = RoleService.getAllRoles();
      expect(roles).toEqual(['admin', 'supervisor', 'inspector']);
    });
  });

  describe('canManageRole', () => {
    it('should allow admin to manage any role', () => {
      expect(RoleService.canManageRole('admin', 'supervisor')).toBe(true);
      expect(RoleService.canManageRole('admin', 'inspector')).toBe(true);
    });

    it('should allow supervisor to manage inspector', () => {
      expect(RoleService.canManageRole('supervisor', 'inspector')).toBe(true);
    });

    it('should not allow supervisor to manage admin', () => {
      expect(RoleService.canManageRole('supervisor', 'admin')).toBe(false);
    });

    it('should not allow inspector to manage any role', () => {
      expect(RoleService.canManageRole('inspector', 'admin')).toBe(false);
      expect(RoleService.canManageRole('inspector', 'supervisor')).toBe(false);
    });
  });

  describe('getRoleLevel', () => {
    it('should return correct hierarchy levels', () => {
      expect(RoleService.getRoleLevel('admin')).toBe(3);
      expect(RoleService.getRoleLevel('supervisor')).toBe(2);
      expect(RoleService.getRoleLevel('inspector')).toBe(1);
    });
  });

  describe('canAccessOwnResource', () => {
    it('should allow admin to access any resource', () => {
      const result = RoleService.canAccessOwnResource(
        'admin',
        'users',
        'read',
        'user1',
        'user2'
      );
      expect(result).toBe(true);
    });

    it('should allow user to access own resource', () => {
      const result = RoleService.canAccessOwnResource(
        'inspector',
        'profiles',
        'read',
        'user1',
        'user1'
      );
      expect(result).toBe(true);
    });

    it('should not allow user to access other user resource', () => {
      const result = RoleService.canAccessOwnResource(
        'inspector',
        'profiles',
        'read',
        'user1',
        'user2'
      );
      expect(result).toBe(false);
    });
  });

  describe('canAccessInspectorResource', () => {
    it('should allow admin to access any inspector resource', () => {
      const result = RoleService.canAccessInspectorResource(
        'admin',
        'inspectors',
        'read',
        'user1',
        'inspector1'
      );
      expect(result).toBe(true);
    });

    it('should allow supervisor to access any inspector resource', () => {
      const result = RoleService.canAccessInspectorResource(
        'supervisor',
        'inspectors',
        'read',
        'user1',
        'inspector1'
      );
      expect(result).toBe(true);
    });

    it('should allow inspector to access own resource', () => {
      const result = RoleService.canAccessInspectorResource(
        'inspector',
        'inspectors',
        'read',
        'user1',
        'inspector1',
        'inspector1'
      );
      expect(result).toBe(true);
    });

    it('should not allow inspector to access other inspector resource', () => {
      const result = RoleService.canAccessInspectorResource(
        'inspector',
        'inspectors',
        'read',
        'user1',
        'inspector1',
        'inspector2'
      );
      expect(result).toBe(false);
    });
  });

  describe('getAllowedUpdateFields', () => {
    it('should return all fields for admin', () => {
      const fields = RoleService.getAllowedUpdateFields('admin', 'users');
      expect(fields).toContain('email');
      expect(fields).toContain('role');
      expect(fields).toContain('isActive');
    });

    it('should return limited fields for supervisor', () => {
      const fields = RoleService.getAllowedUpdateFields('supervisor', 'users');
      expect(fields).toContain('email');
      expect(fields).toContain('isActive');
      expect(fields).not.toContain('role');
    });

    it('should return minimal fields for inspector on own resource', () => {
      const fields = RoleService.getAllowedUpdateFields('inspector', 'users', true);
      expect(fields).toContain('email');
      expect(fields).not.toContain('role');
      expect(fields).not.toContain('isActive');
    });

    it('should return no fields for inspector on other resource', () => {
      const fields = RoleService.getAllowedUpdateFields('inspector', 'users', false);
      expect(fields).toHaveLength(0);
    });
  });

  describe('validateRoleAssignment', () => {
    it('should allow admin to assign any role', () => {
      const result = RoleService.validateRoleAssignment('admin', 'supervisor');
      expect(result.valid).toBe(true);
    });

    it('should allow supervisor to assign inspector role', () => {
      const result = RoleService.validateRoleAssignment('supervisor', 'inspector');
      expect(result.valid).toBe(true);
    });

    it('should not allow supervisor to assign admin role', () => {
      const result = RoleService.validateRoleAssignment('supervisor', 'admin');
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('should not allow inspector to assign any role', () => {
      const result = RoleService.validateRoleAssignment('inspector', 'inspector');
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('getRoleDescription', () => {
    it('should return description for each role', () => {
      expect(RoleService.getRoleDescription('admin')).toContain('Full system access');
      expect(RoleService.getRoleDescription('supervisor')).toContain('Manage inspectors');
      expect(RoleService.getRoleDescription('inspector')).toContain('Access assigned routes');
    });
  });

  describe('getRoleCapabilities', () => {
    it('should return capabilities for each role', () => {
      const adminCapabilities = RoleService.getRoleCapabilities('admin');
      expect(adminCapabilities).toContain('Manage all users and roles');
      
      const supervisorCapabilities = RoleService.getRoleCapabilities('supervisor');
      expect(supervisorCapabilities).toContain('Manage inspectors and assignments');
      
      const inspectorCapabilities = RoleService.getRoleCapabilities('inspector');
      expect(inspectorCapabilities).toContain('View assigned routes');
    });
  });
});