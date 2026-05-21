-- =====================================================================
-- Snapshot del % personal negativo en el momento en que se marcó la
-- alerta como atendida. Permite detectar si llegan datos nuevos que
-- cambien significativamente el panorama y, en ese caso, reabrir la
-- alerta automáticamente (regla de >0.5 puntos porcentuales).
-- =====================================================================

ALTER TABLE alerts
  ADD COLUMN pct_negativo_al_atender DECIMAL(5,2) NULL AFTER notas;
