import type {
  IActionQuerySourceIdentify,
  IActorQuerySourceIdentifyOutput,
  IActorQuerySourceIdentifyArgs,
} from '@comunica/bus-query-source-identify';
import { ActorQuerySourceIdentify } from '@comunica/bus-query-source-identify';
import type { IActorTest, TestResult } from '@comunica/core';
import { ActionContext, failTest, passTestVoid } from '@comunica/core';
import { QueryEngine } from '@comunica/query-sparql-rdfjs-lite';
import { isISummary, KeysSchemaSource, QuerySourceSchema } from './QuerySourceSchema';

const QUERY_ENGINE = new QueryEngine();

/**
 * A comunica Schema Query Source Identify Actor.
 */
export class ActorQuerySourceIdentifySchema extends ActorQuerySourceIdentify {
  public constructor(args: IActorQuerySourceIdentifyArgs) {
    super(args);
  }

  public async test(action: IActionQuerySourceIdentify): Promise<TestResult<IActorTest>> {
    if (action.querySourceUnidentified.type !== undefined && action.querySourceUnidentified.type !== 'schema') {
      return failTest(`${this.name} requires a query source with schema type.`);
    }
    if (typeof action.querySourceUnidentified.value !== 'string') {
      return failTest(`${this.name} requires a string URL as value.`);
    }
    if (!action.querySourceUnidentified.context?.has(KeysSchemaSource.summary)) {
      return failTest(`${this.name} requires a summary in the source context.`);
    }
    return passTestVoid();
  }

  public async run(action: IActionQuerySourceIdentify): Promise<IActorQuerySourceIdentifyOutput> {
    const { value, context } = action.querySourceUnidentified;
    if (typeof value !== 'string') {
      throw new TypeError(`${this.name} requires a string URL as value.`);
    }
    const summary = context?.get(KeysSchemaSource.summary);
    if (!isISummary(summary)) {
      throw new Error(`${this.name} received an invalid schema query source: summary missing from context.`);
    }

    return {
      querySource: {
        source: new QuerySourceSchema(summary, value, QUERY_ENGINE),
        context: context ?? new ActionContext(),
      },
    };
  }
}
