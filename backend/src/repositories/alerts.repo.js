import { pool } from '../db/pool.js';

export const alertsRepo = {
  async list({ periodo = null, nivel = null, atendida = null } = {}, executor = pool) {
    const where = [];
    const params = [];
    if (periodo) { where.push('a.periodo = ?'); params.push(periodo); }
    if (nivel)   { where.push('a.nivel = ?'); params.push(nivel); }
    if (atendida !== null) { where.push('a.atendida = ?'); params.push(atendida ? 1 : 0); }

    const [rows] = await executor.query(
      `SELECT a.id, a.department_id, d.nombre AS departamento, d.company_id,
              c.nombre AS empresa, a.periodo, a.pct_negativo, a.nivel,
              a.atendida, a.atendida_por, a.atendida_at, a.notas,
              a.pct_negativo_al_atender, a.created_at
         FROM alerts a
         JOIN departments d ON d.id = a.department_id
         JOIN companies c ON c.id = d.company_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY FIELD(a.nivel, 'NEGRO', 'ROJO', 'AMARILLO', 'VERDE'), a.pct_negativo DESC`,
      params
    );
    return rows;
  },

  /**
   * Upsert por (department_id, periodo). Si ya existe, actualiza nivel/pct.
   *
   * Si la alerta estaba marcada como atendida, se REABRE
   * (atendida=0, atendida_at=NULL, atendida_por=NULL, pct_negativo_al_atender=NULL)
   * cuando:
   *   - el nuevo pct es DIFERENTE al pct vigente al momento de atender, Y
   *   - el nuevo pct está por encima del umbral de "estable" (PCT_ESTABLE_MAX),
   *     es decir, hay algo que volver a atender.
   *
   * Si el nuevo pct cae por debajo del umbral estable (≈ 0), se conserva
   * el estado atendida=1 — la UI mostrará "Estable / no requiere atención"
   * pero el registro histórico se mantiene.
   *
   * Las notas previas se conservan como historial en ambos casos.
   */
  async upsert({ department_id, periodo, pct_negativo, nivel }, executor = pool) {
    const PCT_ESTABLE_MAX = 0.1;
    await executor.query(
      `INSERT INTO alerts (department_id, periodo, pct_negativo, nivel)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pct_negativo = VALUES(pct_negativo),
         nivel = VALUES(nivel),
         atendida = CASE
           WHEN atendida = 1
                AND pct_negativo_al_atender IS NOT NULL
                AND VALUES(pct_negativo) >= ?
                AND VALUES(pct_negativo) <> pct_negativo_al_atender
             THEN 0
           ELSE atendida
         END,
         atendida_at = CASE
           WHEN atendida = 1
                AND pct_negativo_al_atender IS NOT NULL
                AND VALUES(pct_negativo) >= ?
                AND VALUES(pct_negativo) <> pct_negativo_al_atender
             THEN NULL
           ELSE atendida_at
         END,
         atendida_por = CASE
           WHEN atendida = 1
                AND pct_negativo_al_atender IS NOT NULL
                AND VALUES(pct_negativo) >= ?
                AND VALUES(pct_negativo) <> pct_negativo_al_atender
             THEN NULL
           ELSE atendida_por
         END,
         pct_negativo_al_atender = CASE
           WHEN atendida = 1
                AND pct_negativo_al_atender IS NOT NULL
                AND VALUES(pct_negativo) >= ?
                AND VALUES(pct_negativo) <> pct_negativo_al_atender
             THEN NULL
           ELSE pct_negativo_al_atender
         END`,
      [department_id, periodo, pct_negativo, nivel,
       PCT_ESTABLE_MAX, PCT_ESTABLE_MAX, PCT_ESTABLE_MAX, PCT_ESTABLE_MAX]
    );
  },

  async marcarAtendida({ id, usuarioId, notas, atendidaAt }, executor = pool) {
    // Snapshot del pct_negativo actual de la alerta. Se usa para reabrir
    // automáticamente si llegan datos nuevos que cambien el panorama.
    const sql = atendidaAt
      ? `UPDATE alerts
            SET atendida = 1,
                atendida_por = ?,
                atendida_at = ?,
                notas = ?,
                pct_negativo_al_atender = pct_negativo
          WHERE id = ?`
      : `UPDATE alerts
            SET atendida = 1,
                atendida_por = ?,
                atendida_at = NOW(),
                notas = ?,
                pct_negativo_al_atender = pct_negativo
          WHERE id = ?`;
    const params = atendidaAt
      ? [usuarioId, atendidaAt, notas ?? null, id]
      : [usuarioId, notas ?? null, id];
    await executor.query(sql, params);
  },

  /**
   * Revierte el estado de atendida (caso "fue marcada por error").
   * Conserva las notas anteriores agregando un sufijo con el motivo
   * para mantener trazabilidad.
   */
  async desmarcarAtendida({ id, motivo }, executor = pool) {
    const [[actual]] = await executor.query(
      'SELECT notas FROM alerts WHERE id = ? LIMIT 1',
      [id]
    );
    const notasPrev = actual?.notas ?? '';
    const stamp = new Date().toISOString().slice(0, 10);
    const trazabilidad = `[Desmarcada el ${stamp}${motivo ? ` — motivo: ${motivo}` : ''}]`;
    const notasNuevas = notasPrev
      ? `${notasPrev}\n${trazabilidad}`
      : trazabilidad;
    await executor.query(
      `UPDATE alerts
          SET atendida = 0,
              atendida_por = NULL,
              atendida_at = NULL,
              pct_negativo_al_atender = NULL,
              notas = ?
        WHERE id = ?`,
      [notasNuevas.slice(0, 500), id]
    );
  },

  async findByIdConDetalle(id, executor = pool) {
    const [rows] = await executor.query(
      `SELECT a.id, a.department_id, d.nombre AS departamento, d.company_id,
              c.nombre AS empresa, a.periodo, a.pct_negativo, a.nivel,
              a.atendida, a.atendida_por, u.nombre AS atendida_por_nombre,
              a.atendida_at, a.notas, a.pct_negativo_al_atender, a.created_at
         FROM alerts a
         JOIN departments d ON d.id = a.department_id
         JOIN companies c ON c.id = d.company_id
         LEFT JOIN users u ON u.id = a.atendida_por
        WHERE a.id = ?
        LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findById(id, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, department_id, periodo, pct_negativo, nivel, atendida FROM alerts WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }
};
