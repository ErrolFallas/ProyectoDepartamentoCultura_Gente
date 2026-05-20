import { ValidationError } from '../utils/errors.js';

/**
 * Middleware genérico de validación con zod. Cada propiedad opcional valida
 * la sección correspondiente del request.
 *   validate({ body: schema, query: schema, params: schema })
 */
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      next();
    } catch (err) {
      const details = err.issues?.map((i) => ({
        path: i.path.join('.'),
        message: i.message
      }));
      next(new ValidationError('Datos inválidos', details));
    }
  };
}
