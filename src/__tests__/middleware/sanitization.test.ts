import { InputSanitizer, fieldValidators, validateAndSanitizeFields } from '../../middleware/sanitization';

describe('Input Sanitization Middleware', () => {
  describe('InputSanitizer class', () => {
    let sanitizer: InputSanitizer;

    beforeEach(() => {
      sanitizer = new InputSanitizer();
    });

    it('should sanitize HTML in strings', () => {
      const req = {
        body: {
          name: '<script>alert("xss")</script>John Doe',
          description: '<img src="x" onerror="alert(1)">Safe content'
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.body.name).not.toContain('<script>');
      expect(req.body.description).not.toContain('onerror');
      expect(next).toHaveBeenCalled();
    });

    it('should trim whitespace from strings', () => {
      const req = {
        body: {
          name: '  John Doe  ',
          email: '\t\ntest@example.com\n\t'
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.body.name).toBe('John Doe');
      expect(req.body.email).toBe('test@example.com');
    });

    it('should remove null bytes', () => {
      const req = {
        body: {
          name: 'John\0Doe',
          data: 'test\0\0data'
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.body.name).toBe('JohnDoe');
      expect(req.body.data).toBe('testdata');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(15000);
      const sanitizerWithLimit = new InputSanitizer({ maxStringLength: 100 });
      
      const req = {
        body: {
          description: longString
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizerWithLimit.middleware();
      middleware(req, res, next);

      expect(req.body.description.length).toBe(100);
    });

    it('should sanitize nested objects', () => {
      const req = {
        body: {
          user: {
            name: '<script>alert("xss")</script>John',
            profile: {
              bio: '  <img src="x" onerror="alert(1)">Bio content  '
            }
          }
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.body.user.name).not.toContain('<script>');
      expect(req.body.user.profile.bio).not.toContain('onerror');
      expect(req.body.user.profile.bio.trim()).toBe('Bio content');
    });

    it('should sanitize arrays', () => {
      const req = {
        body: {
          tags: ['<script>tag1</script>', '  tag2  ', 'tag3<img src="x" onerror="alert(1)">']
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.body.tags[0]).not.toContain('<script>');
      expect(req.body.tags[1]).toBe('tag2');
      expect(req.body.tags[2]).not.toContain('onerror');
    });

    it('should sanitize query parameters', () => {
      const req = {
        query: {
          search: '<script>alert("xss")</script>',
          filter: '  category  '
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(req.query.search).not.toContain('<script>');
      expect(req.query.filter).toBe('category');
    });

    it('should handle sanitization errors gracefully', () => {
      const req = {
        body: null
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      // Mock sanitizeObject to throw error
      const sanitizer = new InputSanitizer();
      const originalSanitizeObject = (sanitizer as any).sanitizeObject;
      (sanitizer as any).sanitizeObject = jest.fn().mockImplementation(() => {
        throw new Error('Sanitization error');
      });

      const middleware = sanitizer.middleware();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: '400',
          message: 'Invalid input data',
          timestamp: expect.any(String)
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Static sanitizer methods', () => {
    it('should sanitize email addresses', () => {
      expect(InputSanitizer.sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
      expect(InputSanitizer.sanitizeEmail('User+Tag@Example.Com')).toBe('user+tag@example.com');
    });

    it('should sanitize phone numbers', () => {
      expect(InputSanitizer.sanitizePhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
      expect(InputSanitizer.sanitizePhoneNumber('555.123.4567')).toBe('5551234567');
    });

    it('should sanitize coordinates', () => {
      expect(InputSanitizer.sanitizeCoordinate('4.123456789')).toBe(4.12345679);
      expect(InputSanitizer.sanitizeCoordinate('-74.987654321')).toBe(-74.98765432);
      expect(InputSanitizer.sanitizeCoordinate('invalid')).toBeNull();
    });

    it('should sanitize IDs', () => {
      expect(InputSanitizer.sanitizeId('user-123_test')).toBe('user-123_test');
      expect(InputSanitizer.sanitizeId('user@123#test')).toBe('user123test');
    });

    it('should sanitize filenames', () => {
      expect(InputSanitizer.sanitizeFilename('test/file.txt')).toBe('testfile.txt');
      expect(InputSanitizer.sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
      expect(InputSanitizer.sanitizeFilename('file<>:"|?*.txt')).toBe('file.txt');
    });
  });

  describe('Field validators', () => {
    it('should validate email addresses', () => {
      expect(fieldValidators.email('test@example.com')).toBe(true);
      expect(fieldValidators.email('invalid-email')).toBe(false);
      expect(fieldValidators.email('')).toBe(false);
    });

    it('should validate phone numbers', () => {
      expect(fieldValidators.phone('+1 555 123 4567')).toBe(true);
      expect(fieldValidators.phone('555-123-4567')).toBe(true);
      expect(fieldValidators.phone('invalid-phone')).toBe(false);
    });

    it('should validate coordinates', () => {
      expect(fieldValidators.coordinate('4.123456')).toBe(true);
      expect(fieldValidators.coordinate('-74.987654')).toBe(true);
      expect(fieldValidators.coordinate('181')).toBe(false);
      expect(fieldValidators.coordinate('invalid')).toBe(false);
    });

    it('should validate UUIDs', () => {
      expect(fieldValidators.uuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(fieldValidators.uuid('invalid-uuid')).toBe(false);
    });

    it('should validate string length', () => {
      const lengthValidator = fieldValidators.length(5, 10);
      expect(lengthValidator('hello')).toBe(true);
      expect(lengthValidator('hello world')).toBe(false);
      expect(lengthValidator('hi')).toBe(false);
    });

    it('should validate positive integers', () => {
      expect(fieldValidators.positiveInteger('5')).toBe(true);
      expect(fieldValidators.positiveInteger(10)).toBe(true);
      expect(fieldValidators.positiveInteger('0')).toBe(false);
      expect(fieldValidators.positiveInteger('-5')).toBe(false);
      expect(fieldValidators.positiveInteger('invalid')).toBe(false);
    });
  });

  describe('validateAndSanitizeFields middleware', () => {
    it('should validate required fields', () => {
      const middleware = validateAndSanitizeFields({
        email: fieldValidators.email,
        phone: fieldValidators.phone
      });

      const req = {
        body: {
          email: 'test@example.com',
          phone: '+1 555 123 4567'
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return validation errors for invalid fields', () => {
      const middleware = validateAndSanitizeFields({
        email: fieldValidators.email,
        phone: fieldValidators.phone
      });

      const req = {
        body: {
          email: 'invalid-email',
          phone: 'invalid-phone'
        }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: '400',
          message: 'Validation failed',
          details: ['Invalid email', 'Invalid phone'],
          timestamp: expect.any(String)
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip validation for undefined fields', () => {
      const middleware = validateAndSanitizeFields({
        email: fieldValidators.email,
        phone: fieldValidators.phone
      });

      const req = {
        body: {
          email: 'test@example.com'
          // phone is undefined
        }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});