-- =====================================================================
-- Registro diario de consultas al asistente IA para enforcement de cuota.
-- Una fila por consulta realizada por cada usuario en cada día UTC.
-- =====================================================================

CREATE TABLE IF NOT EXISTS assistant_quota_log (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED       NOT NULL,
  fecha           DATE               NOT NULL,
  consultado_at   TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quota_user_fecha (user_id, fecha),
  CONSTRAINT fk_quota_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
