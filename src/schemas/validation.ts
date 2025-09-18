import Joi from 'joi';

// Zone validation schema
export const zoneSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('metropolitana', 'rural').required(),
  boundaries: Joi.object({
    coordinates: Joi.array().items(
      Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      })
    ).min(3).required(),
    type: Joi.string().valid('Polygon').required()
  }).required(),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional()
});

// Inspector validation schema
export const inspectorSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  identification: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().max(20).optional(),
  preferredZones: Joi.array().items(Joi.string().uuid()).default([]),
  maxDailyRoutes: Joi.number().integer().min(1).max(20).default(5),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional()
});

// Coordinate validation schema
export const coordinateSchema = Joi.object({
  id: Joi.string().allow('').optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).optional(),
  zoneId: Joi.string().uuid().optional(),
  importedFrom: Joi.string().max(100).optional(),
  createdAt: Joi.date().optional()
});

// Route validation schema
export const routeSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  estimatedDuration: Joi.number().integer().min(0).optional(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  zoneId: Joi.string().uuid().optional(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled').default('pending'),
  assignedInspectorId: Joi.string().uuid().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional()
});

// Route point validation schema
export const routePointSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  routeId: Joi.string().uuid().required(),
  coordinateId: Joi.string().uuid().required(),
  pointOrder: Joi.number().integer().min(1).required(),
  estimatedTime: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('pending', 'completed', 'skipped').default('pending'),
  completedAt: Joi.date().optional(),
  notes: Joi.string().max(1000).optional()
});

// Availability schedule validation schema
export const availabilityScheduleSchema = Joi.object({
  inspectorId: Joi.string().uuid().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  isActive: Joi.boolean().default(true)
});

// Excel import validation schema
export const excelImportSchema = Joi.object({
  coordinates: Joi.array().items(coordinateSchema).required(),
  validationErrors: Joi.array().items(
    Joi.object({
      row: Joi.number().integer().min(1).required(),
      field: Joi.string().required(),
      message: Joi.string().required(),
      value: Joi.any().optional()
    })
  ).default([]),
  summary: Joi.object({
    totalRows: Joi.number().integer().min(0).required(),
    validRows: Joi.number().integer().min(0).required(),
    invalidRows: Joi.number().integer().min(0).required(),
    zonesDetected: Joi.array().items(Joi.string()).required()
  }).required()
});

// Route assignment validation schema
export const routeAssignmentSchema = Joi.object({
  routeId: Joi.string().uuid().required(),
  inspectorId: Joi.string().uuid().required(),
  assignedAt: Joi.date().default(() => new Date()),
  estimatedStartTime: Joi.date().required(),
  estimatedEndTime: Joi.date().required()
});

// Validation helper functions
export const validateZone = (data: any) => zoneSchema.validate(data);
export const validateInspector = (data: any) => inspectorSchema.validate(data);
export const validateCoordinate = (data: any) => coordinateSchema.validate(data);
export const validateRoute = (data: any) => routeSchema.validate(data);
export const validateRoutePoint = (data: any) => routePointSchema.validate(data);
export const validateAvailabilitySchedule = (data: any) => availabilityScheduleSchema.validate(data);
export const validateExcelImport = (data: any) => excelImportSchema.validate(data);
export const validateRouteAssignment = (data: any) => routeAssignmentSchema.validate(data);