import fs         from 'fs-extra';

import ts         from 'typescript';

import {
   beforeAll,
   expect,
   vi }           from 'vitest';

import {
   checkDTS,
   generateDTS }  from '@typhonjs-build-test/esm-d-ts';

describe('Components (javascript)', () =>
{
   beforeAll(() =>
   {
      fs.ensureDirSync('./test/fixture/output/javascript');
      fs.emptyDirSync('./test/fixture/output/javascript');
   });

   describe('valid', () =>
   {
      it('checkDTS', async () =>
      {
         const consoleLog = [];
         vi.spyOn(console, 'log').mockImplementation((...args) => consoleLog.push(args));

         await checkDTS({
            input: './test/fixture/src/javascript/valid/index.js',
            logLevel: 'debug',
            plugins: ['./src/index.js']
         });

         vi.restoreAllMocks();

         expect(JSON.stringify(consoleLog, null, 2)).toMatchFileSnapshot(
          './fixture/snapshot/javascript/valid/checkDTS-console-log.json');
      });

      it('generateDTS', async () =>
      {
         await generateDTS({
            input: './test/fixture/src/javascript/valid/index.js',
            output: './test/fixture/output/javascript/valid/index.d.ts',
            logLevel: 'debug',
            compilerOptions: { outDir: './test/fixture/output/javascript/valid/.dts' },
            plugins: ['./src/index.js']
         });

         const result = fs.readFileSync('./test/fixture/output/javascript/valid/index.d.ts', 'utf-8');

         const tsVersion = parseFloat(ts.versionMajorMinor);

         // Takes into account changes in TS declaration generation pre / post TS `5.3` where setter / accessor
         // argument names are output as `arg` pre TS `5.3` and `_` post `5.3`.
         const snapshot = tsVersion >= 5.3 ?
          './fixture/snapshot/javascript/valid/index-post-5_3.d.ts' :
           './fixture/snapshot/javascript/valid/index-pre-5_3.d.ts';

         expect(result).toMatchFileSnapshot(snapshot);
      });
   });

   describe('warnings', () =>
   {
      it('checkDTS', async () =>
      {
         const consoleLog = [];
         vi.spyOn(console, 'log').mockImplementation((...args) => consoleLog.push(args));

         await checkDTS({
            input: './test/fixture/src/javascript/warnings/index.js',
            logLevel: 'debug',
            plugins: ['./src/index.js']
         });

         vi.restoreAllMocks();

         expect(JSON.stringify(consoleLog, null, 2)).toMatchFileSnapshot(
          './fixture/snapshot/javascript/warnings/checkDTS-console-log.json');
      });

      it('generateDTS', async () =>
      {
         const consoleLog = [];
         vi.spyOn(console, 'log').mockImplementation((...args) => consoleLog.push(args));

         await generateDTS({
            input: './test/fixture/src/javascript/warnings/index.js',
            output: './test/fixture/output/javascript/warnings/index.d.ts',
            logLevel: 'debug',
            compilerOptions: { outDir: './test/fixture/output/javascript/warnings/.dts' },
            plugins: ['./src/index.js']
         });

         vi.restoreAllMocks();

         expect(JSON.stringify(consoleLog, null, 2)).toMatchFileSnapshot(
          './fixture/snapshot/javascript/warnings/generateDTS-console-log.json');
      });
   });
});
