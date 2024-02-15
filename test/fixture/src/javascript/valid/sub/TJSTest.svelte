<!-- Test Comment -->
<script>
   /**
    * A test header that is long and has
    * several lines with a bunch of extra data.
    *
    * @implements {(import('../types').ITest)} Some test interface
    *
    * @param {CustomEvent<import('..').TestEvent>} test:foo:bar - A foo-bar event.
    * @param {CustomEvent<{ test: boolean }>} test:thing - Yo This is multi-line
    * and stuff
    *
    * and some more text
    * @hidden
    * @componentDocumentation
    */

   import { createEventDispatcher } from 'svelte';

   /**
    * Some info that has data over several
    * lines.
    *
    * Because
    *
    * @type {string}
    */
   export let thing = void 0;

   /**
    * Test for import types.
    *
    * @type {import('../types').TypeAlias}
    */
   export let importType = void 0;

   /**
    * Something foo
    */
   export function foo() {}

   export function bar() {}

   const dispatch = createEventDispatcher();

   /** @type {HTMLDivElement} */
   let divEl;

   function test()
   {
      divEl.dispatchEvent(new CustomEvent('test:thing', { bubbles: true, cancelable: true }));

      dispatch('test:foo:bar');
   }
</script>

<div bind:this={divEl}
     on:keydown
     on:test:thing
>
   {thing}
</div>
