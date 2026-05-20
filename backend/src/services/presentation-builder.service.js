import PptxGenJS from 'pptxgenjs';

/**
 * Convierte los bloques de datos de presentation-data.service en un .pptx
 * editable. El branding y el copy son neutros; RRHH puede sustituirlos
 * editando el archivo en PowerPoint sin tocar código.
 */

const COLORS = {
  inkDark: '0F172A',
  inkBody: '334155',
  inkMuted: '64748B',
  bg: 'F8FAFC',
  brand: '1D4ED8',
  brandSoft: 'EEF6FF',
  border: 'E2E8F0',
  verde: '22C55E',
  amarillo: 'EAB308',
  rojo: 'EF4444',
  cardBg: 'FFFFFF'
};

const FONT = 'Calibri'; // fuente segura en PowerPoint sin instalación adicional
const TITULO_PROYECTO = 'Garnier PulseWork';

export function construirPresentacion(datos) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
  pptx.author = TITULO_PROYECTO;
  pptx.company = 'Departamento de Cultura y Gente';
  pptx.title = `Informe de Clima · ${datos.meta.nombre} · ${datos.periodo}`;
  pptx.subject = 'Resultados anónimos del período';

  definirMaster(pptx, datos);
  addPortada(pptx, datos);
  addEncuestasAplicadas(pptx, datos);
  addResumenEjecutivo(pptx, datos);
  addDimensiones(pptx, datos);
  addMejoresResultados(pptx, datos);
  addPeoresResultados(pptx, datos);
  addPuntosDeMejora(pptx, datos);
  addCierre(pptx, datos);

  return pptx;
}

// ---------------------------------------------------------------------
// Maestra
// ---------------------------------------------------------------------

function definirMaster(pptx, datos) {
  pptx.defineSlideMaster({
    title: 'PULSEWORK_MASTER',
    background: { color: COLORS.bg },
    objects: [
      // Barra superior brand
      { rect: { x: 0, y: 0, w: 13.333, h: 0.32, fill: { color: COLORS.brand } } },
      // Texto del proyecto en barra superior
      { text: {
          text: TITULO_PROYECTO + ' · Bienestar y Clima Organizacional',
          options: { x: 0.4, y: 0.04, w: 8, h: 0.24, fontSize: 9, color: 'FFFFFF', fontFace: FONT, bold: true }
        }
      },
      // Período en barra superior derecha
      { text: {
          text: `Período ${datos.periodo}`,
          options: { x: 10.3, y: 0.04, w: 2.6, h: 0.24, fontSize: 9, color: 'FFFFFF', align: 'right', fontFace: FONT }
        }
      },
      // Pie con nota de anonimato
      { rect: { x: 0, y: 7.2, w: 13.333, h: 0.3, fill: { color: COLORS.inkDark } } },
      { text: {
          text: 'Información agregada y anónima · No identifica personas · Departamentos con menos respuestas que el umbral se omiten por privacidad',
          options: { x: 0.4, y: 7.22, w: 12.5, h: 0.26, fontSize: 8, color: 'CBD5E1', fontFace: FONT, italic: true }
        }
      }
    ],
    slideNumber: { x: 12.7, y: 7.22, w: 0.5, h: 0.26, fontSize: 8, color: 'FFFFFF', fontFace: FONT }
  });
}

// ---------------------------------------------------------------------
// Lámina 1 — Portada
// ---------------------------------------------------------------------

function addPortada(pptx, datos) {
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });

  s.addText('INFORME DE CLIMA ORGANIZACIONAL', {
    x: 0.6, y: 1.6, w: 12, h: 0.5,
    fontSize: 14, color: COLORS.inkMuted, fontFace: FONT, bold: true, charSpacing: 4
  });

  s.addText(datos.meta.nombre, {
    x: 0.6, y: 2.2, w: 12, h: 1.2,
    fontSize: 48, color: COLORS.inkDark, fontFace: FONT, bold: true
  });

  const tipoLabel = datos.meta.tipo === 'EMPRESA' ? 'Empresa' : 'Departamento';
  const subtitulo = datos.meta.tipo === 'DEPARTAMENTO'
    ? `${tipoLabel} · ${datos.meta.empresa?.nombre ?? ''}`
    : tipoLabel;

  s.addText(subtitulo, {
    x: 0.6, y: 3.5, w: 12, h: 0.5,
    fontSize: 20, color: COLORS.brand, fontFace: FONT
  });

  s.addText(formatearPeriodo(datos.periodo), {
    x: 0.6, y: 4.2, w: 12, h: 0.5,
    fontSize: 16, color: COLORS.inkBody, fontFace: FONT
  });

  s.addText(
    [
      { text: 'Resultados anónimos del período. ', options: { color: COLORS.inkBody } },
      { text: 'Datos agregados por equipo, nunca individuales.', options: { color: COLORS.inkMuted, italic: true } }
    ],
    { x: 0.6, y: 5.4, w: 12, h: 0.6, fontSize: 14, fontFace: FONT }
  );

  s.addText(`Generado por ${TITULO_PROYECTO}`, {
    x: 0.6, y: 6.5, w: 12, h: 0.4,
    fontSize: 10, color: COLORS.inkMuted, fontFace: FONT, italic: true
  });
}

// ---------------------------------------------------------------------
// Lámina 2 — Encuestas aplicadas
// ---------------------------------------------------------------------

function addEncuestasAplicadas(pptx, datos) {
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  encabezadoLamina(s, 'Encuestas aplicadas', 'Volumen de respuestas anónimas recibidas en el período');

  const n = datos.agregado.n_respuestas;

  bigKpi(s, {
    x: 0.6, y: 1.6, w: 4.0, h: 2.5,
    label: 'Respuestas recibidas',
    value: String(n),
    hint: 'Total anónimo en el período'
  });

  bigKpi(s, {
    x: 4.8, y: 1.6, w: 4.0, h: 2.5,
    label: 'Departamentos con datos',
    value: String(datos.dimensiones.length > 0 ? 1 : 0),
    hint: datos.meta.tipo === 'EMPRESA'
      ? 'Suma de todos sus departamentos elegibles'
      : 'Departamento actual'
  });

  bigKpi(s, {
    x: 9.0, y: 1.6, w: 3.7, h: 2.5,
    label: 'Período',
    value: formatearPeriodo(datos.periodo),
    hint: datos.scope === 'COMPANY' ? 'Ámbito: empresa' : 'Ámbito: departamento'
  });

  s.addText(
    'Las respuestas individuales no se almacenan con identidad. Solo se conservan agregados por empresa y por departamento. Los equipos con menos respuestas que el umbral mínimo (por defecto 5) no se muestran de forma aislada.',
    { x: 0.6, y: 5.0, w: 12.2, h: 1.3, fontSize: 12, color: COLORS.inkBody, fontFace: FONT, italic: true }
  );
}

// ---------------------------------------------------------------------
// Lámina 3 — Resumen ejecutivo
// ---------------------------------------------------------------------

function addResumenEjecutivo(pptx, datos) {
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  encabezadoLamina(s, 'Resumen ejecutivo', 'Indicadores clave de este período');

  const { agregado, posicionRanking, nivelSemaforo } = datos;
  const colorSem = colorPorNivel(nivelSemaforo.nivel);

  bigKpi(s, {
    x: 0.6, y: 1.6, w: 3.0, h: 2.5,
    label: 'Personal positivo',
    value: pct(agregado.pct_positivo),
    hint: 'Respuestas con tono positivo',
    accent: COLORS.verde
  });

  bigKpi(s, {
    x: 3.8, y: 1.6, w: 3.0, h: 2.5,
    label: 'Personal negativo',
    value: pct(agregado.pct_negativo),
    hint: 'Respuestas con tono negativo',
    accent: COLORS.rojo
  });

  bigKpi(s, {
    x: 7.0, y: 1.6, w: 3.0, h: 2.5,
    label: 'Posición en ranking',
    value: posicionRanking ? `#${posicionRanking.posicion}` : '—',
    hint: posicionRanking
      ? `de ${posicionRanking.totalEnRanking} ${datos.scope === 'COMPANY' ? 'empresas' : 'departamentos'}`
      : 'Sin datos suficientes',
    accent: COLORS.brand
  });

  bigKpi(s, {
    x: 10.2, y: 1.6, w: 2.5, h: 2.5,
    label: 'Semáforo',
    value: nivelSemaforo.nivel,
    hint: pct(nivelSemaforo.pct_negativo) + ' negativo',
    accent: colorSem,
    valueColor: colorSem
  });

  // Mensaje narrativo abajo
  const mensaje = construirNarrativa(datos);
  s.addText(mensaje, {
    x: 0.6, y: 4.5, w: 12.2, h: 1.8,
    fontSize: 13, color: COLORS.inkBody, fontFace: FONT, paraSpaceAfter: 6
  });
}

function construirNarrativa(datos) {
  const tipo = datos.meta.tipo === 'EMPRESA' ? 'Esta empresa' : 'Este departamento';
  const partes = [];
  partes.push(`${tipo} muestra ${pct(datos.agregado.pct_positivo)} de personal con tono positivo y ${pct(datos.agregado.pct_negativo)} con tono negativo durante el período.`);
  if (datos.posicionRanking) {
    partes.push(`Ocupa la posición #${datos.posicionRanking.posicion} en el ranking global de ${datos.scope === 'COMPANY' ? 'empresas' : 'departamentos'}.`);
  }
  if (datos.nivelSemaforo.nivel === 'ROJO') {
    partes.push('El semáforo está en ROJO: se recomienda una visita de Cultura y Gente al equipo.');
  } else if (datos.nivelSemaforo.nivel === 'AMARILLO') {
    partes.push('El semáforo está en AMARILLO: mantener observación y comparar contra el período anterior.');
  } else {
    partes.push('El semáforo está en VERDE para el período analizado.');
  }
  return partes.join(' ');
}

// ---------------------------------------------------------------------
// Lámina 4 — Bloques por dimensión
// ---------------------------------------------------------------------

function addDimensiones(pptx, datos) {
  if (!datos.dimensiones.length) return;

  // Partir en grupos de hasta 8 filas para que la tabla quepa bien.
  const CHUNK = 8;
  for (let i = 0; i < datos.dimensiones.length; i += CHUNK) {
    const grupo = datos.dimensiones.slice(i, i + CHUNK);
    const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
    encabezadoLamina(s, 'Dimensiones de clima',
      `Promedios por dimensión · ${i + 1}–${i + grupo.length} de ${datos.dimensiones.length}`);

    const rows = [
      [
        { text: 'Dimensión', options: thStyle() },
        { text: 'Preguntas', options: thStyle({ align: 'center' }) },
        { text: 'Respuestas', options: thStyle({ align: 'center' }) },
        { text: '% Positivo', options: thStyle({ align: 'center' }) },
        { text: '% Negativo', options: thStyle({ align: 'center' }) }
      ],
      ...grupo.map((d) => [
        { text: d.dimension, options: tdStyle({ bold: true }) },
        { text: String(d.preguntas.length), options: tdStyle({ align: 'center' }) },
        { text: String(d.n_respuestas_total), options: tdStyle({ align: 'center' }) },
        { text: pct(d.pct_positivo_promedio), options: tdStyle({ align: 'center', color: COLORS.verde, bold: true }) },
        { text: pct(d.pct_negativo_promedio), options: tdStyle({ align: 'center', color: COLORS.rojo, bold: true }) }
      ])
    ];

    s.addTable(rows, {
      x: 0.6, y: 1.5, w: 12.2,
      colW: [4.7, 1.5, 1.8, 2.1, 2.1],
      border: { type: 'solid', color: COLORS.border, pt: 0.5 }
    });

    s.addText(
      'Cada celda promedia % positivo/negativo de las preguntas confirmadas dentro de la dimensión, ponderado por número de respuestas.',
      { x: 0.6, y: 6.5, w: 12.2, h: 0.4, fontSize: 10, color: COLORS.inkMuted, fontFace: FONT, italic: true }
    );
  }
}

// ---------------------------------------------------------------------
// Mejores resultados
// ---------------------------------------------------------------------

function addMejoresResultados(pptx, datos) {
  const items = datos.mejores ?? [];
  if (!items.length) return;
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  encabezadoLamina(s, 'Mejores resultados', 'Las cinco preguntas con mayor % positivo');

  items.slice(0, 5).forEach((q, idx) => {
    tarjetaResultado(s, q, {
      x: 0.6 + (idx % 5) * 2.5,
      y: 1.7,
      w: 2.3, h: 4.7,
      accent: COLORS.verde
    });
  });

  s.addText(
    `El ${pct(items[0].pct_positivo)} del personal indica de forma positiva la pregunta destacada en primer lugar.`,
    { x: 0.6, y: 6.6, w: 12.2, h: 0.4, fontSize: 11, color: COLORS.inkBody, fontFace: FONT, italic: true }
  );
}

// ---------------------------------------------------------------------
// Peores resultados
// ---------------------------------------------------------------------

function addPeoresResultados(pptx, datos) {
  const items = datos.peores ?? [];
  if (!items.length) return;
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  encabezadoLamina(s, 'Áreas de mejora', 'Las cinco preguntas con mayor % negativo');

  items.slice(0, 5).forEach((q, idx) => {
    tarjetaResultado(s, q, {
      x: 0.6 + (idx % 5) * 2.5,
      y: 1.7,
      w: 2.3, h: 4.7,
      accent: COLORS.rojo
    });
  });

  s.addText(
    'Estas son las preguntas que requieren mayor atención. Considere combinar con los temas detectados por IA (lámina siguiente).',
    { x: 0.6, y: 6.6, w: 12.2, h: 0.4, fontSize: 11, color: COLORS.inkBody, fontFace: FONT, italic: true }
  );
}

// ---------------------------------------------------------------------
// Puntos de mejora (temas IA)
// ---------------------------------------------------------------------

function addPuntosDeMejora(pptx, datos) {
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  encabezadoLamina(s, 'Puntos de mejora', 'Temas recurrentes detectados en respuestas abiertas');

  const t = datos.temas;
  s.addText(
    `Total de respuestas abiertas analizadas: ${t.total_respuestas_abiertas} ` +
    `(${t.distribucion_tono.positivos} positivas · ${t.distribucion_tono.neutros} neutras · ${t.distribucion_tono.negativos} negativas).`,
    { x: 0.6, y: 1.6, w: 12.2, h: 0.5, fontSize: 11, color: COLORS.inkBody, fontFace: FONT }
  );

  if (!t.top_temas.length) {
    s.addText(
      'No hay respuestas abiertas suficientes para extraer temas en este período.',
      { x: 0.6, y: 3.0, w: 12.2, h: 0.6, fontSize: 14, color: COLORS.inkMuted, fontFace: FONT, italic: true, align: 'center' }
    );
    return;
  }

  const rows = [
    [
      { text: '#', options: thStyle({ align: 'center' }) },
      { text: 'Tema recurrente', options: thStyle() },
      { text: 'Menciones', options: thStyle({ align: 'center' }) }
    ],
    ...t.top_temas.map((row, i) => [
      { text: String(i + 1), options: tdStyle({ align: 'center', color: COLORS.inkMuted }) },
      { text: capitalize(row.tema), options: tdStyle({ bold: true }) },
      { text: String(row.ocurrencias), options: tdStyle({ align: 'center', color: COLORS.brand, bold: true }) }
    ])
  ];

  s.addTable(rows, {
    x: 0.6, y: 2.4, w: 12.2,
    colW: [0.9, 9.3, 2.0],
    border: { type: 'solid', color: COLORS.border, pt: 0.5 }
  });

  s.addText(
    'Los temas se extraen automáticamente. La IA solo recibe el texto de cada respuesta abierta: nunca conoce empresa, departamento ni identidad de la persona.',
    { x: 0.6, y: 6.5, w: 12.2, h: 0.4, fontSize: 10, color: COLORS.inkMuted, fontFace: FONT, italic: true }
  );
}

// ---------------------------------------------------------------------
// Cierre
// ---------------------------------------------------------------------

function addCierre(pptx, datos) {
  const s = pptx.addSlide({ masterName: 'PULSEWORK_MASTER' });
  s.addText('Gracias', {
    x: 0.6, y: 2.5, w: 12, h: 1,
    fontSize: 48, color: COLORS.inkDark, fontFace: FONT, bold: true, align: 'center'
  });
  s.addText('Departamento de Cultura y Gente', {
    x: 0.6, y: 3.7, w: 12, h: 0.6,
    fontSize: 18, color: COLORS.brand, fontFace: FONT, align: 'center'
  });
  s.addText(
    'Este documento es editable. Quite o ajuste cualquier contenido antes de presentarlo si fuera necesario.',
    { x: 0.6, y: 5.0, w: 12, h: 0.5, fontSize: 12, color: COLORS.inkMuted, fontFace: FONT, italic: true, align: 'center' }
  );
}

// ---------------------------------------------------------------------
// Helpers gráficos
// ---------------------------------------------------------------------

function encabezadoLamina(slide, titulo, subtitulo) {
  slide.addText(titulo, {
    x: 0.6, y: 0.55, w: 12, h: 0.55,
    fontSize: 26, color: COLORS.inkDark, fontFace: FONT, bold: true
  });
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: 0.6, y: 1.1, w: 12, h: 0.35,
      fontSize: 12, color: COLORS.inkMuted, fontFace: FONT
    });
  }
}

function bigKpi(slide, { x, y, w, h, label, value, hint, accent = COLORS.brand, valueColor = COLORS.inkDark }) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: COLORS.cardBg },
    line: { color: COLORS.border, width: 0.5 }
  });
  slide.addShape('rect', { x, y, w: 0.08, h, fill: { color: accent }, line: { color: accent } });
  slide.addText(label.toUpperCase(), {
    x: x + 0.3, y: y + 0.2, w: w - 0.4, h: 0.4,
    fontSize: 10, color: COLORS.inkMuted, fontFace: FONT, bold: true, charSpacing: 2
  });
  slide.addText(value, {
    x: x + 0.3, y: y + 0.6, w: w - 0.4, h: h - 1.2,
    fontSize: 36, color: valueColor, fontFace: FONT, bold: true, valign: 'middle'
  });
  if (hint) {
    slide.addText(hint, {
      x: x + 0.3, y: y + h - 0.5, w: w - 0.4, h: 0.4,
      fontSize: 10, color: COLORS.inkMuted, fontFace: FONT
    });
  }
}

function tarjetaResultado(slide, q, { x, y, w, h, accent }) {
  slide.addShape('rect', { x, y, w, h, fill: { color: COLORS.cardBg }, line: { color: COLORS.border, width: 0.5 } });
  slide.addShape('rect', { x, y, w, h: 0.1, fill: { color: accent }, line: { color: accent } });
  slide.addText(pct(q.pct_positivo === undefined ? 100 - q.pct_negativo : q.pct_positivo), {
    x: x + 0.15, y: y + 0.25, w: w - 0.3, h: 0.8,
    fontSize: 28, color: accent, fontFace: FONT, bold: true
  });
  slide.addText('Personal positivo', {
    x: x + 0.15, y: y + 1.0, w: w - 0.3, h: 0.3,
    fontSize: 9, color: COLORS.inkMuted, fontFace: FONT
  });
  slide.addText(truncar(q.texto, 200), {
    x: x + 0.15, y: y + 1.4, w: w - 0.3, h: h - 2.2,
    fontSize: 10, color: COLORS.inkBody, fontFace: FONT
  });
  slide.addText(`${q.n_respuestas} resp.`, {
    x: x + 0.15, y: y + h - 0.4, w: w - 0.3, h: 0.3,
    fontSize: 9, color: COLORS.inkMuted, fontFace: FONT
  });
}

function thStyle(extra = {}) {
  return {
    bold: true, color: 'FFFFFF', fontFace: FONT, fontSize: 11,
    fill: { color: COLORS.inkDark }, valign: 'middle', ...extra
  };
}

function tdStyle(extra = {}) {
  return {
    color: COLORS.inkBody, fontFace: FONT, fontSize: 11,
    valign: 'middle', ...extra
  };
}

function colorPorNivel(nivel) {
  if (nivel === 'ROJO') return COLORS.rojo;
  if (nivel === 'AMARILLO') return COLORS.amarillo;
  return COLORS.verde;
}

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function truncar(str, max) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatearPeriodo(periodo) {
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    const [y, m] = periodo.split('-');
    const mes = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  }
  return `Año ${periodo}`;
}
