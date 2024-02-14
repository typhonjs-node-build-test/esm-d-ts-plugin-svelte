import { SvelteComponent } from 'svelte';

/**
 * A test interface.
 */
declare interface ITest {
  /** Implementing component must have `foo` getter. */
  get foo(): () => void;
}

/**
 * A test header that is long and has
 * several lines with a bunch of extra data.
 *
 * @hidden
 */
declare class TjsTest extends SvelteComponent<TjsTest.Props, TjsTest.Events, TjsTest.Slots> implements ITest {
  /** Getter for {@link TjsTest.Props.foo | foo} prop. */
  get foo(): () => void;

  /** Getter for {@link TjsTest.Props.bar | bar} prop. */
  get bar(): () => void;
}

/**
 * Event / Prop / Slot type aliases for {@link TjsTest | associated component}.
 * @hidden
 */
declare namespace TjsTest {
  /** Props type alias for {@link TjsTest | associated component}. */
  export type Props = { thing2?: string; foo?: () => void; bar?: () => void };
  /** Events type alias for {@link TjsTest | associated component}. */
  export type Events = {
    keydown: KeyboardEvent;
    /**
     * Yo This is multi-line
     * and stuff
     *
     * and some more text
     */
    'test:thing': CustomEvent<{ test: boolean }>;
    /**
     * A foo-bar event.
     */
    'test:foo:bar': CustomEvent<TestEvent>;
  } & { [evt: string]: CustomEvent<any> };
  /** Slots type alias for {@link TjsTest | associated component}. */
  export type Slots = {};
}

/**
 * A test JS function.
 *
 * @returns {Promise<boolean>}
 */
declare function jsFunction(): Promise<boolean>;
/**
 * A test JS class.
 */
declare class JSClass {}

type TestEvent = {
  /**
   * A foo test...
   */
  foo: boolean;
};

export { type ITest, JSClass, TjsTest as TJSTest, type TestEvent, jsFunction };
