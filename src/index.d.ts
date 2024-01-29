import * as _typhonjs_plugin_manager from '@typhonjs-plugin/manager';
import * as _typhonjs_build_test_esm_d_ts_postprocess from '@typhonjs-build-test/esm-d-ts/postprocess';
import * as _typhonjs_build_test_esm_d_ts from '@typhonjs-build-test/esm-d-ts';
import * as _typhonjs_utils_logger_color from '@typhonjs-utils/logger-color';
import * as typescript from 'typescript';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte components.
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
   * @param {object}   data - Data.
   *
   * @param {import('typescript').Diagnostic}  data.diagnostic - Diagnostic to test.
   *
   * @param {Function}   data.diagnosticLog - Diagnostic logging helper.
   *
   * @returns {boolean} Filtered state.
   */
  compileDiagnosticFilter({
    diagnostic,
    diagnosticLog,
  }: {
    diagnostic: typescript.Diagnostic;
    diagnosticLog: Function;
  }): boolean;
  /**
   * Transform any Svelte files via `svelte2tsx` before TSC compilation.
   *
   * @param {object}   data - Data.
   *
   * @param {import('@typhonjs-utils/logger-color').ColorLogger} data.logger - Logger instance.
   *
   * @param {Map<string, string>}  data.memoryFiles - Stores transformed code and temp paths.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - Processed config from
   *        `esm-d-ts` that contains the filepaths being compiled.
   */
  compileTransform({
    logger,
    memoryFiles,
    processedConfig,
  }: {
    logger: _typhonjs_utils_logger_color.ColorLogger;
    memoryFiles: Map<string, string>;
    processedConfig: _typhonjs_build_test_esm_d_ts.ProcessedConfig;
  }): void;
  /**
   * Compiles the Svelte component returning the JS code so that `es-module-lexer` can parse it.
   *
   * @param {object}   data - Data.
   *
   * @param {string}   data.fileData - Svelte component file to compile / transform
   *
   * @returns {string} Compiled JS section of Svelte component.
   */
  lexerTransform({ fileData }: { fileData: string }): string;
  /**
   * Svelte v4 types will add a triple slash reference `/// <reference types="svelte" />` for generated types.
   * To remove it a regex is added to the `esm-d-ts` GenerateConfig -> `dtsReplace`.
   *
   * @param {object}   data - Event data.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - `esm-d-ts` processed
   *        configuration data.
   */
  lifecycleStart({ processedConfig }: { processedConfig: _typhonjs_build_test_esm_d_ts.ProcessedConfig }): void;
  /**
   * Handles postprocessing intermediate generated DTS files.
   *
   * @param {object} data - Event data.
   *
   * @param {typeof import('@typhonjs-build-test/esm-d-ts/postprocess').PostProcess} data.PostProcess - Post process
   *        manager from `esm-d-ts`.
   *
   * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - `esm-d-ts` processed
   *        configuration data.
   */
  postprocessDTS({
    PostProcess,
    processedConfig,
  }: {
    PostProcess: typeof _typhonjs_build_test_esm_d_ts_postprocess.PostProcess;
    processedConfig: _typhonjs_build_test_esm_d_ts.ProcessedConfig;
  }): Promise<void>;
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
