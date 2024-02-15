/**
 * A test interface.
 */
export declare interface ITest {
   /** Implementing component must have `foo` getter. */
   get foo(): () => void;
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
