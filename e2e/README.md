# End-to-End Testing

Este directorio contiene las pruebas end-to-end (E2E) para el Sistema de Asignación de Rutas usando Playwright.

## Estructura de Archivos

```
e2e/
├── fixtures/           # Datos de prueba y archivos mock
│   ├── test-data.ts    # Datos de usuarios, zonas, inspectores, etc.
│   ├── test-zones.kmz  # Archivo KMZ mock para pruebas
│   └── *.xlsx          # Archivos Excel mock para pruebas
├── utils/              # Utilidades y helpers
│   ├── auth-helper.ts  # Helper para autenticación
│   └── api-helper.ts   # Helper para llamadas API
├── *.spec.ts           # Archivos de pruebas
├── global-setup.ts     # Configuración global antes de las pruebas
├── global-teardown.ts  # Limpieza global después de las pruebas
└── README.md           # Esta documentación
```

## Archivos de Pruebas

### `auth.spec.ts`
Pruebas de autenticación y autorización:
- Login/logout para diferentes roles
- Validación de formularios
- Manejo de sesiones
- Redirecciones de rutas protegidas

### `admin-workflow.spec.ts`
Flujo completo de trabajo del administrador:
- Gestión de zonas
- Carga y procesamiento de archivos KMZ
- Gestión de inspectores
- Importación de archivos Excel
- Creación y asignación de rutas
- Exportación de datos
- Visualización de analíticas

### `supervisor-workflow.spec.ts`
Flujo completo de trabajo del supervisor:
- Dashboard de monitoreo en tiempo real
- Visualización de estado de zonas
- Gestión de asignaciones de rutas
- Manejo de alertas e incidentes
- Métricas de rendimiento
- Envío de notificaciones
- Generación de reportes

### `inspector-workflow.spec.ts`
Flujo completo de trabajo del inspector:
- Dashboard del inspector
- Visualización de rutas asignadas
- Navegación de rutas
- Completación de puntos
- Modo offline
- Reporte de incidentes
- Solicitud de reasignaciones
- Historial y estadísticas

### `file-import.spec.ts`
Pruebas de importación de archivos:
- Carga de archivos Excel válidos
- Manejo de errores de validación
- Procesamiento de archivos KMZ
- Archivos grandes con seguimiento de progreso
- Validación de formatos
- Historial de importaciones
- Exportación de datos procesados

### `visual-regression.spec.ts`
Pruebas de regresión visual:
- Screenshots de páginas principales
- Interfaces responsive (móvil/tablet)
- Estados de componentes (loading, errores)
- Modo oscuro
- Notificaciones y modales
- Visualizaciones de datos

## Configuración

### Variables de Entorno

```bash
# URLs base para las pruebas
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001/api/v1

# Base de datos de pruebas
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/route_assignment_test
TEST_REDIS_URL=redis://localhost:6379/1

# Configuración de Playwright
PWDEBUG=1  # Para debugging
```

### Prerrequisitos

1. **Aplicación ejecutándose**: Tanto el backend como el frontend deben estar ejecutándose
2. **Base de datos de pruebas**: Una base de datos PostgreSQL separada para pruebas
3. **Redis de pruebas**: Una instancia Redis separada para pruebas

## Comandos de Ejecución

```bash
# Instalar dependencias de Playwright
npm install
npx playwright install

# Ejecutar todas las pruebas E2E
npm run test:e2e

# Ejecutar pruebas con interfaz visual
npm run test:e2e:ui

# Ejecutar pruebas en modo headed (visible)
npm run test:e2e:headed

# Ejecutar pruebas en modo debug
npm run test:e2e:debug

# Ejecutar pruebas específicas
npx playwright test auth.spec.ts

# Ejecutar pruebas en un navegador específico
npx playwright test --project=chromium

# Generar reporte HTML
npx playwright show-report
```

## Datos de Prueba

### Usuarios de Prueba

```typescript
// Definidos en fixtures/test-data.ts
const testUsers = {
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
```

### Datos de Prueba Adicionales

- **Zonas**: 2 zonas de prueba (Centro y Norte)
- **Inspectores**: 2 inspectores de prueba
- **Coordenadas**: Coordenadas de muestra para cada zona
- **Rutas**: Rutas de prueba con diferentes prioridades

## Helpers y Utilidades

### AuthHelper
Maneja la autenticación en las pruebas:
```typescript
const authHelper = new AuthHelper(page);
await authHelper.login('admin');
await authHelper.logout();
```

### ApiHelper
Facilita las llamadas API para configurar datos de prueba:
```typescript
const apiHelper = new ApiHelper(request);
await apiHelper.createTestZone(zoneData, token);
await apiHelper.cleanupTestData(token);
```

## Configuración Global

### Global Setup
- Crea usuarios de prueba
- Configura datos iniciales
- Verifica que la aplicación esté lista

### Global Teardown
- Limpia datos de prueba
- Restaura el estado inicial

## Mejores Prácticas

1. **Aislamiento**: Cada prueba debe ser independiente
2. **Datos de Prueba**: Usar datos específicos para pruebas, no datos de producción
3. **Esperas**: Usar `expect().toBeVisible()` en lugar de `waitForTimeout()`
4. **Selectores**: Usar `data-testid` para selectores estables
5. **Limpieza**: Limpiar datos después de cada prueba
6. **Screenshots**: Tomar screenshots en fallos para debugging

## Debugging

### Modo Debug
```bash
npm run test:e2e:debug
```

### Modo Headed
```bash
npm run test:e2e:headed
```

### Traces
Los traces se capturan automáticamente en fallos y se pueden ver en el reporte HTML.

### Screenshots
Screenshots automáticos en fallos están habilitados en la configuración.

## CI/CD

Las pruebas E2E están configuradas para ejecutarse en CI con:
- Reintentos automáticos en fallos
- Ejecución secuencial para estabilidad
- Reportes en múltiples formatos (HTML, JSON, JUnit)
- Artifacts de screenshots y traces

## Troubleshooting

### Problemas Comunes

1. **Timeouts**: Aumentar timeouts para operaciones lentas
2. **Elementos no encontrados**: Verificar selectores y esperas
3. **Datos de prueba**: Verificar que el setup global se ejecutó correctamente
4. **Puertos ocupados**: Verificar que los puertos 3000 y 3001 estén disponibles

### Logs

Los logs de las pruebas se muestran en la consola y se incluyen en los reportes.