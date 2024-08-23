import type * as C from '../util/Consts';
import { NamedFunction, RegularFunction, SpecialFunction } from './Core';
export * from './Core';
export type RegularFunctionMap = Record<C.RegularOperator, RegularFunction>;
export declare const regularFunctions: RegularFunctionMap;
export type SpecialFunctionAsyncMap = Record<C.SpecialOperator, SpecialFunction>;
export declare const specialFunctions: SpecialFunctionAsyncMap;
export type NamedFunctionMap = Record<C.NamedOperator, NamedFunction>;
export declare const namedFunctions: NamedFunctionMap;
export { SearchStack } from './OverloadTree';
export { OverloadTree } from './OverloadTree';
