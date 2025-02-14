import { IQuerySource } from "@comunica/types";
import { QuerySourceReasoning } from "./QuerySourceReasoning";
import { QuerySourceReasoningMultipleSources } from "./QuerySourceReasoningMultipleSources";

export function isQuerySourceReasoning(querySource: IQuerySource): querySource is QuerySourceReasoning {
    return querySource.toString().includes("QuerySourceReasoning");
}

export function isQuerySourceReasoningMultipleSources(querySource: IQuerySource): querySource is QuerySourceReasoningMultipleSources {
    return querySource.toString().includes("QuerySourceReasoningMultipleSources");
}

export interface IClosingCondition {
    closeHint: (callback: () => void) => void
}