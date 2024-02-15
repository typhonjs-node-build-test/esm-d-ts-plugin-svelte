import { SvelteComponent } from 'svelte';

/**
 * A test interface.
 */
declare interface ITest {
  /** Implementing component must have `foo` getter. */
  get foo(): () => void;
}
/**
 * A 2nd test interface.
 */
declare interface ITest2 {
  /** Implementing component must have `bar` getter. */
  get bar(): () => void;
}
/**
 * A test type alias.
 */
type TypeAlias = {
  /**
   * Some bar parameter.
   */
  bar?: boolean;
};

/**
 * A test for `svelte:options` accessors.
 *
 */
declare class AccessorsTrue extends SvelteComponent<AccessorsTrue.Props, AccessorsTrue.Events, AccessorsTrue.Slots> {
  get foo(): (bar: boolean) => void;

  /** Setter for {@link AccessorsTrue.Props.thing | thing} prop. */
  set thing(_: string);

  /** Getter for {@link AccessorsTrue.Props.thing | thing} prop. */
  get thing(): string;

  /** Setter for {@link AccessorsTrue.Props.typeAlias | typeAlias} prop. */
  set typeAlias(_: TypeAlias);

  /** Getter for {@link AccessorsTrue.Props.typeAlias | typeAlias} prop. */
  get typeAlias(): TypeAlias;
  /**accessor*/
  set undefined(_: any);
  get undefined(): any;
}

/** Event / Prop / Slot type aliases for {@link AccessorsTrue | associated component}. */
declare namespace AccessorsTrue {
  /** Props type alias for {@link AccessorsTrue | associated component}. */
  export type Props = {
    /**
     * Some info
     *
     * @type {string}
     */
    thing?: string;
    /**
     * Test import types for accessors.
     *
     * @type {import('./types').TypeAlias}
     */
    typeAlias?: TypeAlias;
    /**
     * @param {boolean} bar -
     */
    foo?: (bar: boolean) => void;
  };
  /** Events type alias for {@link AccessorsTrue | associated component}. */
  export type Events = { [evt: string]: CustomEvent<any> };
  /** Slots type alias for {@link AccessorsTrue | associated component}. */
  export type Slots = { default: {} };
}

/**
 * A test header that is long and has
 * several lines with a bunch of extra data.
 *
 * @hidden
 */
declare class TjsTest extends SvelteComponent<TjsTest.Props, TjsTest.Events, TjsTest.Slots> implements ITest2, ITest {
  get foo(): () => void;
  get bar(): () => void;
}

/**
 * Event / Prop / Slot type aliases for {@link TjsTest | associated component}.
 * @hidden
 */
declare namespace TjsTest {
  /** Props type alias for {@link TjsTest | associated component}. */
  export type Props = {
    /**
     * Some info that has data over several
     * lines.
     *
     * Because
     *
     * @type {string}
     */
    thing?: string;
    /**
     * Something foo
     */
    foo?: () => void;
    /**
     * Test for import types.
     *
     * @type {import('../types').TypeAlias}
     */
    importType?: TypeAlias;
    bar?: () => void;
  };
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

export {
  AccessorsTrue,
  type ITest,
  type ITest2,
  JSClass,
  TjsTest as TJSTest,
  type TestEvent,
  type TypeAlias,
  jsFunction,
};
