# Route Assignment System

Sistema asignador de rutas por zonas para interventores de ISES.

## Overview

The Route Assignment System is a web-based application that automates the distribution of inspection routes among interventores (inspectors) based on geographic zones and workload balancing. The system processes Excel data containing coordinates and addresses, manages 11 predefined zones (metropolitan and rural), and provides real-time monitoring capabilities.

## Features

- **Excel Data Processing**: Import and process Impuaa.xlsx files with coordinate and address data
- **Zone Management**: Manage 11 predefined geographic zones with PostGIS spatial operations
- **Inspector Management**: Register and manage inspector availability and preferences
- **Route Assignment**: Automatic route distribution based on zones and workload balancing
- **Real-time Monitoring**: Dashboard for supervisors to monitor route progress
- **Mobile Interface**: Mobile-friendly interface for inspectors to view and complete routes

## Technology Stack

- **Backend**: Node.js with Express.js and TypeScript
- **Database**: PostgreSQL with PostGIS extension for geospatial data
- **Cache**: Redis for session management and real-time data
- **File Processing**: SheetJS for Excel processing
- **Testing**: Jest with TypeScript support
- **Containerization**: Docker and Docker Compose

## Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── __tests__/       # Test files
│   ├── app.ts           # Express app configuration
│   └── server.ts        # Server entry point
├── database/            # Database initialization scripts
├── uploads/             # File upload directory
├── docker-compose.yml   # Docker services configuration
├── Dockerfile           # Application container
└── package.json         # Dependencies and scripts
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL 13+ with PostGIS extension
- Redis 6+
- Docker and Docker Compose (optional)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd route-assignment-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   
   **Option A: Using Docker (Recommended)**
   ```bash
   docker-compose up -d postgres redis
   ```
   
   **Option B: Manual setup**
   - Install PostgreSQL with PostGIS extension
   - Install Redis
   - Create database and run initialization scripts:
     ```bash
     psql -U postgres -d route_assignment_db -f database/init.sql
     psql -U postgres -d route_assignment_db -f database/seed.sql
     ```

## Development

1. **Start development server**
   ```bash
   npm run dev
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Run linting**
   ```bash
   npm run lint
   ```

## Docker Deployment

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f
   ```

3. **Stop services**
   ```bash
   docker-compose down
   ```

## API Endpoints

- `GET /api/v1/health` - Health check endpoint
- `GET /api/v1/health/ready` - Readiness check endpoint
- `GET /api/v1/` - API information

Additional endpoints will be added as features are implemented.

## Database Schema

The system uses PostgreSQL with PostGIS for spatial data management:

- **zones**: Geographic zones with polygon boundaries
- **inspectors**: Inspector information and preferences
- **coordinates**: Imported coordinate data from Excel files
- **routes**: Route definitions and assignments
- **route_points**: Individual points within routes
- **inspector_availability**: Inspector schedule management

## Testing

The project includes comprehensive testing:

- **Unit Tests**: Business logic and utility functions
- **Integration Tests**: Database operations and API endpoints
- **Coverage**: Minimum 80% code coverage requirement

Run tests with:
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm test -- --coverage    # With coverage report
```

## Contributing

1. Follow TypeScript best practices
2. Maintain test coverage above 80%
3. Use conventional commit messages
4. Update documentation for new features

## Environment Variables

Key environment variables (see `.env.example` for complete list):

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `DB_HOST`: PostgreSQL host
- `DB_NAME`: Database name
- `REDIS_HOST`: Redis host
- `JWT_SECRET`: JWT signing secret

## Health Checks

The application provides health check endpoints:

- `/api/v1/health`: Overall system health
- `/api/v1/health/ready`: Service readiness check

These endpoints verify database and Redis connectivity.

## Logging

The application uses structured logging with different levels:

- Development: Detailed console logging
- Production: JSON formatted logs with configurable levels

## Security

- Helmet.js for security headers
- CORS configuration
- JWT authentication (to be implemented)
- Input validation with Joi
- SQL injection prevention with parameterized queries

## Overview

This system automates the distribution of inspection routes among interventores (inspectors) based on geographic zones and workload balancing. It processes Excel data containing coordinates and addresses, manages 11 predefined zones (metropolitan and rural), and provides real-time monitoring capabilities.

## Features

- **Excel Data Processing**: Import and validate Impuaa.xlsx files with coordinate data
- **Zone Management**: Manage 11 predefined geographic zones with PostGIS integration
- **Inspector Management**: Register inspectors with availability and zone preferences
- **Automatic Route Assignment**: Intelligent distribution based on zones and workload
- **Real-time Monitoring**: Dashboard for supervisors to track progress
- **Mobile Interface**: Inspector mobile app for route execution

## Technology Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with PostGIS extension
- **Cache**: Redis
- **File Processing**: SheetJS for Excel files
- **Authentication**: JWT with role-based access control

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+ with PostGIS extension
- Redis 6+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd route-assignment-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create database and user
createdb route_assignment_db
psql route_assignment_db -f database/init.sql
psql route_assignment_db -f database/seed.sql
```

5. Start Redis server:
```bash
redis-server
```

## Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

- **Health Check**: `GET /api/v1/health`
- **Readiness Check**: `GET /api/v1/health/ready`

## Database Schema

The system uses the following main tables:
- `zones`: Geographic zones with PostGIS boundaries
- `inspectors`: Inspector information and preferences
- `coordinates`: Imported coordinate data from Excel files
- `routes`: Route definitions and assignments
- `route_points`: Individual points within routes

## Scripts

- `npm run build`: Build the TypeScript project
- `npm run start`: Start the production server
- `npm run dev`: Start development server with hot reload
- `npm run test`: Run tests
- `npm run lint`: Run ESLint
- `npm run lint:fix`: Fix ESLint issues

## Environment Variables

See `.env.example` for all available configuration options.

## Contributing

1. Follow TypeScript and ESLint configurations
2. Write tests for new features
3. Update documentation as needed
4. Follow conventional commit messages

## License

MIT License