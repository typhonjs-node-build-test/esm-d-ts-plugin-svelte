<svelte:options accessors={true}/>
<script lang="ts">
   /**
    * A test for `svelte:options` accessors.
    *
    * @componentDocumentation
    */

   import type { TypeAlias } from './types.ts';

   /**
    * Some info
    */
   export let thing: string | undefined = void 0;

   /**
    * Test for accessors.
    */
   export let typeAlias: TypeAlias | undefined = void 0;

   /**
    * A bar test
    */
   export function foo(bar: boolean) {}
</script>
<slot>{thing}</slot>
