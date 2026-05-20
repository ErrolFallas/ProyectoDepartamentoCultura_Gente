-- =====================================================================
-- Garnier PulseWork - Esquema inicial
-- =====================================================================
-- Decisiones arquitectónicas reflejadas en este schema:
--   * Anonimato estricto: ninguna columna identifica a la persona.
--   * Polaridad declarada en la pregunta, nunca inferida en la respuesta.
--   * Snapshots mensuales inmutables: tabla aparte, sin recálculo.
--   * Hash anti-duplicados sobre la fila origen de Forms.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Catálogo organizacional
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS companies (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(150)       NOT NULL,
  codigo          VARCHAR(40)        NULL,
  activo          TINYINT(1)         NOT NULL DEFAULT 1,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  company_id      INT UNSIGNED       NOT NULL,
  nombre          VARCHAR(150)       NOT NULL,
  activo          TINYINT(1)         NOT NULL DEFAULT 1,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dept_company_nombre (company_id, nombre),
  CONSTRAINT fk_dept_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Catálogo de preguntas
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dimensions (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(60)        NOT NULL,
  nombre          VARCHAR(150)       NOT NULL,
  descripcion     VARCHAR(500)       NULL,
  orden           INT                NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dimension_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scales (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(60)        NOT NULL,
  nombre          VARCHAR(150)       NOT NULL,
  tipo            ENUM('LIKERT','FRECUENCIA','BINARIA','NIVEL','COMPRENSION','EMOCIONAL','ABIERTA') NOT NULL,
  niveles         INT                NULL,
  -- Mapeo opción -> valor normalizado base (0-100, polaridad directa).
  -- Las opciones específicas se guardan en question_options.
  opciones_json   JSON               NULL,
  descripcion     VARCHAR(500)       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_scale_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(80)        NOT NULL,
  texto           TEXT               NOT NULL,
  dimension_id    INT UNSIGNED       NULL,
  subdimension    VARCHAR(150)       NULL,
  scale_id        INT UNSIGNED       NOT NULL,
  polaridad       ENUM('DIRECTA','INVERSA','NEUTRA') NOT NULL DEFAULT 'DIRECTA',
  estado          ENUM('CONFIRMADA','PENDIENTE_REVISION','DESCARTADA') NOT NULL DEFAULT 'PENDIENTE_REVISION',
  origen          ENUM('CATALOGO','FORMS','MANUAL','IA') NOT NULL DEFAULT 'CATALOGO',
  activa          TINYINT(1)         NOT NULL DEFAULT 1,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_question_codigo (codigo),
  KEY idx_question_estado (estado),
  KEY idx_question_dimension (dimension_id),
  CONSTRAINT fk_question_dimension
    FOREIGN KEY (dimension_id) REFERENCES dimensions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_question_scale
    FOREIGN KEY (scale_id) REFERENCES scales(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_options (
  id                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  question_id         INT UNSIGNED   NOT NULL,
  etiqueta            VARCHAR(255)   NOT NULL,
  valor_crudo         VARCHAR(40)    NULL,
  -- Valor normalizado en escala 0-100 ya aplicada la polaridad. NULL si NEUTRA.
  valor_normalizado   DECIMAL(5,2)   NULL,
  orden               INT            NOT NULL DEFAULT 0,
  es_no_aplica        TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_question_opt (question_id, etiqueta),
  KEY idx_question_options_q (question_id),
  CONSTRAINT fk_qopt_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Encuestas y respuestas (anónimas)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS survey_runs (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(60)        NOT NULL,
  nombre          VARCHAR(200)       NOT NULL,
  periodo         VARCHAR(20)        NOT NULL,   -- 'YYYY-MM', 'YYYY-Qn' o 'YYYY'
  fecha_inicio    DATE               NOT NULL,
  fecha_fin       DATE               NULL,
  estado          ENUM('ABIERTA','CERRADA','ARCHIVADA') NOT NULL DEFAULT 'ABIERTA',
  notas           VARCHAR(500)       NULL,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_run_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS responses (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  survey_run_id   INT UNSIGNED       NOT NULL,
  company_id      INT UNSIGNED       NOT NULL,
  department_id   INT UNSIGNED       NOT NULL,
  submitted_at    DATETIME           NOT NULL,
  -- Hash SHA256 de la fila origen del Excel de Forms (anti-duplicado).
  source_row_hash CHAR(64)           NOT NULL,
  -- Promedio normalizado 0-100 al momento del último scoring (NULL si nada puntúa todavía).
  score_promedio  DECIMAL(5,2)       NULL,
  -- Clasificación de la respuesta como conjunto.
  sentimiento     ENUM('POSITIVO','NEUTRO','NEGATIVO','EN_ESPERA') NOT NULL DEFAULT 'EN_ESPERA',
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_response_hash (source_row_hash),
  KEY idx_response_periodo (submitted_at),
  KEY idx_response_org (company_id, department_id),
  KEY idx_response_run (survey_run_id),
  CONSTRAINT fk_response_run
    FOREIGN KEY (survey_run_id) REFERENCES survey_runs(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_response_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_response_dept
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answers (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  response_id         BIGINT UNSIGNED NOT NULL,
  question_id         INT UNSIGNED    NOT NULL,
  valor_crudo         TEXT            NULL,
  valor_normalizado   DECIMAL(5,2)    NULL,
  sentimiento         ENUM('POSITIVO','NEUTRO','NEGATIVO') NULL,
  estado              ENUM('PUNTUADA','EN_ESPERA','NO_APLICA','TEXTO_ABIERTO') NOT NULL DEFAULT 'EN_ESPERA',
  motivo_espera       VARCHAR(120)    NULL,
  scored_at           TIMESTAMP       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_answer_resp_q (response_id, question_id),
  KEY idx_answer_question (question_id),
  KEY idx_answer_estado (estado),
  CONSTRAINT fk_answer_response
    FOREIGN KEY (response_id) REFERENCES responses(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_answer_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS open_text_analysis (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  answer_id       BIGINT UNSIGNED    NOT NULL,
  tono            ENUM('POSITIVO','NEUTRO','NEGATIVO') NOT NULL,
  temas           JSON               NULL,
  modelo          VARCHAR(60)        NULL,
  score_confianza DECIMAL(4,3)       NULL,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_open_text_answer (answer_id),
  CONSTRAINT fk_open_text_answer
    FOREIGN KEY (answer_id) REFERENCES answers(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Agregación, ranking y alertas
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  periodo         CHAR(7)            NOT NULL,                  -- 'YYYY-MM'
  scope           ENUM('COMPANY','DEPARTMENT','QUESTION_COMPANY','QUESTION_DEPARTMENT') NOT NULL,
  scope_id        INT UNSIGNED       NOT NULL,
  question_id     INT UNSIGNED       NULL,
  n_respuestas    INT UNSIGNED       NOT NULL DEFAULT 0,
  pct_positivo    DECIMAL(5,2)       NOT NULL DEFAULT 0,
  pct_neutro      DECIMAL(5,2)       NOT NULL DEFAULT 0,
  pct_negativo    DECIMAL(5,2)       NOT NULL DEFAULT 0,
  promedio_norm   DECIMAL(5,2)       NOT NULL DEFAULT 0,
  congelado_at    TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_snapshot (periodo, scope, scope_id, question_id),
  KEY idx_snapshot_lookup (scope, scope_id, periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rankings_cache (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  tipo            ENUM('GLOBAL','POR_PREGUNTA','POR_DIMENSION') NOT NULL,
  scope           ENUM('COMPANY','DEPARTMENT') NOT NULL,
  periodo         CHAR(7)            NOT NULL,
  question_id     INT UNSIGNED       NULL,
  dimension_id    INT UNSIGNED       NULL,
  scope_id        INT UNSIGNED       NOT NULL,
  posicion        INT UNSIGNED       NOT NULL,
  valor           DECIMAL(5,2)       NOT NULL,
  calculado_at    TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ranking_lookup (tipo, scope, periodo, scope_id),
  KEY idx_ranking_q (question_id),
  KEY idx_ranking_dim (dimension_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alerts (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  department_id   INT UNSIGNED       NOT NULL,
  periodo         CHAR(7)            NOT NULL,
  pct_negativo    DECIMAL(5,2)       NOT NULL,
  nivel           ENUM('VERDE','AMARILLO','ROJO') NOT NULL,
  atendida        TINYINT(1)         NOT NULL DEFAULT 0,
  atendida_por    INT UNSIGNED       NULL,
  atendida_at     TIMESTAMP          NULL,
  notas           VARCHAR(500)       NULL,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alert_dept_periodo (department_id, periodo),
  KEY idx_alert_nivel (nivel),
  CONSTRAINT fk_alert_dept
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Seguridad y operación
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  email           VARCHAR(180)       NOT NULL,
  password_hash   VARCHAR(255)       NOT NULL,
  nombre          VARCHAR(150)       NOT NULL,
  role            ENUM('ADMIN','ANALISTA') NOT NULL DEFAULT 'ANALISTA',
  activo          TINYINT(1)         NOT NULL DEFAULT 1,
  ultimo_login_at TIMESTAMP          NULL,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_classifications (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id             INT UNSIGNED    NULL,
  texto_pregunta          TEXT            NOT NULL,
  polaridad_sugerida      ENUM('DIRECTA','INVERSA','NEUTRA') NOT NULL,
  dimension_sugerida      VARCHAR(80)     NULL,
  razon                   VARCHAR(500)    NULL,
  confianza               DECIMAL(4,3)    NULL,
  modelo                  VARCHAR(60)     NULL,
  estado                  ENUM('PENDIENTE_REVISION','CONFIRMADA','CORREGIDA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE_REVISION',
  confirmada_por          INT UNSIGNED    NULL,
  confirmada_at           TIMESTAMP       NULL,
  polaridad_final         ENUM('DIRECTA','INVERSA','NEUTRA') NULL,
  created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_question (question_id),
  KEY idx_ai_estado (estado),
  CONSTRAINT fk_ai_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ai_user
    FOREIGN KEY (confirmada_por) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingest_log (
  id              BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  source_row_hash CHAR(64)           NOT NULL,
  estado          ENUM('OK','DUPLICADO','ERROR','PENDIENTE') NOT NULL,
  error           VARCHAR(500)       NULL,
  payload_sample  JSON               NULL,
  recibido_at     TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ingest_hash (source_row_hash),
  KEY idx_ingest_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
