# Admin Dashboard Frontend

Panel de administración completo para el Sistema Asignador de Rutas por Zonas para Interventores.

## ✅ Características Implementadas

### 📁 Importación de Datos (Task 8.1)
- **Carga de archivos Excel**: Interfaz drag-and-drop para archivos .xlsx/.xls con validación de formato
- **Seguimiento de progreso**: Barra de progreso en tiempo real durante la carga y procesamiento
- **Validación de errores**: Visualización detallada de errores con información específica por fila y campo
- **Historial de importaciones**: Registro completo de todas las importaciones con estadísticas de éxito
- **Resumen de datos**: Dashboard con estadísticas y distribución por zonas con gráficos interactivos
- **Funcionalidad de exportación**: Múltiples formatos (Excel, CSV, PDF) con plantillas personalizables

### 🗺️ Gestión de Zonas (Task 8.2)
- **Visualización de mapas**: Integración con Leaflet para mostrar zonas geográficas
- **Gestión de límites**: Edición de coordenadas y límites de zonas con validación
- **Carga de archivos KMZ**: Procesamiento de archivos KMZ para definir límites precisos
- **Colores por zona**: Asignación y visualización de colores distintivos para cada zona
- **Estadísticas de zonas**: Métricas de coordenadas y distribución por tipo (metropolitana/rural)

### 👥 Gestión de Interventores (Task 8.2)
- **Registro de interventores**: Formularios completos con validación de datos
- **Gestión de disponibilidad**: Calendario semanal con horarios personalizables
- **Zonas preferidas**: Asignación de zonas de trabajo preferidas con visualización de colores
- **Seguimiento de carga**: Monitoreo de capacidad y utilización en tiempo real
- **Estadísticas de rendimiento**: Gráficos de carga de trabajo y disponibilidad

### 🛣️ Gestión de Rutas (Task 8.3)
- **Constructor de rutas**: Interfaz drag-and-drop para crear rutas con selección de puntos en mapa
- **Optimización automática**: Algoritmos para optimizar el orden de puntos en las rutas
- **Asignación inteligente**: Dashboard de asignación automática con filtros avanzados
- **Monitoreo en tiempo real**: Visualización del estado de rutas y carga de interventores
- **Creación masiva**: Herramientas para generar múltiples rutas automáticamente

## 🏗️ Estructura del Proyecto

```
frontend/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── Layout/                    # Layout principal con navegación
│   │   ├── FileUpload/               # Componente de carga de archivos
│   │   ├── ProgressBar/              # Barra de progreso
│   │   ├── ValidationErrors/         # Visualización de errores
│   │   ├── ImportHistory/            # Historial de importaciones
│   │   ├── DataSummary/              # Resumen de datos con gráficos
│   │   ├── ExportManager/            # Gestión de exportaciones
│   │   ├── ZoneMap/                  # Mapa interactivo de zonas
│   │   ├── ZoneForm/                 # Formulario de zonas
│   │   ├── InspectorForm/            # Formulario de interventores
│   │   ├── RouteBuilder/             # Constructor de rutas
│   │   └── AssignmentDashboard/      # Dashboard de asignaciones
│   ├── pages/
│   │   ├── Dashboard/                # Página principal
│   │   ├── FileImport/               # Página de importación
│   │   ├── ZoneManagement/           # Gestión de zonas
│   │   ├── InspectorManagement/      # Gestión de interventores
│   │   └── RouteManagement/          # Gestión de rutas
│   ├── services/
│   │   ├── api.ts                    # Cliente HTTP base
│   │   ├── fileService.ts            # Servicios de archivos
│   │   ├── zoneService.ts            # Servicios de zonas
│   │   ├── inspectorService.ts       # Servicios de interventores
│   │   └── routeService.ts           # Servicios de rutas
│   ├── App.tsx
│   └── index.tsx
└── package.json
```

## 🛠️ Tecnologías Utilizadas

- **React 18** con TypeScript para desarrollo robusto
- **React Router** para navegación SPA
- **Axios** para comunicación con API REST
- **React Dropzone** para carga de archivos drag-and-drop
- **Leaflet + React-Leaflet** para mapas interactivos
- **Recharts** para gráficos y visualizaciones de datos
- **React Beautiful DnD** para interfaces drag-and-drop
- **React Toastify** para notificaciones
- **Date-fns** para manejo de fechas
- **React Hook Form** para formularios optimizados

## 🚀 Instalación y Uso

1. **Instalar dependencias:**
```bash
cd frontend
npm install
```

2. **Iniciar servidor de desarrollo:**
```bash
npm start
```
La aplicación estará disponible en `http://localhost:3000`

3. **Construir para producción:**
```bash
npm run build
```

4. **Ejecutar tests:**
```bash
npm test
```

## ⚙️ Configuración

### Variables de Entorno
Crea un archivo `.env` en la raíz del frontend:

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Configuración de API
El frontend se conecta automáticamente al backend. Para cambiar la URL base, modifica `REACT_APP_API_URL` en el archivo `.env`.

## 📡 API Endpoints Esperados

El frontend espera los siguientes endpoints del backend:

### Importación y Exportación
- `POST /api/excel/import` - Importar archivo Excel
- `GET /api/excel/history` - Historial de importaciones
- `GET /api/excel/summary` - Resumen de datos
- `GET /api/export/templates` - Plantillas de exportación
- `POST /api/export/:templateId` - Exportar datos

### Gestión de Zonas
- `GET /api/zones` - Obtener todas las zonas
- `POST /api/zones` - Crear nueva zona
- `PUT /api/zones/:id` - Actualizar zona
- `DELETE /api/zones/:id` - Eliminar zona
- `POST /api/zones/upload-kmz` - Cargar archivo KMZ
- `GET /api/zones/stats` - Estadísticas de zonas

### Gestión de Interventores
- `GET /api/inspectors` - Obtener todos los interventores
- `POST /api/inspectors` - Crear nuevo interventor
- `PUT /api/inspectors/:id` - Actualizar interventor
- `DELETE /api/inspectors/:id` - Eliminar interventor
- `GET /api/inspectors/stats` - Estadísticas de interventores
- `GET /api/inspectors/workload` - Carga de trabajo

### Gestión de Rutas
- `GET /api/routes` - Obtener todas las rutas
- `POST /api/routes` - Crear nueva ruta
- `PUT /api/routes/:id` - Actualizar ruta
- `DELETE /api/routes/:id` - Eliminar ruta
- `POST /api/routes/assign` - Asignación automática
- `POST /api/routes/:id/optimize` - Optimizar ruta
- `GET /api/coordinates` - Coordenadas disponibles

## 🎨 Características de UI/UX

### Diseño Responsivo
- Compatible con dispositivos móviles, tablets y escritorio
- Breakpoints optimizados para diferentes tamaños de pantalla
- Navegación adaptativa según el dispositivo

### Accesibilidad
- Contraste de colores optimizado
- Navegación por teclado
- Etiquetas ARIA apropiadas
- Textos alternativos para elementos visuales

### Experiencia de Usuario
- Carga progresiva de datos
- Estados de loading y error claros
- Confirmaciones para acciones destructivas
- Feedback visual inmediato para todas las acciones

## 🔧 Desarrollo

### Estructura de Componentes
- **Componentes reutilizables** en `/components`
- **Páginas principales** en `/pages`
- **Servicios de API** en `/services`
- **Estilos CSS modulares** junto a cada componente

### Convenciones de Código
- TypeScript estricto para type safety
- Componentes funcionales con hooks
- Props interfaces bien definidas
- Manejo de errores consistente

### Testing
- Tests unitarios para componentes críticos
- Tests de integración para flujos principales
- Mocking de servicios API
- Coverage mínimo del 80%

## 📈 Métricas y Monitoreo

### Rendimiento
- Lazy loading de componentes pesados
- Optimización de re-renders con React.memo
- Debouncing en búsquedas y filtros
- Compresión de imágenes y assets

### Analytics
- Tracking de eventos de usuario
- Métricas de rendimiento
- Monitoreo de errores
- Análisis de uso de funcionalidades

## 🚀 Despliegue

### Build de Producción
```bash
npm run build
```

### Variables de Entorno de Producción
```env
REACT_APP_API_URL=https://api.ises-routes.com/api
REACT_APP_ENVIRONMENT=production
```

### Optimizaciones
- Code splitting automático
- Tree shaking para reducir bundle size
- Compresión gzip
- CDN para assets estáticos

## 🤝 Contribución

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para detalles.