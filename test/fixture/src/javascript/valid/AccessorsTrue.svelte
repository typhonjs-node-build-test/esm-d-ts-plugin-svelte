<svelte:options accessors={true}/>
<script>
   /**
    * A test for `svelte:options` accessors.
    *
    * @componentDocumentation
    */

   /**
    * Some info
    *
    * @type {string | undefined}
    */
   export let thing = void 0;

   /**
    * Test import types for accessors.
    *
    * @type {import('./types').TypeAlias | undefined}
    */
   export let typeAlias = void 0;

   /**
    * @param {boolean} bar -
    */
   export function foo(bar) {}
</script>
<slot>{thing}</slot>
