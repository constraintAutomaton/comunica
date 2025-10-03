import { getSourceId } from '@comunica/actor-context-preprocess-query-source-skolemize';
import type { QueryEngineBase } from '@comunica/actor-init-query';
import type { IActionContextPreprocess, IActorContextPreprocessOutput } from '@comunica/bus-context-preprocess';
import { ActorContextPreprocess } from '@comunica/bus-context-preprocess';
import type { MediatorMergeBindingsContext } from '@comunica/bus-merge-bindings-context';
import type { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { KeysInitQuery, KeysQueryOperation, KeysQuerySourceIdentify, KeyReasoning } from '@comunica/context-entries';
import type { IActorArgs, IActorTest, TestResult } from '@comunica/core';
import { passTestVoid } from '@comunica/core';
import type { IQuerySourceWrapper, QuerySourceReference } from '@comunica/types';
import { BindingsFactory } from '@comunica/utils-bindings-factory';
import type * as RDF from '@rdfjs/types';
import { StreamingStore } from 'rdf-streaming-store';
import { QuerySourceReasoning } from './QuerySourceReasoning';
import { parseRules, type IRuleGraph, type ScopedRules } from './Rules';

const UriTemplate = require('uri-template-lite');

/**
 * A comunica Query Source Reasoning Context Preprocess Actor.
 */
export class ActorContextPreprocessQuerySourceReasoning extends ActorContextPreprocess {
  public readonly mediatorMergeBindingsContext: MediatorMergeBindingsContext;

  public readonly mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;

  public readonly queryEngine: QueryEngineBase;

  public constructor(args: IActorContextPreprocessQuerySourceReasoningArg) {
    super(args);
  }

  public async test(_action: IActionContextPreprocess): Promise<TestResult<IActorTest>> {
    return passTestVoid();
  }

  public static selectCorrespondingRuleSet(rules: ScopedRules, referenceValue: string | RDF.Source): IRuleGraph {
    const ruleForAll: IRuleGraph = rules.get('*') === undefined ?
      { rules: [] } :
      parseRules(rules.get('*')!);

    if (typeof referenceValue === 'string') {
      const correspondingRules: IRuleGraph = ruleForAll;

      for (const [domain, ruleSet] of rules) {
        if (typeof domain === 'string') {
          const template = new UriTemplate(domain);
          if (template.match(referenceValue) !== null) {
            const ruleGraph = parseRules(ruleSet);
            correspondingRules.rules = [...correspondingRules.rules, ...ruleGraph.rules];
          }
        }
      }
      return correspondingRules;
    } else {
      const rawRules = rules.get(referenceValue);
      if (rawRules !== undefined) {
        const localStoreRule: IRuleGraph = {
          rules: ruleForAll.rules = [...ruleForAll.rules, ...parseRules(rawRules).rules],
        };
        return localStoreRule;
      }
      return ruleForAll;
    }
  }

  public async run(action: IActionContextPreprocess): Promise<IActorContextPreprocessOutput> {
    // Wrap sources in reasoning sources
    if (action.context.has(KeysQueryOperation.querySources)) {
      // Determine map of source id's
      if (!action.context.has(KeysQuerySourceIdentify.sourceIds)) {
        action.context = action.context.set(KeysQuerySourceIdentify.sourceIds, new Map());
      }
      const sourceIds: Map<QuerySourceReference, string> = action.context.getSafe(KeysQuerySourceIdentify.sourceIds);

      let sources: IQuerySourceWrapper[] = action.context.getSafe(KeysQueryOperation.querySources);
      let rules: ScopedRules | undefined = action.context.get(KeyReasoning.rules);
      if (rules === undefined) {
        throw new Error(`${KeyReasoning.rules.name} is not defined in the context`)
      }
      const dataFactory = action.context.getSafe(KeysInitQuery.dataFactory);

      sources = await Promise.all(sources.map(async (sourceWrapper) => {
        if (sourceWrapper.source.toString().startsWith('QuerySourceReasoning')) {
          return sourceWrapper;
        }

        const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, sourceWrapper.source.referenceValue);

        const source = new QuerySourceReasoning(
          sourceWrapper.source,
          getSourceId(sourceIds, sourceWrapper.source),
          effectiveRule,
          await BindingsFactory.create(this.mediatorMergeBindingsContext, action.context, dataFactory),
          this.mediatorRdfMetadataAccumulate,
          action.context,
        );

        return {
          source,
          context: sourceWrapper.context,
        };
      }));
      action.context = action.context.set(KeysQueryOperation.querySources, sources);
    }

    return { context: action.context };
  }
}

export interface IActorContextPreprocessQuerySourceReasoningArg
  extends IActorArgs<IActionContextPreprocess, IActorTest, IActorContextPreprocessOutput> {
  /**
   * A mediator for creating binding context merge handlers
   */
  mediatorMergeBindingsContext: MediatorMergeBindingsContext;

  mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;
}
