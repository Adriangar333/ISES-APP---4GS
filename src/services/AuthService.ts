import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { 
  User, 
  UserProfile, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePasswordRequest,
  JWTPayload,
  UserRole,
  RefreshToken,
  UserSession
} from '../types';
import { UserRepository } from '../repositories/UserRepository';
import { UserProfileRepository } from '../repositories/UserProfileRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { UserSessionRepository } from '../repositories/UserSessionRepository';

export class AuthService {
  private userRepository: UserRepository;
  private userProfileRepository: UserProfileRepository;
  private refreshTokenRepository: RefreshTokenRepository;
  private userSessionRepository: UserSessionRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.userProfileRepository = new UserProfileRepository();
    this.refreshTokenRepository = new RefreshTokenRepository();
    this.userSessionRepository = new UserSessionRepository();
  }

  /**
   * Authenticate user with email and password
   */
  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const { email, password } = loginData;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, await this.userRepository.getPasswordHash(user.id));
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Get user profile
    const profile = await this.userProfileRepository.findByUserId(user.id);

    // Create session
    const sessionToken = uuidv4();
    const sessionData: {
      userId: string;
      sessionToken: string;
      ipAddress?: string | undefined;
      userAgent?: string | undefined;
      expiresAt: Date;
    } = {
      userId: user.id,
      sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
    
    if (ipAddress) sessionData.ipAddress = ipAddress;
    if (userAgent) sessionData.userAgent = userAgent;
    
    const session = await this.userSessionRepository.create(sessionData);

    // Generate tokens
    const tokens = await this.generateTokens(user, session.id);

    const result: AuthResponse = {
      user,
      tokens,
    };
    
    if (profile) {
      result.profile = profile;
    }
    
    return result;
  }

  /**
   * Register a new user
   */
  async register(registerData: RegisterRequest): Promise<AuthResponse> {
    const { email, password, role, firstName, lastName, phone, inspectorId } = registerData;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.userRepository.create({
      email,
      passwordHash,
      role,
    });

    // Create user profile
    const profileData: {
      userId: string;
      inspectorId?: string | undefined;
      firstName?: string | undefined;
      lastName?: string | undefined;
      phone?: string | undefined;
      preferences?: Record<string, any>;
    } = {
      userId: user.id,
      preferences: {},
    };
    
    if (firstName) profileData.firstName = firstName;
    if (lastName) profileData.lastName = lastName;
    if (phone) profileData.phone = phone;
    if (inspectorId) profileData.inspectorId = inspectorId;
    
    const profile = await this.userProfileRepository.create(profileData);

    // Create session
    const sessionToken = uuidv4();
    const session = await this.userSessionRepository.create({
      userId: user.id,
      sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Generate tokens
    const tokens = await this.generateTokens(user, session.id);

    return {
      user,
      profile,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenString: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshTokenString, config.jwt.secret) as JWTPayload;
      
      // Find refresh token in database
      const refreshToken = await this.refreshTokenRepository.findByTokenHash(
        await bcrypt.hash(refreshTokenString, 10)
      );

      if (!refreshToken || refreshToken.isRevoked || refreshToken.expiresAt < new Date()) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user, decoded.sessionId);

      // Revoke old refresh token
      await this.refreshTokenRepository.revoke(refreshToken.id);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user and revoke tokens
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    // Revoke all refresh tokens for user
    await this.refreshTokenRepository.revokeAllForUser(userId);

    // Deactivate user sessions
    if (sessionId) {
      await this.userSessionRepository.deactivate(sessionId);
    } else {
      await this.userSessionRepository.deactivateAllForUser(userId);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    const { email } = request;

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepository.setPasswordResetToken(user.id, resetToken, resetExpires);

    // TODO: Send email with reset token
    // In a real implementation, you would send an email here
    console.log(`Password reset token for ${email}: ${resetToken}`);
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<void> {
    const { token, newPassword } = request;

    const user = await this.userRepository.findByPasswordResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await this.userRepository.updatePassword(user.id, passwordHash);
    await this.userRepository.clearPasswordResetToken(user.id);

    // Revoke all existing sessions and tokens
    await this.logout(user.id);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = request;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const currentPasswordHash = await this.userRepository.getPasswordHash(userId);
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentPasswordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // Revoke all existing sessions and tokens except current one
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }

  /**
   * Verify JWT token and return payload
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Verify session is still active
      const session = await this.userSessionRepository.findById(decoded.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw new Error('Session expired');
      }

      // Verify user is still active
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID with profile
   */
  async getUserWithProfile(userId: string): Promise<{ user: User; profile?: UserProfile }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const profile = await this.userProfileRepository.findByUserId(userId);

    const result: { user: User; profile?: UserProfile } = { user };
    
    if (profile) {
      result.profile = profile;
    }
    
    return result;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.userProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return await this.userProfileRepository.update(profile.id, updates);
  }

  /**
   * Check if user has permission for a specific action
   */
  hasPermission(userRole: UserRole, resource: string, action: string, context?: Record<string, any>): boolean {
    const { RoleService } = require('./RoleService');
    return RoleService.hasPermission(userRole, resource, action, context);
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: User, sessionId: string): Promise<AuthTokens> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    // Generate access token
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    // Generate refresh token
    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    // Store refresh token hash in database
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Parse expiration time
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp - decoded.iat;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}