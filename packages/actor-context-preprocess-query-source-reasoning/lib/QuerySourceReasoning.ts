import { BindingsToQuadsIterator } from '@comunica/actor-query-operation-construct';
import { ActorQueryOperationUnion } from '@comunica/actor-query-operation-union';
import { QuerySourceRdfJs } from '@comunica/actor-query-source-identify-rdfjs';
import type { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { KeysInitQuery } from '@comunica/context-entries';
import type {
  BindingsStream,
  FragmentSelectorShape,
  IActionContext,
  IQueryBindingsOptions,
  IQuerySource,
} from '@comunica/types';
import type { BindingsFactory } from '@comunica/utils-bindings-factory';
import type * as RDF from '@rdfjs/types';
import type { AsyncIterator } from 'asynciterator';
import { UnionIterator } from 'asynciterator';
import { StreamingStore } from 'rdf-streaming-store';
import type { Algebra } from 'sparqlalgebrajs';
import { Factory } from 'sparqlalgebrajs';
import type { IRuleGraph } from './Rules';

const AF = new Factory();

export abstract class AbstractQuerySourceReasoning implements IQuerySource {
  /**
   * The query source to wrap over.
   */
  protected readonly innerSource: IQuerySource;
  /**
   * ID of the inner source, see KeysQuerySourceIdentify.sourceIds.
   */
  public readonly sourceId?: string;

  public readonly rulesString: string = '';

  protected readonly selectorShape: FragmentSelectorShape;

  protected readonly implicitQuadStore: StreamingStore = new StreamingStore();
  protected readonly implicitQuadQuerySource: IQuerySource;

  public readonly mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;

  protected isclose = false;

  public constructor(
    innerSource: IQuerySource,
    sourceId: string | undefined,
    ruleGraph: IRuleGraph,
    bindingsFactory: BindingsFactory,
    mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
    context: IActionContext,
    autoClose: boolean,
  ) {
    this.innerSource = innerSource;
    this.sourceId = sourceId;
    const dataFactory = context.getSafe(KeysInitQuery.dataFactory);
    this.mediatorRdfMetadataAccumulate = mediatorRdfMetadataAccumulate;

    const getAllQuadsOperation = AF.createPattern(
      dataFactory.variable('s'),
      dataFactory.variable('p'),
      dataFactory.variable('o'),
    );

    for (const rule of ruleGraph.rules) {
      this.rulesString += `/${rule.toString()}`;
    }
    const queryAllBindings = this.innerSource.queryBindings(getAllQuadsOperation, context);
    const quadStream = queryAllBindings.map(bindings => BindingsToQuadsIterator.bindQuad(bindings, dataFactory.quad(
      dataFactory.variable('s'),
      dataFactory.variable('p'),
      dataFactory.variable('o'),
    ))!);

    const implicitQuads = QuerySourceReasoning.generateImplicitQuads(ruleGraph, quadStream);

    this.implicitQuadStore.import(implicitQuads);
    this.implicitQuadQuerySource = new QuerySourceRdfJs(
      this.implicitQuadStore,
      dataFactory,
      bindingsFactory,
    );

    this.selectorShape = {
      type: 'operation',
      operation: {
        operationType: 'pattern',
        pattern: AF.createPattern(
          dataFactory.variable('s'),
          dataFactory.variable('p'),
          dataFactory.variable('o'),
        ),
      },
      variablesOptional: [
        dataFactory.variable('s'),
        dataFactory.variable('p'),
        dataFactory.variable('o'),
      ],
    };

    if (autoClose) {
      implicitQuads.on('end', () => {
        this.implicitQuadStore.end();
        this.isclose = true;
      });
    }
  }

  /**
   * Generate the implicit quads based a provided rules and a quad stream
   * @param {IRuleGraph} ruleGraph - Rules to be applied over the quad stream
   * @param {AsyncIterator<RDF.Quad>} quadStream - quad stream that the rules are applied over
   * @returns {AsyncIterator<RDF.Quad>} implicit quads generated
   */
  public static generateImplicitQuads(ruleGraph: IRuleGraph, quadStream: AsyncIterator<RDF.Quad>): AsyncIterator<RDF.Quad> {
    const implicitQuadsStream: AsyncIterator<RDF.Quad> = quadStream.transform({
      autoStart: false,
      transform: (quad: RDF.Quad, done, push) => {
        const implicitQuads = this.chainReasoningOverAQuad(ruleGraph, quad);
        for (const implicitQuad of implicitQuads) {
          push(implicitQuad);
        }
        done();
      },
    });
    return implicitQuadsStream;
  }

  /**
   * Apply a chain of reasoning over a single quad
   * @param {ruleGraph} ruleGraph - Rules to be applied
   * @param {RDF.Quad} quad - Quad
   * @returns An array of implicit quads
   */
  public static chainReasoningOverAQuad(ruleGraph: IRuleGraph, quad: RDF.Quad): RDF.Quad[] {
    const implicitQuads: RDF.Quad[] = [];
    const queueQuads: RDF.Quad[] = [];
    let currentQuad: RDF.Quad | undefined = quad;
    do {
      for (const rule of ruleGraph.rules) {
        const implicitQuad = rule.forwardChaining(currentQuad);
        if (implicitQuad !== undefined) {
          implicitQuads.push(implicitQuad);
          queueQuads.push(implicitQuad);
        }
      }
      currentQuad = queueQuads.pop();
    } while (currentQuad !== undefined);

    return implicitQuads;
  }

  public async getSelectorShape(): Promise<FragmentSelectorShape> {
    return this.selectorShape;
  }

  public queryBindings(
    operation: Algebra.Operation,
    context: IActionContext,
    options?: IQueryBindingsOptions | undefined,
  ): BindingsStream {
    if (options !== undefined) {
      throw new Error('options in queryBindings are not supported in QuerySourceReasoning');
    }
    if (operation.type !== 'pattern') {
      throw new Error(`Attempted to pass non-pattern operation '${operation.type}' to QuerySourceReasoning`);
    }

    const bindingStreamOriginal = this.innerSource.queryBindings(operation, context, options);
    const implicitBindingStream = this.implicitQuadQuerySource.queryBindings(operation, context, options);

    const unions = new UnionIterator([ bindingStreamOriginal, implicitBindingStream ], { autoStart: false });

    if (!unions.getProperty('metadata')) {
      this.setMetadata(unions, bindingStreamOriginal, implicitBindingStream, context)
        .catch(error => {
          unions.destroy(error)
        });
    }

    return unions;
  }

  public async queryBoolean(): Promise<boolean> {
    throw new Error('queryBoolean is not implemented in QuerySourceReasoning');
  }

  public queryQuads(): AsyncIterator<RDF.Quad> {
    throw new Error('queryQuads is not implemented in QuerySourceReasoning');
  }

  public queryVoid(): Promise<void> {
    throw new Error('queryVoid is not implemented in QuerySourceReasoning');
  }

  public get referenceValue(): string | RDF.Source {
    return this.innerSource.referenceValue;
  }

  public get closed(): boolean {
    return this.isclose;
  }

  public close(): void {
    this.implicitQuadStore.end();
    this.isclose = true;
  }

  protected async setMetadata(
    it: BindingsStream,
    originalBindingStream: BindingsStream,
    implicitBindingStream: BindingsStream,
    context: IActionContext,
  ): Promise<void> {
    originalBindingStream.getProperty('metadata', (originalMetadata: any) => {
      implicitBindingStream.getProperty('metadata', async(implicitMetadata: any) => {
        const metadata = await ActorQueryOperationUnion.unionMetadata([ originalMetadata, implicitMetadata ], true, context, this.mediatorRdfMetadataAccumulate);
        it.setProperty('metadata', metadata);
      });
    });
  }

  abstract toString(): string;
}

export class QuerySourceReasoning extends AbstractQuerySourceReasoning {
  public constructor(
    innerSource: IQuerySource,
    sourceId: string | undefined,
    ruleGraph: IRuleGraph,
    bindingsFactory: BindingsFactory,
    mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
    context: IActionContext,
  ) {
    super(innerSource, sourceId, ruleGraph, bindingsFactory, mediatorRdfMetadataAccumulate, context, true);
  }

  public override toString(): string {
    return `QuerySourceReasoning(${this.innerSource.toString()})`;
  }
}
