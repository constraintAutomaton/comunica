import { KeyReasoning, KeysInitQuery } from '@comunica/context-entries';
import { type BindingsFactory } from '@comunica/utils-bindings-factory';
import type {
    BindingsStream,
    IActionContext,
    IQueryBindingsOptions,
    IQuerySource,
} from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { AsyncIterator, UnionIterator } from 'asynciterator';
import type { Algebra } from 'sparqlalgebrajs';
import { IRuleGraph, ScopedRules } from './Rules';
import { StreamingStore } from 'rdf-streaming-store';
import { QuerySourceRdfJs } from '@comunica/actor-query-source-identify-rdfjs';
import { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { QuerySourceReasoning } from './QuerySourceReasoning';
import { ActorContextPreprocessQuerySourceReasoning } from './ActorContextPreprocessQuerySourceReasoning';

export class QuerySourceReasoningMultipleSources extends QuerySourceReasoning {

    private readonly implicitQuadQuerySources: IQuerySource[] = [];
    private bindingFactory: BindingsFactory;
    public constructor(
        innerSource: IQuerySource,
        sourceId: string | undefined,
        ruleGraph: IRuleGraph,
        bindingsFactory: BindingsFactory,
        mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
        context: IActionContext
    ) {
        super(innerSource, sourceId, ruleGraph, bindingsFactory, mediatorRdfMetadataAccumulate, context);
        this.bindingFactory = bindingsFactory;
    }

    public addSource(quadStream: AsyncIterator<RDF.Quad>, url: string, context: IActionContext) {
        let rules: ScopedRules | undefined = context.get(KeyReasoning.rules);
        if (rules === undefined) {
            return;
        }
        const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, url);
        const implicitQuads = this.generateImplicitQuads(effectiveRule, quadStream);
        const implicitQuadStore = new StreamingStore();
        implicitQuads.on('end', () => {
            implicitQuadStore.end();
        });
        implicitQuadStore.import(implicitQuads);
        const querySourceImplicit = new QuerySourceRdfJs(
            implicitQuadStore,
            context.getSafe(KeysInitQuery.dataFactory),
            this.bindingFactory,
        );
        this.implicitQuadQuerySources.push(querySourceImplicit);
    }

    public override queryBindings(operation: Algebra.Operation,
        context: IActionContext,
        options?: IQueryBindingsOptions | undefined,): BindingsStream {
        let resultingStream = super.queryBindings(operation, context, options);
        for (const querySource of this.implicitQuadQuerySources) {
            const implicitBindingStream = querySource.queryBindings(operation, context, options);
            const unions = new UnionIterator([resultingStream, implicitBindingStream], { autoStart: false });
            if (!unions.getProperty('metadata')) {
                this.setMetadata(unions, resultingStream, implicitBindingStream, context)
                    .catch(error => unions.destroy(error));
            }
            resultingStream = unions;
        }

        return resultingStream;
    }

    public override async queryBoolean(operation: Algebra.Ask, context: IActionContext): Promise<boolean> {
        const firstResponse = await super.queryBoolean(operation, context);
        const implicitResponsesOperations = [];

        for (const querySource of this.implicitQuadQuerySources) {
            implicitResponsesOperations.push(querySource.queryBoolean(operation, context));
        }
        const implicitResponses = await Promise.all(implicitResponsesOperations);
        return implicitResponses.reduce((accumulator, currentValue) => accumulator = accumulator || currentValue
            , firstResponse)

    }

    public override toString(): string {
        return `QuerySourceReasoningMultipleSources(${this.innerSource.constructor.name})`;
      }
}
