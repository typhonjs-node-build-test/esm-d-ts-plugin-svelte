/**
 * A test interface.
 */
export declare interface ITest {
   /** Implementing component must have `foo` getter. */
   get foo(): () => void;
}

/**
 * A 2nd test interface.
 */
export declare interface ITest2 {
   /** Implementing component must have `bar` getter. */
   get bar(): () => void;
}

/**
 * A test type alias.
 */
export type TypeAlias = {
   /**
    * Some bar parameter.
    */
   bar?: boolean;
}
