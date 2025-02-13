import { KeyReasoning } from '@comunica/context-entries';
import { type BindingsFactory } from '@comunica/utils-bindings-factory';
import type {
    IActionContext,
    IQuerySource,
} from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { AsyncIterator } from 'asynciterator';
import { IRuleGraph, ScopedRules } from './Rules';
import { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { QuerySourceReasoning } from './QuerySourceReasoning';
import { ActorContextPreprocessQuerySourceReasoning } from './ActorContextPreprocessQuerySourceReasoning';

export class QuerySourceReasoningMultipleSources extends QuerySourceReasoning {


    protected override readonly autoClose: boolean = false;

    public constructor(
        innerSource: IQuerySource,
        sourceId: string | undefined,
        ruleGraph: IRuleGraph,
        bindingsFactory: BindingsFactory,
        mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
        context: IActionContext,
        closingEvent: IClosingCondition,
    ) {
        super(innerSource, sourceId, ruleGraph, bindingsFactory, mediatorRdfMetadataAccumulate, context);
        closingEvent.closeHint(() => {
            this.implicitQuadStore.end();
        });
    }

    public close(): void {
        this.implicitQuadStore.end();
    }

    public addSource(quadStream: AsyncIterator<RDF.Quad>, url: string, context: IActionContext) {
        let rules: ScopedRules | undefined = context.get(KeyReasoning.rules);
        if (rules === undefined) {
            return;
        }
        const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, url);
        const implicitQuads = this.generateImplicitQuads(effectiveRule, quadStream);

        this.implicitQuadStore.import(implicitQuads);
    }

    public override toString(): string {
        return `QuerySourceReasoningMultipleSources(${this.innerSource.constructor.name})`;
    }
}

export interface IClosingCondition {
    closeHint: (callback: () => void) => void
}