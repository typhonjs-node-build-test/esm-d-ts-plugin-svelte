<script>
   /**
    * A test header
    *
    * @component
    */

   import TestChild from './TestChild.svelte';

   /**
    * Some info
    *
    * @type {string}
    */
   export let thing = void 0;

   /**
    * @param {boolean} bar -
    */
   export function foo(bar) {}
</script>

<TestChild />
<slot>{thing}</slot>
