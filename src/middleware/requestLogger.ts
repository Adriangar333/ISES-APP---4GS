import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Add request ID for tracking
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  
  const start = Date.now();
  const { method, url, ip } = req;
  
  console.log(`📥 ${method} ${url} - ${ip} - ${new Date().toISOString()}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const statusEmoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
    
    console.log(
      `📤 ${statusEmoji} ${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`
    );
  });

  next();
};