import { matrixRoutes } from './matrix.routes';

describe('matrixRoutes', () => {
  it('keeps public question pages separate from the overview route', () => {
    const questionRoute = matrixRoutes.find((route) => route.path === 'questions/:sheetKey/:slug');
    const overviewRoute = matrixRoutes.find((route) => route.path === '');

    expect(questionRoute).toBeDefined();
    expect(matrixRoutes.find((route) => route.path === 'questions/:slug')).toBeUndefined();
    expect(overviewRoute).toBeDefined();
    expect(questionRoute).not.toBe(overviewRoute);
  });
});
