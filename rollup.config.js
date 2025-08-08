// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import postcss   from 'rollup-plugin-postcss';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.es.js',
      format: 'esm',
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      exports: 'named',
    },
  ],
  // treat React and related runtimes, plus react-confetti, as external
  external: id =>
    /^react($|\/)/.test(id) ||
    /^react-dom($|\/)/.test(id) ||
    id === 'react-confetti',
  plugins: [
    // 1) Allow importing CSS files and inject them into the bundle
    postcss({
      extensions: ['.css'],
      inject: true,
    }),

    // 2) Compile TS and TSX (with JSX support)
    typescript({
      tsconfig: './tsconfig.json',
      tsconfigOverride: {
        compilerOptions: {
          jsx: 'react-jsx',
        },
        include: ['src/**/*'],
      },
      clean: true,
    }),
  ],
};
