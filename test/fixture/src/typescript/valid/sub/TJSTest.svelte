<script lang="ts">
   /**
    * A test header that is long and has
    * several lines with a bunch of extra data.
    *
    * @implements {(import('../types').ITest)} Some test interface
    * @implements {(import('../types').ITest2)} Some test interface
    *
    * @param test:foo:bar - Yo This is multi-line
    * and stuff
    *
    * and some more text
    * @hidden
    * @componentDocumentation
    */

   import { createEventDispatcher } from 'svelte';
   import type { TypeAlias }        from '../types.ts';

   /**
    * Some info that has data over several
    * lines.
    *
    * Because
    */
   export let thing: string = void 0;

   /**
    * Test for import types.
    */
   export let importType: TypeAlias = void 0;

   /**
    * Something foo
    */
   export function foo() {}

   export function bar() {}

   const dispatch = createEventDispatcher<{ 'test:foo:bar': TypeAlias }>();

   let divEl: HTMLDivElement;

   function test()
   {
      divEl.dispatchEvent(new CustomEvent('test:thing', { bubbles: true, cancelable: true }));

      dispatch('test:foo:bar', { bar: true });
   }
</script>

<div bind:this={divEl}
     on:keydown
>
   {thing}
</div>
