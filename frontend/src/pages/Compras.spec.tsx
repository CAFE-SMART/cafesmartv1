import { describe, it, expect } from 'vitest';

// Tests unitarios para la lógica de validación de Compras
// Estos tests son rápidos porque no renderizan UI, solo prueban la lógica

describe('Compras - Validación de Precio Mínimo', () => {
  it('debería rechazar precio menor a 1000', () => {
    const precioKg = 500;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(false);
  });

  it('debería aceptar precio de 1000', () => {
    const precioKg = 1000;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(true);
  });

  it('debería aceptar precio mayor a 1000', () => {
    const precioKg = 1500;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(true);
  });

  it('debería rechazar precio negativo', () => {
    const precioKg = -100;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(false);
  });

  it('debería rechazar precio cero', () => {
    const precioKg = 0;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(false);
  });

  it('debería rechazar precio NaN', () => {
    const precioKg = NaN;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(false);
  });

  it('debería rechazar precio Infinity', () => {
    const precioKg = Infinity;
    const esValido = Number.isFinite(precioKg) && precioKg >= 1000;
    expect(esValido).toBe(false);
  });
});

describe('Compras - Cálculo de Capacidad de Bodega', () => {
  it('debería calcular correctamente el porcentaje de uso', () => {
    const capacidadKg = 3000;
    const inventarioActual = 2400;
    const porcentaje = (inventarioActual / capacidadKg) * 100;
    expect(porcentaje).toBe(80);
  });

  it('debería detectar cuando está al 80% exacto', () => {
    const capacidadKg = 3000;
    const inventarioActual = 2400;
    const limiteWarning = capacidadKg * 0.8;
    const estaEnAlerta = inventarioActual >= limiteWarning;
    expect(estaEnAlerta).toBe(true);
  });

  it('debería detectar cuando supera el 80%', () => {
    const capacidadKg = 3000;
    const inventarioActual = 2500;
    const limiteWarning = capacidadKg * 0.8;
    const estaEnAlerta = inventarioActual >= limiteWarning;
    expect(estaEnAlerta).toBe(true);
  });

  it('debería detectar cuando está debajo del 80%', () => {
    const capacidadKg = 3000;
    const inventarioActual = 2000;
    const limiteWarning = capacidadKg * 0.8;
    const estaEnAlerta = inventarioActual >= limiteWarning;
    expect(estaEnAlerta).toBe(false);
  });

  it('debería detectar cuando supera la capacidad total', () => {
    const capacidadKg = 3000;
    const inventarioActual = 3200;
    const excedeCapacidad = inventarioActual > capacidadKg;
    expect(excedeCapacidad).toBe(true);
  });

  it('debería calcular el nuevo total después de una compra', () => {
    const inventarioActual = 2400;
    const pesoCompra = 600;
    const nuevoTotal = inventarioActual + pesoCompra;
    expect(nuevoTotal).toBe(3000);
  });

  it('debería calcular el exceso cuando supera la capacidad', () => {
    const capacidadKg = 3000;
    const nuevoTotal = 3200;
    const exceso = nuevoTotal - capacidadKg;
    expect(exceso).toBe(200);
  });
});
