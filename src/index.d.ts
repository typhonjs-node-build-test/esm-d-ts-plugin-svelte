import * as _typhonjs_plugin_manager from '@typhonjs-plugin/manager';
import * as _typhonjs_build_test_esm_d_ts from '@typhonjs-build-test/esm-d-ts';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte 4 components. Future support for Svelte 5 / mixed mode 4 & 5 is
 * forthcoming.
 */
declare class DTSPluginSvelte {
  /**
   * Filters raised diagnostic messages from the Typescript compiler for Svelte components. There can be some noisy
   * warnings from `svelte2tsx` output depending on the complexity of the component. These diagnostic messages are
   * moved to the `debug` log level.
   *
   * The codes targeted are:
   * - `1005` - ',' expected.
   * - `2451` - redeclared block scope variable.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:diagnostic:filter']} data - Event data.
   *
   * @returns {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Returns['compile:diagnostic:filter']} Filtered
   *          state.
   */
  compileDiagnosticFilter({
    diagnostic,
    diagnosticLog,
  }: _typhonjs_build_test_esm_d_ts.PluginEvent.Data['compile:diagnostic:filter']): _typhonjs_build_test_esm_d_ts.PluginEvent.Returns['compile:diagnostic:filter'];
  /**
   * Transform any Svelte files via `svelte2tsx` before TSC compilation.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:transform']} data - Event data.
   */
  compileTransform({
    logger,
    memoryFiles,
    processedConfig,
  }: _typhonjs_build_test_esm_d_ts.PluginEvent.Data['compile:transform']): void;
  /**
   * Compiles the Svelte component returning the JS code so that `es-module-lexer` can parse it.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['lexer:transform']} data - Event data.
   *
   * @returns {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Returns['lexer:transform']} Compiled script / JS
   *          section of Svelte component.
   */
  lexerTransform({
    fileData,
  }: _typhonjs_build_test_esm_d_ts.PluginEvent.Data['lexer:transform']): _typhonjs_build_test_esm_d_ts.PluginEvent.Returns['lexer:transform'];
  /**
   * Svelte v4 types will add a triple slash reference `/// <reference types="svelte" />` for generated types.
   * To remove it a regex is added to the `esm-d-ts` GenerateConfig -> `dtsReplace`.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['lifecycle:start']} data - Event data.
   */
  lifecycleStart({ processedConfig }: _typhonjs_build_test_esm_d_ts.PluginEvent.Data['lifecycle:start']): void;
  /**
   * Handles postprocessing intermediate generated DTS files.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:end']} data - Event data.
   */
  postprocessDTS({
    PostProcess,
    processedConfig,
  }: _typhonjs_build_test_esm_d_ts.PluginEvent.Data['compile:end']): Promise<void>;
  /**
   * @param {import('@typhonjs-plugin/manager').PluginInvokeEvent} ev -
   */
  onPluginLoad(ev: _typhonjs_plugin_manager.PluginInvokeEvent): void;
  #private;
}

/**
 * Provides an instantiated instance of DTSPluginSvelte to automatically load.
 *
 * @type {DTSPluginSvelte}
 */
declare const dtsPluginSvelte: DTSPluginSvelte;

export { dtsPluginSvelte as default };
