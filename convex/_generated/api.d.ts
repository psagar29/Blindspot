/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as assets from "../assets.js";
import type * as configs from "../configs.js";
import type * as library from "../library.js";
import type * as reports from "../reports.js";
import type * as runs from "../runs.js";
import type * as scenarios from "../scenarios.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as validation from "../validation.js";
import type * as validators from "../validators.js";
import type * as worlds from "../worlds.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  assets: typeof assets;
  configs: typeof configs;
  library: typeof library;
  reports: typeof reports;
  runs: typeof runs;
  scenarios: typeof scenarios;
  seed: typeof seed;
  sessions: typeof sessions;
  validation: typeof validation;
  validators: typeof validators;
  worlds: typeof worlds;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
