export interface ParametrosPenalizacion { PENALIDAD_KG_MAXIMO: number; PRECIO_KG_MAXIMO: number; }
export async function obtenerParametro(nombre: string): Promise<number> { const res = await fetch(`/api/parametros/${nombre}`); return res.json(); }
