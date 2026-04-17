import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const reactExternals = ['react', 'react-dom'];
const preactExternals = ['preact/compat', 'preact/jsx-runtime'];
const isWatchMode = process.argv.includes('-w') || process.argv.includes('--watch');

function reactToPreact() {
  return {
    name: 'react-to-preact',
    resolveId(source) {
      if (source === 'react' || source === 'react-dom') {
        return { id: 'preact/compat', external: true };
      }

      if (source === 'react/jsx-runtime') {
        return { id: 'preact/jsx-runtime', external: true };
      }

      return null;
    },
  };
}

function createPlugins({ declaration, declarationDir, declarationMap, extraPlugins = [] }) {
  return [
    ...extraPlugins,
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      declaration,
      declarationDir,
      declarationMap,
    }),
    terser({ maxWorkers: 1 }),
  ];
}

function exitAfterBuild() {
  return {
    name: 'exit-after-build',
    closeBundle() {
      if (!isWatchMode) {
        // Rollup can leave plugin worker handles open in this toolchain after
        // all files are written. Keep watch mode alive, but make builds exit.
        setImmediate(() => process.exit(process.exitCode ?? 0));
      }
    },
  };
}

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createPlugins({
      declaration: true,
      declarationDir: 'dist',
      declarationMap: false,
    }),
    external: reactExternals,
  },
  {
    input: 'src/preact.ts',
    output: {
      file: 'dist/preact.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: createPlugins({
      declaration: true,
      declarationDir: 'dist',
      declarationMap: false,
      extraPlugins: [reactToPreact()],
    }).concat(exitAfterBuild()),
    external: preactExternals,
  },
];
