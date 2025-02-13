import { KeysInitQuery } from '@comunica/context-entries';
import { type BindingsFactory } from '@comunica/utils-bindings-factory';
import type {
  BindingsStream,
  FragmentSelectorShape,
  IActionContext,
  IQueryBindingsOptions,
  IQuerySource,
} from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { AsyncIterator, UnionIterator } from 'asynciterator';
import type { Algebra } from 'sparqlalgebrajs';
import { Factory } from 'sparqlalgebrajs';
import { IRuleGraph } from './Rules';
import { BindingsToQuadsIterator } from '@comunica/actor-query-operation-construct';
import { StreamingStore } from 'rdf-streaming-store';
import { QuerySourceRdfJs } from '@comunica/actor-query-source-identify-rdfjs';
import { MediatorRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { ActorQueryOperationUnion } from '@comunica/actor-query-operation-union';


const AF = new Factory();

export class QuerySourceReasoning implements IQuerySource {
  /**
   * The query source to wrap over.
   */
  protected readonly innerSource: IQuerySource;
  /**
   * ID of the inner source, see KeysQuerySourceIdentify.sourceIds.
   */
  public readonly sourceId?: string;

  public readonly rulesString: string = "";

  protected readonly selectorShape: FragmentSelectorShape;


  protected readonly implicitQuadStore = new StreamingStore();
  protected readonly implicitQuadQuerySource: IQuerySource;

  protected readonly autoClose: boolean = true;

  public readonly mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate;

  public constructor(
    innerSource: IQuerySource,
    sourceId: string | undefined,
    ruleGraph: IRuleGraph,
    bindingsFactory: BindingsFactory,
    mediatorRdfMetadataAccumulate: MediatorRdfMetadataAccumulate,
    context: IActionContext
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
      this.rulesString += "/" + rule.toString();
    }
    const queryAllBindings = this.innerSource.queryBindings(getAllQuadsOperation, context);
    const quadStream = queryAllBindings.map(bindings => {
      return BindingsToQuadsIterator.bindQuad(bindings, dataFactory.quad(
        dataFactory.variable('s'),
        dataFactory.variable('p'),
        dataFactory.variable('o')))!
    });

    const implicitQuads = this.generateImplicitQuads(ruleGraph, quadStream);
    if(this.autoClose){
      implicitQuads.on('end', () => {
        this.implicitQuadStore.end();
      });
    }
    this.implicitQuadStore.import(implicitQuads);
    this.implicitQuadQuerySource = new QuerySourceRdfJs(
      this.implicitQuadStore,
      context.getSafe(KeysInitQuery.dataFactory),
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
  }

  public generateImplicitQuads(ruleGraph: IRuleGraph, quadStream: AsyncIterator<RDF.Quad>): AsyncIterator<RDF.Quad> {
    const implicitQuadsStream: AsyncIterator<RDF.Quad> = quadStream.transform({
      autoStart: false,
      transform: (quad: RDF.Quad, done, push) => {
        const implicitQuads = this.reasoningLoop(ruleGraph, quad);
        for (const implicitQuad of implicitQuads) {
          push(implicitQuad);
        }
        done();
      },
    });
    return implicitQuadsStream;
  }

  private reasoningLoop(ruleGraph: IRuleGraph, quad: RDF.Quad): RDF.Quad[] {
    const implicitQuads: RDF.Quad[] = [];
    let noNewQuad = false;
    let currentQuad = quad;
    do {
      noNewQuad = true;
      for (const rule of ruleGraph.rules) {
        const implicitQuad = rule.forwardChaining(currentQuad);
        if (implicitQuad !== undefined) {
          implicitQuads.push(implicitQuad);
          currentQuad = implicitQuad;
          noNewQuad = false;
        } else {
          noNewQuad = noNewQuad && true;
        }
      }
    } while (noNewQuad === false)

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

    const unions = new UnionIterator([bindingStreamOriginal, implicitBindingStream], { autoStart: false });

    if (!unions.getProperty('metadata')) {
      this.setMetadata(unions, bindingStreamOriginal, implicitBindingStream, context)
        .catch(error => unions.destroy(error));
    }

    return unions;
  }

  public async queryBoolean(operation: Algebra.Ask, context: IActionContext): Promise<boolean> {
    const booleanRespOriginal = await this.innerSource.queryBoolean(operation, context);
    const booleanRespImplicit = await this.implicitQuadQuerySource.queryBoolean(operation, context);
    return booleanRespOriginal || booleanRespImplicit;
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

  protected async setMetadata(
    it: BindingsStream,
    originalBindingStream: BindingsStream,
    implicitBindingStream: BindingsStream,
    context: IActionContext,
  ): Promise<void> {
    originalBindingStream.getProperty("metadata", (originalMetadata: any) => {
      implicitBindingStream.getProperty("metadata", async (implicitMetadata: any) => {
        const metadata = await ActorQueryOperationUnion.unionMetadata([originalMetadata, implicitMetadata], true, context, this.mediatorRdfMetadataAccumulate)
        it.setProperty('metadata', metadata);
      });
    });
  }


  public toString(): string {
    return `QuerySourceReasoning(${this.innerSource.constructor.name})`;
  }
}
