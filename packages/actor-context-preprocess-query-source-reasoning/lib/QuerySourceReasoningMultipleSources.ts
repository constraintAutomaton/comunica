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
import { AbstractQuerySourceReasoning } from './QuerySourceReasoning';
import { ActorContextPreprocessQuerySourceReasoning } from './ActorContextPreprocessQuerySourceReasoning';
import { IClosingCondition } from './util';
import { EventEmitter } from 'events';

export class QuerySourceReasoningMultipleSources extends AbstractQuerySourceReasoning {

    private importCounter: number = 0;
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
        console.log(`entering closing counter ${this.importCounter}`);
        if (this.importCounter === 0) {
            this.implicitQuadStore.end();
        } else {
            this.safeClosingEvent.on("close", () => {
                // because the store may need another "tick" to finish the import of its quads
                setImmediate(()=>{
                    this.implicitQuadStore.end();

                })
            });
        }
        this.isclose = true;
    }

    public addSource(quadStream: AsyncIterator<RDF.Quad>, url: string, context: IActionContext): Error | undefined {
        this.importCounter += 1;
        if (this.isclose) {
            return new Error("The query source is closed");
        }

        let rules: ScopedRules | undefined = context.get(KeyReasoning.rules);
        if (rules === undefined) {
            return new Error('the "KeyReasoning" is not defined in the context');
        }
        const effectiveRule = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(rules, url);
        const implicitQuads = QuerySourceReasoningMultipleSources.generateImplicitQuads(effectiveRule, quadStream);

        const eventImport = this.implicitQuadStore.import(implicitQuads);

        eventImport.on("end", () => {
            this.importCounter -= 1;
            if (this.importCounter === 0) {
                this.safeClosingEvent.emit("close");
            }
        });

    }

    public override toString(): string {
        return `QuerySourceReasoningMultipleSources(${this.innerSource.toString()})`;
    }
}

