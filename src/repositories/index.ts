// Repository exports
export { BaseRepository } from './BaseRepository';
export { ZoneRepository } from './ZoneRepository';
export { InspectorRepository } from './InspectorRepository';
export { CoordinateRepository } from './CoordinateRepository';
export { RouteRepository } from './RouteRepository';
export { RoutePointRepository } from './RoutePointRepository';

// Import classes for instances
import { ZoneRepository } from './ZoneRepository';
import { InspectorRepository } from './InspectorRepository';
import { CoordinateRepository } from './CoordinateRepository';
import { RouteRepository } from './RouteRepository';
import { RoutePointRepository } from './RoutePointRepository';

// Repository instances (singletons)
export const zoneRepository = new ZoneRepository();
export const inspectorRepository = new InspectorRepository();
export const coordinateRepository = new CoordinateRepository();
export const routeRepository = new RouteRepository();
export const routePointRepository = new RoutePointRepository();