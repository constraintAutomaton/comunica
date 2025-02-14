import { ActorContextPreprocessQuerySourceReasoning, IClosingCondition, ReasoningQuerySourceMap, ScopedRules } from '@comunica/actor-context-preprocess-query-source-reasoning';
import { QuerySourceReasoning } from '@comunica/actor-context-preprocess-query-source-reasoning/lib/QuerySourceReasoning';
import { QuerySourceReasoningMultipleSources } from '@comunica/actor-context-preprocess-query-source-reasoning/lib/QuerySourceReasoningMultipleSources';
import { getSourceId } from '@comunica/actor-context-preprocess-query-source-skolemize';
import { MediatorMergeBindingsContext } from '@comunica/bus-merge-bindings-context';
import { ActorQuerySourceIdentifyHypermedia, IActionQuerySourceIdentifyHypermedia, IActorQuerySourceIdentifyHypermediaOutput, IActorQuerySourceIdentifyHypermediaArgs, IActorQuerySourceIdentifyHypermediaTest, MediatorQuerySourceIdentifyHypermedia } from '@comunica/bus-query-source-identify-hypermedia';
import { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { KeyReasoning, KeysInitQuery, KeysQuerySourceIdentify } from '@comunica/context-entries';
import { TestResult, IActorArgs, IActorTest, passTest, failTest } from '@comunica/core';
import { IAggregatedStore, IQuerySource, QuerySourceReference } from '@comunica/types';
import { BindingsFactory } from '@comunica/utils-bindings-factory';
import type * as RDF from '@rdfjs/types';

/**
 * A comunica Reasoning Wrapper Query Source Identify Hypermedia Actor.
 */
export class ActorQuerySourceIdentifyHypermediaReasoningWrapper extends ActorQuerySourceIdentifyHypermedia {
  public readonly mediatorQuerySourceIdentifyHypermedia: MediatorQuerySourceIdentifyHypermedia;
  public readonly mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;
  public readonly mediatorMergeBindingsContext: MediatorMergeBindingsContext;

  public constructor(args: IActorQuerySourceIdentifyHypermediaReasoningWrapper) {
    super(args, "reasoningWrapper");
  }


  public async testMetadata(
    action: IActionQuerySourceIdentifyHypermedia,
  ): Promise<TestResult<IActorQuerySourceIdentifyHypermediaTest>> {
    const reasoningSourceMap = action.context.get(KeyReasoning.querySources);
    if (!reasoningSourceMap) {
      action.context = action.context.set(KeyReasoning.querySources, new Map());
      return passTest({ filterFactor: 0 });
    }
    if (reasoningSourceMap.has(action.url)) {
      return failTest("query source already wrapped");
    }

    return passTest({ filterFactor: 0 });
  }

  public async run(action: IActionQuerySourceIdentifyHypermedia): Promise<IActorQuerySourceIdentifyHypermediaOutput> {
    this.logInfo(action.context, `Identified as file source: ${action.url}`);

    let rules: ScopedRules | undefined = action.context.get(KeyReasoning.rules);
    if (rules === undefined) {
      action.context = action.context.set(KeyReasoning.rules, new Map());
      rules = action.context.getSafe(KeyReasoning.rules);
    }

    const reasoningSourceMap = action.context.getSafe(KeyReasoning.querySources);
    reasoningSourceMap.set(action.url, true);

    const sourceIds: Map<QuerySourceReference, string> = action.context.getSafe(KeysQuerySourceIdentify.sourceIds);
    const dataFactory = action.context.getSafe(KeysInitQuery.dataFactory);

    const metadata = action.metadata;
    if (metadata["reasoningAggregatedStore"] !== undefined) {
      const innerSource = <IQuerySource>metadata["reasoningAggregatedStore"]["source"];

      const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, action.url);
      const closingCondition: IClosingCondition = {
        closeHint: (callback: () => void) => {
          const aggregatedStore = <IAggregatedStore>metadata["reasoningAggregatedStore"]["store"];
          const it = aggregatedStore.match(null, null, null, null);
          it.on("end", () => {
            callback();
          })
        }
      }
      const source = new QuerySourceReasoningMultipleSources(
        innerSource,
        getSourceId(sourceIds, innerSource),
        effectiveRule,
        await BindingsFactory.create(this.mediatorMergeBindingsContext, action.context, dataFactory),
        this.mediatorRdfMetadataAccumulate,
        action.context,
        closingCondition
      );
      return {
        source,
      }
    } else {
      const innerSource = await this.mediatorQuerySourceIdentifyHypermedia.mediate(action);

      const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, innerSource.source.referenceValue);

      const source = new QuerySourceReasoning(
        innerSource.source,
        getSourceId(sourceIds, innerSource.source),
        effectiveRule,
        await BindingsFactory.create(this.mediatorMergeBindingsContext, action.context, dataFactory),
        this.mediatorRdfMetadataAccumulate,
        action.context,
      );

      return {
        source,
        dataset: innerSource.dataset
      }
    }


  }
}

export interface IActorQuerySourceIdentifyHypermediaReasoningWrapper extends IActorQuerySourceIdentifyHypermediaArgs {
  /**
   * The hypermedia resolve mediator
   */
  mediatorQuerySourceIdentifyHypermedia: MediatorQuerySourceIdentifyHypermedia;
  mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;
  /**
   * A mediator for creating binding context merge handlers
   */
  mediatorMergeBindingsContext: MediatorMergeBindingsContext;

}
