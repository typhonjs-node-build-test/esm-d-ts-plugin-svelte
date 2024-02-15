import {
   beforeAll,
   expect,
   vi }           from 'vitest';

import {
   checkDTS,
   generateDTS }  from '@typhonjs-build-test/esm-d-ts';

import fs         from 'fs-extra';

describe('Components (typescript)', () =>
{
   beforeAll(() =>
   {
      fs.ensureDirSync('./test/fixture/output/typescript');
      fs.emptyDirSync('./test/fixture/output/typescript');
   });

   describe('valid', () =>
   {
      it('checkDTS', async () =>
      {
         const consoleLog = [];
         vi.spyOn(console, 'log').mockImplementation((...args) => consoleLog.push(args));

         await checkDTS({
            input: './test/fixture/src/typescript/valid/index.ts',
            logLevel: 'debug',
            plugins: ['./src/index.js']
         });

         vi.restoreAllMocks();

         expect(JSON.stringify(consoleLog, null, 2)).toMatchFileSnapshot(
          './fixture/snapshot/typescript/valid/checkDTS-console-log.json');
      });

      it('generateDTS', async () =>
      {
         await generateDTS({
            input: './test/fixture/src/typescript/valid/index.ts',
            output: './test/fixture/output/typescript/valid/index.d.ts',
            logLevel: 'debug',
            compilerOptions: { outDir: './test/fixture/output/typescript/valid/.dts' },
            plugins: ['./src/index.js']
         });

         const result = fs.readFileSync('./test/fixture/output/typescript/valid/index.d.ts', 'utf-8');

         expect(result).toMatchFileSnapshot('./fixture/snapshot/typescript/valid/index.d.ts');
      });
   });
});
