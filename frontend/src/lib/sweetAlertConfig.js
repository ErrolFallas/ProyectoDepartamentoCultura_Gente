import Swal from 'sweetalert2';

/**
 * Configuración base de SweetAlert para que combine con la paleta
 * corporativa de la plataforma (azul brand-600, gris ink-*).
 */
export const SwalPulse = Swal.mixin({
  confirmButtonColor: '#1d4ed8',  // brand-600
  cancelButtonColor: '#64748b',   // ink-500
  reverseButtons: true,
  showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
  hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' },
  buttonsStyling: true
});

/**
 * Flujo multi-paso para marcar una alerta como atendida:
 *   1. Confirmación explícita ("¿Está seguro?").
 *   2. Captura de fecha de la visita (con botón "Usar fecha de hoy").
 *   3. Captura de notas opcionales.
 *
 * Cualquier paso cancelado aborta el flujo (no marca atendida).
 *
 * @returns {Promise<{atendidaAt?: string, notas?: string} | null>}
 *          null si el usuario canceló en cualquier punto.
 */
export async function pedirDatosDeAtencion({ departamento, empresa, nivel, pctNegativo }) {
  // ---------- Paso 1: confirmación ----------
  const confirmacion = await SwalPulse.fire({
    title: '¿Confirma la atención al departamento?',
    html: `
      <div style="text-align:left;font-size:14px;color:#334155">
        Va a marcar como <strong>atendido</strong> al departamento:
        <div style="margin:10px 0;padding:10px;background:#f1f5f9;border-radius:8px">
          <div style="font-weight:600;color:#0f172a">👥 ${escapeHtml(departamento)}</div>
          <div style="color:#64748b;font-size:13px">🏢 ${escapeHtml(empresa)}</div>
          <div style="margin-top:6px;font-size:12px;color:#64748b">
            Nivel actual: <strong style="color:${colorPorNivel(nivel)}">${nivel}</strong>
            · ${Number(pctNegativo).toFixed(1)}% personal negativo
          </div>
        </div>
        Confirme solo si la visita o el seguimiento ya fueron realizados.
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'No, fue por error',
    focusCancel: true
  });
  if (!confirmacion.isConfirmed) return null;

  // ---------- Paso 2: fecha de la visita ----------
  const hoyISO = new Date().toISOString().slice(0, 10);
  const fechaResult = await SwalPulse.fire({
    title: 'Fecha en que realizó la visita',
    html: `
      <div style="text-align:left;font-size:13px;color:#475569;margin-bottom:8px">
        Indique la fecha en la que efectivamente atendió al equipo.
        Si la realizó hoy mismo, presione <strong>Omitir</strong>.
      </div>
    `,
    input: 'date',
    inputValue: hoyISO,
    inputAttributes: { max: hoyISO },  // no permite fechas futuras
    inputValidator: (val) => {
      if (!val) return null;  // omitido = ok
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return 'Fecha inválida';
      if (d > new Date()) return 'La fecha no puede ser futura';
      return null;
    },
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Confirmar fecha',
    denyButtonText: 'Omitir (usar hoy)',
    cancelButtonText: 'Cancelar',
    denyButtonColor: '#0ea5e9'
  });
  if (fechaResult.isDismissed) return null;  // cancelado

  // Si denegó (omitir) o no escribió fecha → hoy.
  const fechaSeleccionada = fechaResult.isDenied || !fechaResult.value ? hoyISO : fechaResult.value;
  const fechaISO = `${fechaSeleccionada}T12:00:00.000Z`;

  // ---------- Paso 3: notas opcionales ----------
  const notasResult = await SwalPulse.fire({
    title: 'Notas de la visita (opcional)',
    input: 'textarea',
    inputLabel: 'Acciones realizadas, próximos pasos, observaciones',
    inputPlaceholder: 'Ej.: reunión con la jefatura, plan de acción acordado…',
    inputAttributes: { 'aria-label': 'Notas', maxlength: 500 },
    showCancelButton: true,
    confirmButtonText: 'Guardar atención',
    cancelButtonText: 'Cancelar'
  });
  if (notasResult.isDismissed) return null;

  return {
    atendidaAt: fechaISO,
    notas: (notasResult.value ?? '').trim() || undefined
  };
}

/**
 * Solicita confirmación reforzada para editar una alerta ya atendida.
 * El usuario debe escribir exactamente "CulturaYGente" para continuar.
 *
 * @returns {Promise<boolean>} true si pasó la confirmación.
 */
export async function confirmarEdicionConPalabraClave() {
  const result = await SwalPulse.fire({
    title: '¿Está seguro de editar esta información?',
    html: `
      <div style="text-align:left;font-size:13px;color:#475569;line-height:1.5">
        Esta alerta ya fue marcada como atendida. Para evitar cambios accidentales,
        escriba literalmente la palabra
        <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#1e40af;font-weight:600">CulturaYGente</code>
        para confirmar y continuar.
      </div>
    `,
    input: 'text',
    inputPlaceholder: 'Escriba CulturaYGente',
    inputAttributes: { autocapitalize: 'off', autocomplete: 'off' },
    inputValidator: (val) => {
      if (val !== 'CulturaYGente') {
        return 'La palabra no coincide. Debe escribirse exactamente "CulturaYGente" (respetando mayúsculas).';
      }
      return null;
    },
    showCancelButton: true,
    confirmButtonText: 'Continuar con la edición',
    cancelButtonText: 'Cancelar',
    icon: 'warning',
    focusCancel: true
  });
  return result.isConfirmed;
}

/**
 * Confirmación para revertir una atención que fue marcada por error.
 * Pide motivo opcional para dejar trazabilidad en las notas.
 *
 * @returns {Promise<{motivo?: string} | null>} null si canceló.
 */
export async function confirmarDesmarcar({ departamento, fechaPrevia }) {
  const result = await SwalPulse.fire({
    title: '¿Marcar como NO atendida?',
    html: `
      <div style="text-align:left;font-size:13px;color:#475569;line-height:1.5">
        Esta acción <strong>revertirá</strong> el estado del departamento
        <span style="color:#0f172a;font-weight:600">👥 ${escapeHtml(departamento)}</span>.
        ${fechaPrevia ? `<div style="color:#64748b;font-size:12px;margin-top:4px">Atención registrada el ${fechaPrevia}</div>` : ''}
        <div style="margin-top:10px">
          Úselo cuando el botón fue tocado por error o si determinó que la visita aún no se ha realizado.
        </div>
        <div style="margin-top:10px;font-size:12px;color:#64748b">
          Las notas anteriores se conservarán en el historial.
        </div>
      </div>
    `,
    input: 'textarea',
    inputLabel: 'Motivo de la reversión (opcional)',
    inputPlaceholder: 'Ej.: se marcó por error · la visita aún no ha sido realizada',
    inputAttributes: { maxlength: 300 },
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, marcar como NO atendida',
    cancelButtonText: 'Cancelar',
    focusCancel: true,
    confirmButtonColor: '#dc2626'
  });
  if (!result.isConfirmed) return null;
  return { motivo: (result.value ?? '').trim() || undefined };
}

/**
 * Modal de solo lectura con el detalle completo de una alerta atendida.
 * El backend devuelve fecha, usuario y notas. Adicionalmente se ofrecen
 * los botones para editar o desmarcar.
 *
 * @returns {Promise<'editar' | 'desmarcar' | null>} acción elegida.
 */
export async function verDetalleAtencion(detalle) {
  const fecha = detalle.atendida_at
    ? new Date(detalle.atendida_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'sin fecha';
  const notasHtml = detalle.notas
    ? `<div style="margin-top:10px;padding:10px;background:#f8fafc;border-left:3px solid #1d4ed8;border-radius:4px;white-space:pre-wrap;font-size:13px;color:#334155;text-align:left">${escapeHtml(detalle.notas)}</div>`
    : '<div style="margin-top:10px;font-style:italic;color:#94a3b8;font-size:13px">Sin notas registradas</div>';

  const result = await SwalPulse.fire({
    title: 'Detalle de la atención',
    html: `
      <div style="text-align:left;font-size:14px;color:#334155">
        <div style="font-weight:600;color:#0f172a">👥 ${escapeHtml(detalle.departamento)}</div>
        <div style="color:#64748b;font-size:13px;margin-bottom:8px">🏢 ${escapeHtml(detalle.empresa)}</div>
        <div style="font-size:13px"><strong>Atendida el:</strong> ${fecha}</div>
        <div style="font-size:13px"><strong>Responsable:</strong> ${escapeHtml(detalle.atendida_por_nombre ?? 'no registrado')}</div>
        <div style="font-size:13px"><strong>Período:</strong> ${detalle.periodo}</div>
        <div style="font-size:13px"><strong>Nivel en ese momento:</strong> ${detalle.nivel} (${Number(detalle.pct_negativo_al_atender ?? detalle.pct_negativo).toFixed(1)}% personal negativo)</div>
        <div style="margin-top:10px;font-weight:600;color:#0f172a;font-size:13px">Notas de la visita:</div>
        ${notasHtml}
      </div>
    `,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Editar información',
    denyButtonText: 'Fue por error',
    cancelButtonText: 'Cerrar',
    denyButtonColor: '#dc2626',
    width: 560
  });

  if (result.isConfirmed) return 'editar';
  if (result.isDenied) return 'desmarcar';
  return null;
}

/**
 * Toast pequeño para confirmar éxito sin bloquear al usuario.
 */
export function toastExito(titulo) {
  SwalPulse.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: titulo,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
}

/**
 * Alerta de error humanizada.
 */
export function alertaError(mensaje) {
  return SwalPulse.fire({
    title: 'No se pudo completar la acción',
    text: mensaje,
    icon: 'error',
    confirmButtonText: 'Entendido'
  });
}

function colorPorNivel(n) {
  if (n === 'NEGRO') return '#0f172a';
  if (n === 'ROJO') return '#ef4444';
  if (n === 'AMARILLO') return '#b45309';
  return '#22c55e';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
