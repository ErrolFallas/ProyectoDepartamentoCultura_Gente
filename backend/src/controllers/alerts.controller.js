import { asyncHandler } from '../middleware/async-handler.js';
import * as alertsService from '../services/alerts.service.js';

export const alertsController = {
  list: asyncHandler(async (req, res) => {
    const items = await alertsService.listAlerts({
      periodo: req.query.periodo,
      nivel: req.query.nivel,
      atendida: req.query.atendida === undefined ? null : req.query.atendida === 'true'
    });
    res.json({ items });
  }),

  recalculate: asyncHandler(async (req, res) => {
    const result = await alertsService.recalculateAlerts({ periodo: req.body.periodo });
    res.status(201).json(result);
  }),

  focos: asyncHandler(async (req, res) => {
    const result = await alertsService.focosActuales({ periodo: req.query.periodo });
    res.json(result);
  }),

  atender: asyncHandler(async (req, res) => {
    const result = await alertsService.marcarAtendida({
      alertId: Number(req.params.id),
      usuarioId: req.user?.sub,
      notas: req.body?.notas,
      atendidaAt: req.body?.atendida_at
    });
    res.json(result);
  }),

  desmarcar: asyncHandler(async (req, res) => {
    const result = await alertsService.desmarcarAtendida({
      alertId: Number(req.params.id),
      motivo: req.body?.motivo
    });
    res.json(result);
  }),

  detalle: asyncHandler(async (req, res) => {
    const detalle = await alertsService.obtenerDetalle({
      alertId: Number(req.params.id)
    });
    res.json(detalle);
  })
};
