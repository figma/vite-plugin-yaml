import { Options } from 'tsup';

export default <Options>{
  splitting: true,
  clean: true,
  entryPoints: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
};
