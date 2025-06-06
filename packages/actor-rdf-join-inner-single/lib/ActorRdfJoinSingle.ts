import type {
  IActionRdfJoin,
  IActorRdfJoinOutputInner,
  IActorRdfJoinArgs,
  IActorRdfJoinTestSideData,
} from '@comunica/bus-rdf-join';
import { ActorRdfJoin } from '@comunica/bus-rdf-join';
import type { TestResult } from '@comunica/core';
import { passTestWithSideData, failTest } from '@comunica/core';
import type { IMediatorTypeJoinCoefficients } from '@comunica/mediatortype-join-coefficients';

/**
 * A comunica Single RDF Join Actor.
 */
export class ActorRdfJoinSingle extends ActorRdfJoin {
  public constructor(args: IActorRdfJoinArgs) {
    super(args, {
      logicalType: 'inner',
      physicalName: 'single',
      limitEntries: 1,
    });
    this.includeInLogs = false;
  }

  public override async test(
    action: IActionRdfJoin,
  ): Promise<TestResult<IMediatorTypeJoinCoefficients, IActorRdfJoinTestSideData>> {
    // Allow joining of one or zero streams
    if (action.entries.length !== 1) {
      return failTest(`Actor ${this.name} can only join a single entry`);
    }
    return await this.getJoinCoefficients(action, undefined!);
  }

  protected async getOutput(action: IActionRdfJoin): Promise<IActorRdfJoinOutputInner> {
    return {
      result: action.entries[0].output,
    };
  }

  protected async getJoinCoefficients(
    action: IActionRdfJoin,
    sideData: IActorRdfJoinTestSideData,
  ): Promise<TestResult<IMediatorTypeJoinCoefficients, IActorRdfJoinTestSideData>> {
    return passTestWithSideData({
      iterations: 0,
      persistedItems: 0,
      blockingItems: 0,
      requestTime: 0,
    }, sideData);
  }
}
