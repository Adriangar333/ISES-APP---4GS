# Security Implementation

Este documento describe las medidas de seguridad implementadas en el Sistema de Asignación de Rutas.

## Tabla de Contenidos

1. [Rate Limiting](#rate-limiting)
2. [Input Sanitization](#input-sanitization)
3. [Security Headers](#security-headers)
4. [HTTPS Enforcement](#https-enforcement)
5. [API Key Management](#api-key-management)
6. [Request Size Limiting](#request-size-limiting)
7. [Configuration](#configuration)
8. [Monitoring](#monitoring)

## Rate Limiting

### Implementación

El sistema implementa rate limiting usando Redis para almacenar contadores de solicitudes por IP y endpoint.

### Límites por Endpoint

```typescript
// Límites generales de API
general: 1000 requests per 15 minutes

// Autenticación (más estricto)
auth: 10 requests per 15 minutes

// Subida de archivos
upload: 20 requests per hour

// Creación de recursos
creation: 100 requests per hour

// Exportación de datos
export: 50 requests per hour
```

### Headers de Rate Limiting

```
X-RateLimit-Limit: Límite máximo de solicitudes
X-RateLimit-Remaining: Solicitudes restantes en la ventana actual
X-RateLimit-Reset: Timestamp de reset de la ventana
```

### Respuesta de Rate Limit Excedido

```json
{
  "error": {
    "code": "429",
    "message": "Too many requests, please try again later.",
    "retryAfter": 300,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Configuración Personalizada

```typescript
const customRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100,
  message: 'Custom rate limit message',
  keyGenerator: (req) => `${req.ip}:${req.user?.id}` // Rate limit por usuario
});
```

## Input Sanitization

### Características

- **Sanitización HTML**: Elimina tags y scripts maliciosos
- **Trim de strings**: Elimina espacios en blanco
- **Normalización de emails**: Convierte a minúsculas y normaliza formato
- **Escape HTML**: Escapa caracteres especiales
- **Eliminación de null bytes**: Previene ataques de null byte injection
- **Límite de longitud**: Previene ataques de buffer overflow

### Sanitizadores Específicos

```typescript
// Email
InputSanitizer.sanitizeEmail('  TEST@EXAMPLE.COM  ') 
// → 'test@example.com'

// Teléfono
InputSanitizer.sanitizePhoneNumber('+1 (555) 123-4567') 
// → '+15551234567'

// Coordenadas
InputSanitizer.sanitizeCoordinate('4.123456789') 
// → 4.12345679

// IDs
InputSanitizer.sanitizeId('user@123#test') 
// → 'user123test'

// Nombres de archivo
InputSanitizer.sanitizeFilename('../../../etc/passwd') 
// → 'etcpasswd'
```

### Validadores de Campo

```typescript
const fieldValidations = {
  email: fieldValidators.email,
  phone: fieldValidators.phone,
  coordinate: fieldValidators.coordinate,
  uuid: fieldValidators.uuid,
  name: fieldValidators.length(2, 50)
};

app.use('/api/v1/users', validateAndSanitizeFields(fieldValidations));
```

## Security Headers

### Headers Implementados

#### Content Security Policy (CSP)
```
default-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
script-src 'self';
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' wss: https:;
media-src 'self' blob:;
object-src 'none';
frame-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

#### HTTP Strict Transport Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

#### Otros Headers de Seguridad
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

#### Permissions Policy
```
camera=('self'), 
microphone=('none'), 
geolocation=('self'), 
payment=('none'), 
usb=('none')
```

### Configuración Personalizada

```typescript
const securityHeaders = new SecurityHeaders({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted-cdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    },
    reportOnly: false // true para modo report-only
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});
```

## HTTPS Enforcement

### Implementación

En producción, todas las solicitudes HTTP se redirigen automáticamente a HTTPS.

```typescript
// Redirección automática en producción
app.use(httpsEnforcement({ trustProxy: true }));
```

### Configuración de Proxy

Para aplicaciones detrás de un proxy (como nginx o load balancer):

```typescript
const httpsMiddleware = httpsEnforcement({ 
  trustProxy: true // Confía en headers X-Forwarded-Proto
});
```

## API Key Management

### Uso

```typescript
const apiKeyManager = new ApiKeyManager([
  'api-key-1',
  'api-key-2'
]);

app.use('/api/v1', apiKeyManager.middleware());
```

### Headers Requeridos

```
X-API-Key: your-api-key-here
```

### Rutas Excluidas

Las siguientes rutas no requieren API key:
- `/health`
- `/api/v1/auth/login`
- `/api/v1/auth/register`

### Gestión Dinámica

```typescript
// Agregar nueva API key
apiKeyManager.addApiKey('new-api-key');

// Remover API key
apiKeyManager.removeApiKey('old-api-key');

// Verificar validez
const isValid = apiKeyManager.isValidApiKey('test-key');
```

## Request Size Limiting

### Límites Implementados

- **Cuerpo de solicitud**: 50MB (para subida de archivos)
- **Parámetros URL**: 100 parámetros máximo
- **Headers**: Límites estándar del servidor

### Configuración

```typescript
app.use(requestSizeLimiter('10mb')); // Límite personalizado
```

### Respuesta de Límite Excedido

```json
{
  "error": {
    "code": "413",
    "message": "Request entity too large",
    "maxSize": "10mb",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Configuration

### Variables de Entorno

```bash
# Redis para rate limiting
REDIS_URL=redis://localhost:6379

# Configuración de seguridad
SECURITY_API_KEYS=key1,key2,key3
SECURITY_RATE_LIMIT_ENABLED=true
SECURITY_HTTPS_ENFORCE=true

# CSP configuración
CSP_REPORT_URI=https://your-domain.com/csp-report
CSP_REPORT_ONLY=false
```

### Configuración de Producción

```typescript
// config/security.ts
export const securityConfig = {
  rateLimiting: {
    enabled: process.env.SECURITY_RATE_LIMIT_ENABLED === 'true',
    redis: {
      url: process.env.REDIS_URL
    }
  },
  headers: {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    csp: {
      reportUri: process.env.CSP_REPORT_URI,
      reportOnly: process.env.CSP_REPORT_ONLY === 'true'
    }
  },
  apiKeys: process.env.SECURITY_API_KEYS?.split(',') || []
};
```

## Monitoring

### Métricas de Seguridad

El sistema registra las siguientes métricas de seguridad:

1. **Rate Limiting**
   - Número de solicitudes bloqueadas por rate limiting
   - IPs más activas
   - Endpoints más solicitados

2. **Input Sanitization**
   - Intentos de XSS bloqueados
   - Caracteres maliciosos eliminados
   - Validaciones fallidas

3. **Security Headers**
   - Violaciones de CSP reportadas
   - Intentos de clickjacking bloqueados

### Logs de Seguridad

```typescript
// Ejemplo de log de seguridad
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "warn",
  "type": "security",
  "event": "rate_limit_exceeded",
  "ip": "192.168.1.100",
  "endpoint": "/api/v1/auth/login",
  "attempts": 11,
  "limit": 10
}
```

### Alertas

Configure alertas para:
- Rate limiting excedido repetidamente desde la misma IP
- Intentos de XSS o injection
- Violaciones de CSP
- Solicitudes con API keys inválidas

## Best Practices

### Para Desarrolladores

1. **Siempre validar entrada**: Use los validadores proporcionados
2. **Sanitizar datos**: Aplique sanitización antes de procesar
3. **Límites apropiados**: Configure rate limits según el uso esperado
4. **Headers de seguridad**: Mantenga headers actualizados
5. **Monitoreo**: Revise logs de seguridad regularmente

### Para Administradores

1. **API Keys**: Rote API keys regularmente
2. **Rate Limits**: Ajuste límites según patrones de uso
3. **HTTPS**: Asegure que HTTPS esté habilitado en producción
4. **Monitoreo**: Configure alertas de seguridad
5. **Actualizaciones**: Mantenga dependencias actualizadas

### Para Usuarios

1. **Contraseñas fuertes**: Use contraseñas seguras
2. **API Keys**: Mantenga API keys seguras
3. **HTTPS**: Siempre use conexiones HTTPS
4. **Reportes**: Reporte actividad sospechosa

## Troubleshooting

### Rate Limiting Issues

```bash
# Verificar estado de Redis
redis-cli ping

# Ver contadores actuales
redis-cli keys "rate_limit:*"

# Limpiar contadores (emergencia)
redis-cli flushdb
```

### CSP Violations

1. Revise logs de violaciones CSP
2. Ajuste directivas según necesidades
3. Use modo report-only para testing

### Performance Impact

Las medidas de seguridad tienen un impacto mínimo en performance:
- Rate limiting: ~1ms por solicitud
- Sanitización: ~2ms por solicitud
- Security headers: ~0.5ms por solicitud

## Updates and Maintenance

### Actualizaciones de Seguridad

1. Revise dependencias mensualmente
2. Actualice rate limits según patrones de uso
3. Revise y actualice CSP policies
4. Rote API keys trimestralmente

### Auditorías de Seguridad

Realice auditorías regulares de:
- Configuración de rate limiting
- Efectividad de sanitización
- Compliance de security headers
- Gestión de API keys