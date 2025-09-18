import { InspectorRepository } from '../repositories/InspectorRepository';
import { AvailabilitySchedule } from '../types';

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  dayOfWeek: number;
  timeSlots: TimeSlot[];
  totalHours: number;
}

export interface WeeklyAvailability {
  inspectorId: string;
  inspectorName: string;
  days: DayAvailability[];
  totalWeeklyHours: number;
}

export interface AvailabilityConflict {
  inspectorId: string;
  dayOfWeek: number;
  conflictingSlots: TimeSlot[];
  reason: string;
}

export class AvailabilityManager {
  private inspectorRepository: InspectorRepository;

  constructor() {
    this.inspectorRepository = new InspectorRepository();
  }

  /**
   * Get inspector's availability for a specific day
   */
  async getInspectorDayAvailability(inspectorId: string, dayOfWeek: number): Promise<DayAvailability | null> {
    const availability = await this.inspectorRepository.getAvailability(inspectorId, dayOfWeek);
    
    if (availability.length === 0) {
      return null;
    }

    const timeSlots: TimeSlot[] = availability
      .filter(slot => slot.isActive)
      .map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const totalHours = this.calculateTotalHours(timeSlots);

    return {
      dayOfWeek,
      timeSlots,
      totalHours
    };
  }

  /**
   * Get inspector's full weekly availability
   */
  async getInspectorWeeklyAvailability(inspectorId: string): Promise<WeeklyAvailability | null> {
    const inspector = await this.inspectorRepository.findById(inspectorId);
    if (!inspector) {
      return null;
    }

    const days: DayAvailability[] = [];
    let totalWeeklyHours = 0;

    // Check availability for each day of the week (0 = Sunday, 6 = Saturday)
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayAvailability = await this.getInspectorDayAvailability(inspectorId, dayOfWeek);
      if (dayAvailability) {
        days.push(dayAvailability);
        totalWeeklyHours += dayAvailability.totalHours;
      }
    }

    return {
      inspectorId,
      inspectorName: inspector.name,
      days,
      totalWeeklyHours
    };
  }

  /**
   * Check if inspector is available at a specific time
   */
  async isInspectorAvailable(inspectorId: string, dayOfWeek: number, timeSlot: TimeSlot): Promise<boolean> {
    const dayAvailability = await this.getInspectorDayAvailability(inspectorId, dayOfWeek);
    
    if (!dayAvailability) {
      return false;
    }

    return dayAvailability.timeSlots.some(slot => 
      this.isTimeSlotWithinAvailability(timeSlot, slot)
    );
  }

  /**
   * Find available inspectors for a specific time slot
   */
  async findAvailableInspectors(dayOfWeek: number, timeSlot: TimeSlot, zoneId?: string): Promise<string[]> {
    let inspectors;
    
    if (zoneId) {
      inspectors = await this.inspectorRepository.findByPreferredZone(zoneId);
    } else {
      inspectors = await this.inspectorRepository.findActive();
    }

    const availableInspectors: string[] = [];

    for (const inspector of inspectors) {
      const isAvailable = await this.isInspectorAvailable(inspector.id, dayOfWeek, timeSlot);
      if (isAvailable) {
        availableInspectors.push(inspector.id);
      }
    }

    return availableInspectors;
  }

  /**
   * Validate availability schedule for conflicts
   */
  validateAvailabilitySchedule(availability: Omit<AvailabilitySchedule, 'inspectorId'>[]): AvailabilityConflict[] {
    const conflicts: AvailabilityConflict[] = [];
    const dayGroups = new Map<number, Omit<AvailabilitySchedule, 'inspectorId'>[]>();

    // Group by day of week
    availability.forEach(slot => {
      if (!dayGroups.has(slot.dayOfWeek)) {
        dayGroups.set(slot.dayOfWeek, []);
      }
      dayGroups.get(slot.dayOfWeek)!.push(slot);
    });

    // Check for overlapping time slots within each day
    dayGroups.forEach((slots, dayOfWeek) => {
      const activeSlots = slots.filter(slot => slot.isActive);
      
      for (let i = 0; i < activeSlots.length; i++) {
        for (let j = i + 1; j < activeSlots.length; j++) {
          const slot1 = activeSlots[i];
          const slot2 = activeSlots[j];
          
          if (slot1 && slot2 && this.doTimeSlotsOverlap(
            { startTime: slot1.startTime, endTime: slot1.endTime },
            { startTime: slot2.startTime, endTime: slot2.endTime }
          )) {
            conflicts.push({
              inspectorId: '', // Will be set by caller
              dayOfWeek,
              conflictingSlots: [
                { startTime: slot1.startTime, endTime: slot1.endTime },
                { startTime: slot2.startTime, endTime: slot2.endTime }
              ],
              reason: 'Overlapping time slots'
            });
          }
        }
      }
    });

    return conflicts;
  }

  /**
   * Get availability statistics for multiple inspectors
   */
  async getAvailabilityStatistics(inspectorIds: string[]): Promise<{
    totalInspectors: number;
    averageWeeklyHours: number;
    inspectorStats: Array<{
      inspectorId: string;
      inspectorName: string;
      weeklyHours: number;
      availableDays: number;
    }>;
  }> {
    const inspectorStats = [];
    let totalWeeklyHours = 0;

    for (const inspectorId of inspectorIds) {
      const weeklyAvailability = await this.getInspectorWeeklyAvailability(inspectorId);
      if (weeklyAvailability) {
        inspectorStats.push({
          inspectorId,
          inspectorName: weeklyAvailability.inspectorName,
          weeklyHours: weeklyAvailability.totalWeeklyHours,
          availableDays: weeklyAvailability.days.length
        });
        totalWeeklyHours += weeklyAvailability.totalWeeklyHours;
      }
    }

    return {
      totalInspectors: inspectorStats.length,
      averageWeeklyHours: inspectorStats.length > 0 ? totalWeeklyHours / inspectorStats.length : 0,
      inspectorStats
    };
  }

  /**
   * Calculate total hours from time slots
   */
  private calculateTotalHours(timeSlots: TimeSlot[]): number {
    return timeSlots.reduce((total, slot) => {
      const start = this.timeStringToMinutes(slot.startTime);
      const end = this.timeStringToMinutes(slot.endTime);
      return total + (end - start) / 60; // Convert minutes to hours
    }, 0);
  }

  /**
   * Check if a time slot is within available hours
   */
  private isTimeSlotWithinAvailability(requestedSlot: TimeSlot, availableSlot: TimeSlot): boolean {
    const reqStart = this.timeStringToMinutes(requestedSlot.startTime);
    const reqEnd = this.timeStringToMinutes(requestedSlot.endTime);
    const availStart = this.timeStringToMinutes(availableSlot.startTime);
    const availEnd = this.timeStringToMinutes(availableSlot.endTime);

    return reqStart >= availStart && reqEnd <= availEnd;
  }

  /**
   * Check if two time slots overlap
   */
  private doTimeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    const start1 = this.timeStringToMinutes(slot1.startTime);
    const end1 = this.timeStringToMinutes(slot1.endTime);
    const start2 = this.timeStringToMinutes(slot2.startTime);
    const end2 = this.timeStringToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private timeStringToMinutes(timeString: string): number {
    const parts = timeString.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:MM)
   */
  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}