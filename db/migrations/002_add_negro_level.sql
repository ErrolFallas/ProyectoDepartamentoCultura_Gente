-- =====================================================================
-- Añade el nivel NEGRO al termómetro de clima.
-- NEGRO se dispara con pct_negativo >= SEMAFORO_NEGRO_MIN (default 90).
-- =====================================================================

ALTER TABLE alerts
  MODIFY COLUMN nivel ENUM('VERDE','AMARILLO','ROJO','NEGRO') NOT NULL;
