# Deployment en Vercel

## Pasos para desplegar en Vercel

### 1. Preparar el repositorio
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin master
```

### 2. Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu cuenta de GitHub
3. Importa el repositorio `ISES-APP---4GS`

### 3. Configuración en Vercel
- **Framework Preset**: Other
- **Root Directory**: `./` (raíz del proyecto)
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/build`
- **Install Command**: `npm install && cd frontend && npm install`

### 4. Variables de entorno (opcional)
En el dashboard de Vercel, puedes agregar:
- `NODE_ENV=production`
- Otras variables según necesites

### 5. Estructura del proyecto para Vercel
```
/
├── api/                 # API endpoints para Vercel
│   └── index.ts        # Handler principal de la API
├── frontend/           # Aplicación React
│   ├── src/
│   ├── public/
│   └── package.json
├── src/                # Código del backend (para desarrollo local)
├── vercel.json         # Configuración de Vercel
└── package.json        # Dependencias principales
```

### 6. Endpoints disponibles después del deployment
- `https://tu-app.vercel.app/` - Frontend React
- `https://tu-app.vercel.app/api/health` - Health check
- `https://tu-app.vercel.app/api/v1/zones` - API de zonas
- `https://tu-app.vercel.app/api/v1/inspectors` - API de inspectores
- `https://tu-app.vercel.app/api/v1/routes` - API de rutas

### 7. Desarrollo local
Para desarrollo local, usa:
```bash
npm run dev  # Ejecuta backend y frontend en paralelo
```

### 8. Notas importantes
- La API en Vercel es básica y no incluye base de datos
- Para funcionalidad completa, necesitarás configurar una base de datos externa
- El frontend funcionará completamente en Vercel
- Los archivos estáticos se sirven desde el frontend build