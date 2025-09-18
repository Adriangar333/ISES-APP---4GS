import { Coordinate, Route, RoutePoint } from '../types';
import { GeospatialService } from './GeospatialService';

export interface OptimizationOptions {
  algorithm: 'nearest_neighbor' | 'genetic' | 'two_opt';
  maxIterations?: number;
  populationSize?: number; // For genetic algorithm
  mutationRate?: number; // For genetic algorithm
  startPoint?: Coordinate;
  endPoint?: Coordinate;
  preserveStartEnd?: boolean;
}

export interface OptimizationResult {
  optimizedCoordinates: Coordinate[];
  originalDistance: number;
  optimizedDistance: number;
  improvementPercentage: number;
  executionTimeMs: number;
  algorithm: string;
  iterations: number;
}

export interface DistanceMatrix {
  [fromId: string]: {
    [toId: string]: number;
  };
}

export class RouteOptimizer {
  private geospatialService: GeospatialService;

  constructor(geospatialService?: GeospatialService) {
    this.geospatialService = geospatialService || new GeospatialService();
  }

  /**
   * Optimize route using the specified algorithm
   */
  async optimizeRoute(
    coordinates: Coordinate[],
    options: OptimizationOptions = { algorithm: 'nearest_neighbor' }
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    if (coordinates.length <= 2) {
      return {
        optimizedCoordinates: coordinates,
        originalDistance: coordinates.length === 2 ? 
          this.geospatialService.calculateDistanceMeters(coordinates[0]!, coordinates[1]!) : 0,
        optimizedDistance: coordinates.length === 2 ? 
          this.geospatialService.calculateDistanceMeters(coordinates[0]!, coordinates[1]!) : 0,
        improvementPercentage: 0,
        executionTimeMs: Date.now() - startTime,
        algorithm: options.algorithm,
        iterations: 0
      };
    }

    // Calculate distance matrix
    const distanceMatrix = await this.calculateDistanceMatrix(coordinates);
    const originalDistance = this.calculateTotalDistance(coordinates, distanceMatrix);

    let optimizedCoordinates: Coordinate[];
    let iterations = 0;

    switch (options.algorithm) {
      case 'nearest_neighbor':
        optimizedCoordinates = this.nearestNeighborOptimization(coordinates, distanceMatrix, options);
        iterations = 1;
        break;
      case 'genetic':
        const geneticResult = this.geneticAlgorithmOptimization(coordinates, distanceMatrix, options);
        optimizedCoordinates = geneticResult.coordinates;
        iterations = geneticResult.iterations;
        break;
      case 'two_opt':
        const twoOptResult = this.twoOptOptimization(coordinates, distanceMatrix, options);
        optimizedCoordinates = twoOptResult.coordinates;
        iterations = twoOptResult.iterations;
        break;
      default:
        throw new Error(`Unknown optimization algorithm: ${options.algorithm}`);
    }

    const optimizedDistance = this.calculateTotalDistance(optimizedCoordinates, distanceMatrix);
    const improvementPercentage = originalDistance > 0 ? 
      ((originalDistance - optimizedDistance) / originalDistance) * 100 : 0;

    return {
      optimizedCoordinates,
      originalDistance,
      optimizedDistance,
      improvementPercentage,
      executionTimeMs: Date.now() - startTime,
      algorithm: options.algorithm,
      iterations
    };
  }

  /**
   * Calculate distance matrix between all coordinates
   */
  private async calculateDistanceMatrix(coordinates: Coordinate[]): Promise<DistanceMatrix> {
    const matrix: DistanceMatrix = {};

    for (const from of coordinates) {
      matrix[from.id] = {};
      for (const to of coordinates) {
        if (from.id === to.id) {
          matrix[from.id]![to.id] = 0;
        } else {
          matrix[from.id]![to.id] = this.geospatialService.calculateDistanceMeters(from, to);
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate total distance for a route
   */
  private calculateTotalDistance(coordinates: Coordinate[], distanceMatrix: DistanceMatrix): number {
    if (coordinates.length <= 1) return 0;

    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = coordinates[i]!;
      const to = coordinates[i + 1]!;
      totalDistance += distanceMatrix[from.id]?.[to.id] || 0;
    }

    return totalDistance;
  }

  /**
   * Nearest Neighbor Algorithm - Simple greedy approach
   */
  private nearestNeighborOptimization(
    coordinates: Coordinate[],
    distanceMatrix: DistanceMatrix,
    options: OptimizationOptions
  ): Coordinate[] {
    if (coordinates.length <= 1) return coordinates;

    const unvisited = new Set(coordinates.map(c => c.id));
    const optimized: Coordinate[] = [];

    // Start with specified start point or first coordinate
    let current = options.startPoint || coordinates[0]!;
    optimized.push(current);
    unvisited.delete(current.id);

    // Visit nearest unvisited coordinate until all are visited
    while (unvisited.size > 0) {
      let nearestDistance = Infinity;
      let nearestCoordinate: Coordinate | null = null;

      for (const coord of coordinates) {
        if (unvisited.has(coord.id)) {
          const distance = distanceMatrix[current.id]?.[coord.id] || Infinity;
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCoordinate = coord;
          }
        }
      }

      if (nearestCoordinate) {
        optimized.push(nearestCoordinate);
        unvisited.delete(nearestCoordinate.id);
        current = nearestCoordinate;
      } else {
        break;
      }
    }

    // Add end point if specified and different from last point
    if (options.endPoint && optimized[optimized.length - 1]?.id !== options.endPoint.id) {
      optimized.push(options.endPoint);
    }

    return optimized;
  }

  /**
   * Genetic Algorithm - Population-based optimization
   */
  private geneticAlgorithmOptimization(
    coordinates: Coordinate[],
    distanceMatrix: DistanceMatrix,
    options: OptimizationOptions
  ): { coordinates: Coordinate[]; iterations: number } {
    const populationSize = options.populationSize || 50;
    const maxIterations = options.maxIterations || 100;
    const mutationRate = options.mutationRate || 0.1;

    // Initialize population with random permutations
    let population = this.initializePopulation(coordinates, populationSize, options);
    let bestSolution = population[0]!;
    let bestDistance = this.calculateTotalDistance(bestSolution, distanceMatrix);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Evaluate fitness for all individuals
      const fitness = population.map(individual => {
        const distance = this.calculateTotalDistance(individual, distanceMatrix);
        return { individual, distance, fitness: 1 / (1 + distance) };
      });

      // Sort by fitness (higher is better)
      fitness.sort((a, b) => b.fitness - a.fitness);

      // Update best solution
      if (fitness[0]!.distance < bestDistance) {
        bestSolution = fitness[0]!.individual;
        bestDistance = fitness[0]!.distance;
      }

      // Create new population
      const newPopulation: Coordinate[][] = [];

      // Keep best 20% (elitism)
      const eliteCount = Math.floor(populationSize * 0.2);
      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push([...fitness[i]!.individual]);
      }

      // Generate offspring for remaining population
      while (newPopulation.length < populationSize) {
        const parent1 = this.tournamentSelection(fitness, 3);
        const parent2 = this.tournamentSelection(fitness, 3);
        const offspring = this.crossover(parent1, parent2, options);
        
        if (Math.random() < mutationRate) {
          this.mutate(offspring, options);
        }
        
        newPopulation.push(offspring);
      }

      population = newPopulation;
    }

    return { coordinates: bestSolution, iterations: maxIterations };
  }

  /**
   * 2-Opt Algorithm - Local search optimization
   */
  private twoOptOptimization(
    coordinates: Coordinate[],
    distanceMatrix: DistanceMatrix,
    options: OptimizationOptions
  ): { coordinates: Coordinate[]; iterations: number } {
    let currentRoute = [...coordinates];
    let bestDistance = this.calculateTotalDistance(currentRoute, distanceMatrix);
    let improved = true;
    let iterations = 0;
    const maxIterations = options.maxIterations || 1000;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 1; i < currentRoute.length - 2; i++) {
        for (let j = i + 1; j < currentRoute.length; j++) {
          // Skip if preserving start/end points
          if (options.preserveStartEnd && (i === 0 || j === currentRoute.length - 1)) {
            continue;
          }

          // Create new route by reversing the segment between i and j
          const newRoute = this.twoOptSwap(currentRoute, i, j);
          const newDistance = this.calculateTotalDistance(newRoute, distanceMatrix);

          if (newDistance < bestDistance) {
            currentRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }

    return { coordinates: currentRoute, iterations };
  }

  /**
   * Initialize population for genetic algorithm
   */
  private initializePopulation(
    coordinates: Coordinate[],
    populationSize: number,
    options: OptimizationOptions
  ): Coordinate[][] {
    const population: Coordinate[][] = [];

    for (let i = 0; i < populationSize; i++) {
      let individual = [...coordinates];
      
      // Shuffle the coordinates (except start/end if preserved)
      if (options.preserveStartEnd && options.startPoint && options.endPoint) {
        const middle = individual.slice(1, -1);
        this.shuffleArray(middle);
        individual = [options.startPoint, ...middle, options.endPoint];
      } else {
        this.shuffleArray(individual);
      }
      
      population.push(individual);
    }

    return population;
  }

  /**
   * Tournament selection for genetic algorithm
   */
  private tournamentSelection(
    fitness: Array<{ individual: Coordinate[]; distance: number; fitness: number }>,
    tournamentSize: number
  ): Coordinate[] {
    let best = fitness[Math.floor(Math.random() * fitness.length)]!;
    
    for (let i = 1; i < tournamentSize; i++) {
      const candidate = fitness[Math.floor(Math.random() * fitness.length)]!;
      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    
    return best.individual;
  }

  /**
   * Order crossover (OX) for genetic algorithm
   */
  private crossover(parent1: Coordinate[], parent2: Coordinate[], options: OptimizationOptions): Coordinate[] {
    const length = parent1.length;
    const offspring: Coordinate[] = new Array(length);
    
    // Select a random segment from parent1
    const start = Math.floor(Math.random() * length);
    const end = Math.floor(Math.random() * length);
    const [segmentStart, segmentEnd] = start < end ? [start, end] : [end, start];
    
    // Copy segment from parent1
    for (let i = segmentStart; i <= segmentEnd; i++) {
      offspring[i] = parent1[i]!;
    }
    
    // Fill remaining positions with parent2's order
    let parent2Index = 0;
    for (let i = 0; i < length; i++) {
      if (!offspring[i]) {
        while (offspring.some(coord => coord?.id === parent2[parent2Index]?.id)) {
          parent2Index++;
        }
        offspring[i] = parent2[parent2Index]!;
        parent2Index++;
      }
    }
    
    return offspring;
  }

  /**
   * Mutation for genetic algorithm
   */
  private mutate(individual: Coordinate[], options: OptimizationOptions): void {
    const length = individual.length;
    
    // Swap mutation - swap two random positions
    const pos1 = Math.floor(Math.random() * length);
    let pos2 = Math.floor(Math.random() * length);
    
    // Ensure different positions
    while (pos2 === pos1) {
      pos2 = Math.floor(Math.random() * length);
    }
    
    // Don't mutate start/end if preserved
    if (options.preserveStartEnd) {
      if (pos1 === 0 || pos1 === length - 1 || pos2 === 0 || pos2 === length - 1) {
        return;
      }
    }
    
    // Swap positions
    [individual[pos1], individual[pos2]] = [individual[pos2]!, individual[pos1]!];
  }

  /**
   * 2-opt swap operation
   */
  private twoOptSwap(route: Coordinate[], i: number, j: number): Coordinate[] {
    const newRoute = [...route];
    
    // Reverse the segment between i and j
    const segment = newRoute.slice(i, j + 1).reverse();
    newRoute.splice(i, j - i + 1, ...segment);
    
    return newRoute;
  }

  /**
   * Shuffle array in place
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
  }

  /**
   * Optimize multiple routes simultaneously with zone constraints
   */
  async optimizeMultiZoneRoutes(
    routes: Array<{ coordinates: Coordinate[]; zoneId?: string }>,
    options: OptimizationOptions = { algorithm: 'nearest_neighbor' }
  ): Promise<Array<OptimizationResult & { zoneId?: string }>> {
    const results: Array<OptimizationResult & { zoneId?: string }> = [];

    for (const route of routes) {
      const result = await this.optimizeRoute(route.coordinates, options);
      const resultWithZone: OptimizationResult & { zoneId?: string } = {
        ...result
      };
      
      if (route.zoneId) {
        resultWithZone.zoneId = route.zoneId;
      }
      
      results.push(resultWithZone);
    }

    return results;
  }

  /**
   * Benchmark different algorithms on the same route
   */
  async benchmarkAlgorithms(
    coordinates: Coordinate[],
    algorithms: OptimizationOptions['algorithm'][] = ['nearest_neighbor', 'two_opt', 'genetic']
  ): Promise<Array<OptimizationResult & { algorithm: string }>> {
    const results: Array<OptimizationResult & { algorithm: string }> = [];

    for (const algorithm of algorithms) {
      const options: OptimizationOptions = { algorithm };
      
      // Adjust parameters based on algorithm
      if (algorithm === 'genetic') {
        options.maxIterations = 50; // Reduce for benchmarking
        options.populationSize = 30;
      } else if (algorithm === 'two_opt') {
        options.maxIterations = 500;
      }

      const result = await this.optimizeRoute(coordinates, options);
      results.push({
        ...result,
        algorithm
      });
    }

    return results;
  }

  /**
   * Calculate optimization statistics for performance analysis
   */
  calculateOptimizationStats(results: OptimizationResult[]): {
    averageImprovement: number;
    bestImprovement: number;
    worstImprovement: number;
    averageExecutionTime: number;
    totalDistanceSaved: number;
  } {
    if (results.length === 0) {
      return {
        averageImprovement: 0,
        bestImprovement: 0,
        worstImprovement: 0,
        averageExecutionTime: 0,
        totalDistanceSaved: 0
      };
    }

    const improvements = results.map(r => r.improvementPercentage);
    const executionTimes = results.map(r => r.executionTimeMs);
    const distanceSaved = results.reduce((sum, r) => sum + (r.originalDistance - r.optimizedDistance), 0);

    return {
      averageImprovement: improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length,
      bestImprovement: Math.max(...improvements),
      worstImprovement: Math.min(...improvements),
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      totalDistanceSaved: distanceSaved
    };
  }
}