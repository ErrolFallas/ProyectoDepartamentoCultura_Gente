-- =====================================================================
-- Caché de respuestas del asistente IA.
-- Memoriza preguntas exactas (normalizadas) para responder en milisegundos
-- y sin gastar cuota cuando llega la misma pregunta dentro del TTL.
-- También sirve como log de preguntas populares para alimentar sugerencias.
-- =====================================================================

CREATE TABLE IF NOT EXISTS assistant_cache (
  id                  BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  pregunta_hash       CHAR(64)           NOT NULL,
  pregunta_original   VARCHAR(1000)      NOT NULL,
  pregunta_normalizada VARCHAR(1000)     NOT NULL,
  respuesta_json      JSON               NOT NULL,
  modelo              VARCHAR(60)        NULL,
  latencia_ms_origen  INT UNSIGNED       NULL,
  hit_count           INT UNSIGNED       NOT NULL DEFAULT 0,
  created_at          TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_hit_at         TIMESTAMP          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pregunta_hash (pregunta_hash),
  KEY idx_cache_recent (created_at),
  KEY idx_cache_popular (hit_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
