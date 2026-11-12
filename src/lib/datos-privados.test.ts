import { describe, expect, it } from 'vitest';
import { buscarDatosPrivados } from '../../scripts/verificar-datos-privados.mjs';

describe('datos personales', () => {
  it('no hay CURP ni fecha de nacimiento en src/data ni en public', () => {
    expect(buscarDatosPrivados(['src/data', 'public'])).toEqual([]);
  });
});
