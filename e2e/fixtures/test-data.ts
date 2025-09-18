export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin'
  },
  supervisor: {
    email: 'supervisor@test.com',
    password: 'supervisor123',
    role: 'supervisor'
  },
  inspector: {
    email: 'inspector@test.com',
    password: 'inspector123',
    role: 'inspector'
  }
};

export const testZones = [
  {
    name: 'Zona Centro',
    type: 'metropolitana',
    boundaries: {
      type: 'Polygon',
      coordinates: [[
        [-74.0759, 4.5981],
        [-74.0659, 4.5981],
        [-74.0659, 4.6081],
        [-74.0759, 4.6081],
        [-74.0759, 4.5981]
      ]]
    }
  },
  {
    name: 'Zona Norte',
    type: 'metropolitana',
    boundaries: {
      type: 'Polygon',
      coordinates: [[
        [-74.0859, 4.6081],
        [-74.0759, 4.6081],
        [-74.0759, 4.6181],
        [-74.0859, 4.6181],
        [-74.0859, 4.6081]
      ]]
    }
  }
];

export const testInspectors = [
  {
    name: 'Juan Pérez',
    identification: '12345678',
    email: 'juan.perez@test.com',
    phone: '+57 300 123 4567',
    preferredZones: ['Zona Centro'],
    maxDailyRoutes: 5
  },
  {
    name: 'María García',
    identification: '87654321',
    email: 'maria.garcia@test.com',
    phone: '+57 300 765 4321',
    preferredZones: ['Zona Norte'],
    maxDailyRoutes: 4
  }
];

export const testCoordinates = [
  {
    latitude: 4.6097,
    longitude: -74.0817,
    address: 'Carrera 7 # 32-16, Bogotá',
    zone: 'Zona Centro'
  },
  {
    latitude: 4.6147,
    longitude: -74.0767,
    address: 'Calle 45 # 13-09, Bogotá',
    zone: 'Zona Norte'
  }
];

export const testRoutes = [
  {
    name: 'Ruta Centro Mañana',
    priority: 'high',
    estimatedDuration: 240,
    coordinates: [testCoordinates[0]]
  },
  {
    name: 'Ruta Norte Tarde',
    priority: 'medium',
    estimatedDuration: 180,
    coordinates: [testCoordinates[1]]
  }
];