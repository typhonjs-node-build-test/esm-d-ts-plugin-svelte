import {
   beforeAll,
   expect,
   vi }           from 'vitest';

import {
   checkDTS,
   generateDTS }  from '@typhonjs-build-test/esm-d-ts';

import fs         from 'fs-extra';

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

         expect(result).toMatchFileSnapshot('./fixture/snapshot/javascript/valid/index.d.ts');
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
