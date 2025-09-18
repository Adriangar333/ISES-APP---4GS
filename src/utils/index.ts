// Utility functions for the Route Assignment System

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique identifier
 */
export const generateId = (): string => uuidv4();

/**
 * Format date to ISO string
 */
export const formatDate = (date: Date = new Date()): string => date.toISOString();

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Colombian format)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+57\s?[0-9]{3}\s?[0-9]{3}\s?[0-9]{4}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate coordinates
 */
export const isValidCoordinate = (lat: number, lon: number): boolean => {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

/**
 * Format time duration in minutes to human readable format
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
};

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export const timeToMinutes = (timeString: string): number => {
  const [hoursStr, minutesStr] = timeString.split(':');
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = parseInt(minutesStr || '0', 10);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Sanitize string for database storage
 */
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Check if a point is within a polygon (basic implementation)
 * For production, use PostGIS ST_Contains function
 */
export const isPointInPolygon = (
  point: { lat: number; lon: number },
  polygon: { lat: number; lon: number }[]
): boolean => {
  let inside = false;
  const x = point.lon;
  const y = point.lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]?.lon ?? 0;
    const yi = polygon[i]?.lat ?? 0;
    const xj = polygon[j]?.lon ?? 0;
    const yj = polygon[j]?.lat ?? 0;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

/**
 * Create API response object
 */
export const createApiResponse = <T>(
  data?: T,
  message?: string,
  success: boolean = true
) => ({
  success,
  data,
  message,
  timestamp: formatDate(),
});

/**
 * Create error response object
 */
export const createErrorResponse = (
  code: string,
  message: string,
  details?: any,
  requestId?: string
) => ({
  error: {
    code,
    message,
    details,
    timestamp: formatDate(),
    requestId: requestId || generateId(),
  },
});