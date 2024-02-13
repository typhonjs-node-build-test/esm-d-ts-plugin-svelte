import { generateDTS }  from '@typhonjs-build-test/esm-d-ts';

import fs               from 'fs-extra';

describe('Components (javascript)', () =>
{
   it('generateDTS', async () =>
   {
      fs.ensureDirSync('./test/fixture/output/javascript');
      fs.emptyDirSync('./test/fixture/output/javascript');

      await generateDTS({
         input: './test/fixture/src/javascript/index.js',
         output: './test/fixture/output/javascript/index.d.ts',
         logLevel: 'debug',
         plugins: ['./src/index.js']
      });

      const result = fs.readFileSync('./test/fixture/output/javascript/index.d.ts', 'utf-8');

      expect(result).toMatchFileSnapshot('./fixture/snapshot/javascript/index.d.ts');
   });
});
