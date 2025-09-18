import { AssignmentAlgorithm } from '../../services/AssignmentAlgorithm';

describe('AssignmentAlgorithm - Simple Test', () => {
  it('should create an instance', () => {
    const algorithm = new AssignmentAlgorithm();
    expect(algorithm).toBeDefined();
  });
});