/**
 * Types for generateMockupModule.mjs.
 *
 * The implementation is plain ESM so the pretypecheck script can run it under
 * bare node, before tsc, without this package depending on a TypeScript
 * runtime. mockupPreviewPlugin.ts still imports it, so it needs types; they
 * live here rather than turning on allowJs for the whole package.
 */
export declare const MOCKUPS_DIR: string;
export declare const GENERATED_MODULE: string;

export interface DiscoveredComponent {
  /** Key as App.tsx expects it, e.g. "./components/mockups/Foo.tsx". */
  globKey: string;
  /** Import specifier relative to src/.generated. */
  importPath: string;
}

export declare function discoverComponents(root: string): Promise<Array<DiscoveredComponent>>;

export declare function generateSource(components: Array<DiscoveredComponent>): string;

export declare function writeGeneratedModule(
  root: string,
): Promise<{ source: string; changed: boolean }>;
