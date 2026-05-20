/**
 * Envuelve un handler async para que sus errores caigan en el error-handler.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
