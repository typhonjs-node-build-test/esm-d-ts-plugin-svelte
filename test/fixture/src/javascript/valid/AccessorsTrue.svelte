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
    * @type {string}
    */
   export let thing = void 0;

   /**
    * Test import types for accessors.
    *
    * @type {import('./types').TypeAlias}
    */
   export let typeAlias = void 0;

   /**
    * @param {boolean} bar -
    */
   export function foo(bar) {}
</script>
<slot>{thing}</slot>
