import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

interface SanitizationOptions {
  sanitizeHtml?: boolean;
  trimStrings?: boolean;
  normalizeEmail?: boolean;
  escapeHtml?: boolean;
  removeNullBytes?: boolean;
  maxStringLength?: number;
}

export class InputSanitizer {
  private options: SanitizationOptions;

  constructor(options: SanitizationOptions = {}) {
    this.options = {
      sanitizeHtml: true,
      trimStrings: true,
      normalizeEmail: true,
      escapeHtml: true,
      removeNullBytes: true,
      maxStringLength: 10000,
      ...options
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize route parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        console.error('Input sanitization error:', error);
        res.status(400).json({
          error: {
            code: '400',
            message: 'Invalid input data',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    let sanitized = str;

    // Remove null bytes
    if (this.options.removeNullBytes) {
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Trim whitespace
    if (this.options.trimStrings) {
      sanitized = sanitized.trim();
    }

    // Limit string length
    if (this.options.maxStringLength && sanitized.length > this.options.maxStringLength) {
      sanitized = sanitized.substring(0, this.options.maxStringLength);
    }

    // Sanitize HTML
    if (this.options.sanitizeHtml) {
      sanitized = DOMPurify.sanitize(sanitized, { 
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
    }

    // Escape HTML entities
    if (this.options.escapeHtml) {
      sanitized = validator.escape(sanitized);
    }

    return sanitized;
  }

  // Specific sanitizers for different data types
  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return email;
    
    const trimmed = email.trim().toLowerCase();
    return validator.normalizeEmail(trimmed) || trimmed;
  }

  static sanitizePhoneNumber(phone: string): string {
    if (typeof phone !== 'string') return phone;
    
    // Remove all non-digit characters except + at the beginning
    return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  }

  static sanitizeCoordinate(coord: any): number | null {
    const num = parseFloat(coord);
    if (isNaN(num)) return null;
    
    // Round to 8 decimal places (sufficient for GPS coordinates)
    return Math.round(num * 100000000) / 100000000;
  }

  static sanitizeId(id: string): string {
    if (typeof id !== 'string') return id;
    
    // Remove any characters that aren't alphanumeric, hyphens, or underscores
    return id.replace(/[^a-zA-Z0-9\-_]/g, '');
  }

  static sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') return filename;
    
    // Remove path traversal attempts and dangerous characters
    return filename
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\.\./g, '')
      .replace(/^\.+/, '')
      .trim();
  }
}

// Predefined sanitizers for different use cases
export const createSanitizers = () => {
  return {
    // General purpose sanitizer
    general: new InputSanitizer({
      sanitizeHtml: true,
      trimStrings: true,
      escapeHtml: true,
      maxStringLength: 1000
    }),

    // File upload sanitizer
    fileUpload: new InputSanitizer({
      sanitizeHtml: true,
      trimStrings: true,
      escapeHtml: false, // Don't escape HTML for file content
      maxStringLength: 255 // Shorter for filenames
    }),

    // User input sanitizer (more permissive for content)
    userInput: new InputSanitizer({
      sanitizeHtml: true,
      trimStrings: true,
      escapeHtml: false, // Allow some HTML in user content
      maxStringLength: 5000
    }),

    // API parameter sanitizer (strict)
    apiParams: new InputSanitizer({
      sanitizeHtml: true,
      trimStrings: true,
      escapeHtml: true,
      maxStringLength: 100
    })
  };
};

// Validation middleware for specific fields
export const validateAndSanitizeFields = (fieldValidations: Record<string, (value: any) => boolean>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const [field, validator] of Object.entries(fieldValidations)) {
      const value = req.body[field];
      
      if (value !== undefined && !validator(value)) {
        errors.push(`Invalid ${field}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: {
          code: '400',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

// Common field validators
export const fieldValidators = {
  email: (value: string) => typeof value === 'string' && validator.isEmail(value),
  phone: (value: string) => typeof value === 'string' && /^\+?[\d\s\-()]+$/.test(value),
  coordinate: (value: any) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= -180 && num <= 180;
  },
  uuid: (value: string) => typeof value === 'string' && validator.isUUID(value),
  alphanumeric: (value: string) => typeof value === 'string' && validator.isAlphanumeric(value),
  length: (min: number, max: number) => (value: string) => 
    typeof value === 'string' && value.length >= min && value.length <= max,
  positiveInteger: (value: any) => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0;
  }
};