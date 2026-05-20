import { env } from '../config/env.js';

/**
 * Convierte un score 0-100 al sentimiento POSITIVO / NEUTRO / NEGATIVO
 * según los umbrales configurados (.env).
 */
export function clasificarSentimiento(scoreNormalizado) {
  if (scoreNormalizado === null || scoreNormalizado === undefined) return null;
  const n = Number(scoreNormalizado);
  if (Number.isNaN(n)) return null;
  if (n <= env.UMBRAL_NEGATIVO_MAX) return 'NEGATIVO';
  if (n <= env.UMBRAL_NEUTRO_MAX) return 'NEUTRO';
  return 'POSITIVO';
}

/**
 * Aplica la polaridad de la pregunta al valor 0-100 ya escalado linealmente.
 *  - DIRECTA: número alto = positivo, no se modifica.
 *  - INVERSA: se invierte (100 - valor).
 *  - NEUTRA: no puntúa (devuelve null).
 */
export function aplicarPolaridad(valor0a100, polaridad) {
  if (polaridad === 'NEUTRA') return null;
  if (valor0a100 === null || valor0a100 === undefined) return null;
  const v = Number(valor0a100);
  if (Number.isNaN(v)) return null;
  if (polaridad === 'INVERSA') return Math.max(0, Math.min(100, 100 - v));
  return Math.max(0, Math.min(100, v));
}

/**
 * Escala lineal de un valor entero 1..N a 0..100 (antes de polaridad).
 * Si la escala tiene un único nivel devuelve 100 (sin diferencia).
 */
export function escalarLineal(indice1aN, niveles) {
  if (!niveles || niveles <= 1) return 100;
  const idx = Math.max(1, Math.min(niveles, Number(indice1aN)));
  return ((idx - 1) / (niveles - 1)) * 100;
}

/**
 * Redondea a 2 decimales sin acumular error.
 */
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
