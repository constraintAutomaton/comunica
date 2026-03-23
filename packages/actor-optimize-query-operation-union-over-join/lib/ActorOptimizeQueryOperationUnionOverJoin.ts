import { QueryEngineBase } from '@comunica/actor-init-query';
import type { ActorInitQueryBase } from '@comunica/actor-init-query';
import {
  ActorOptimizeQueryOperation,
  type IActionOptimizeQueryOperation,
  type IActorOptimizeQueryOperationOutput,
  type IActorOptimizeQueryOperationArgs,
} from '@comunica/bus-optimize-query-operation';
import { type TestResult, type IActorTest, passTestVoid } from '@comunica/core';
import { isError } from 'result-interface';
import { resultAwareSourceSelection, type IFederationMember } from './resultAwareSourceSelection';

export interface IActorOptimizeQueryOperationUnionOverJoinArgs extends IActorOptimizeQueryOperationArgs {
  actorInitQuery: ActorInitQueryBase;
}

/**
 * A comunica Union Over Join Optimize Query Operation Actor.
 */
export class ActorOptimizeQueryOperationUnionOverJoin extends ActorOptimizeQueryOperation {
  private readonly queryEngine: QueryEngineBase;

  public constructor(args: IActorOptimizeQueryOperationUnionOverJoinArgs) {
    super(args);
    this.queryEngine = new QueryEngineBase(args.actorInitQuery);
  }

  public async test(action: IActionOptimizeQueryOperation): Promise<TestResult<IActorTest>> {
    return passTestVoid(); // TODO implement
  }

  public async run(action: IActionOptimizeQueryOperation): Promise<IActorOptimizeQueryOperationOutput> {
    const federation: IFederationMember[] = action.context.get<IFederationMember[]>('federation' as any) ?? [];
    const planResult = await resultAwareSourceSelection(action.operation, federation, this.queryEngine, action.context);
    if (isError(planResult)) {
      return { operation: action.operation, context: action.context };
    }
    return { operation: planResult.value, context: action.context };
  }
}
