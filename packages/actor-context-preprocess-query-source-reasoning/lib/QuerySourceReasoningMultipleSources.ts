import { EventEmitter } from 'node:events';
import type { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { KeyReasoning } from '@comunica/context-entries';
import type {
  IActionContext,
  IQuerySource,
} from '@comunica/types';
import type { BindingsFactory } from '@comunica/utils-bindings-factory';
import type * as RDF from '@rdfjs/types';
import type { AsyncIterator } from 'asynciterator';
import { error, type Result } from 'result-interface';
import { ActorContextPreprocessQuerySourceReasoning } from './ActorContextPreprocessQuerySourceReasoning';
import { AbstractQuerySourceReasoning } from './QuerySourceReasoning';
import type { IRuleGraph, ScopedRules } from './Rules';
import type { IClosingCondition } from './util';

export class QuerySourceReasoningMultipleSources extends AbstractQuerySourceReasoning {
  private importCounter = 0;
  private readonly safeClosingEvent: EventEmitter = new EventEmitter();

  public constructor(
    innerSource: IQuerySource,
    sourceId: string | undefined,
    ruleGraph: IRuleGraph,
    bindingsFactory: BindingsFactory,
    mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
    context: IActionContext,
    closingEvent: IClosingCondition,
  ) {
    super(innerSource, sourceId, ruleGraph, bindingsFactory, mediatorRdfMetadataAccumulate, context, false);
    closingEvent.closeHint(() => {
      this.close();
    });
  }

  public override close(): void {
    if (this.importCounter === 0) {
      this.implicitQuadStore.end();
    } else {
      this.safeClosingEvent.on('close', () => {
        // Because the store may need another "tick" to finish the import of its quads
        setImmediate(() => {
          this.implicitQuadStore.end();
        });
      });
    }
    this.isclose = true;
  }

  public addSource(quadStream: AsyncIterator<RDF.Quad>, url: string, context: IActionContext): Result<undefined, Error> {
    this.importCounter += 1;
    if (this.isclose) {
      return error(new Error('the query source is closed'));
    }

    const rules: ScopedRules | undefined = context.get(KeyReasoning.rules);
    if (rules === undefined) {
      return error(new Error('the "KeyReasoning" is not defined in the context'));
    }
    const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, url);
    const implicitQuads = QuerySourceReasoningMultipleSources.generateImplicitQuads(effectiveRule, quadStream);

    const eventImport = this.implicitQuadStore.import(implicitQuads);

    eventImport.on('end', () => {
      this.importCounter -= 1;
      if (this.importCounter === 0) {
        this.safeClosingEvent.emit('close');
      }
    });

    return {
      value:undefined
    };
  }

  public override toString(): string {
    return `QuerySourceReasoningMultipleSources(${this.innerSource.toString()})`;
  }
}
