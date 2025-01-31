import type { EventEmitter } from 'node:events';
import { QueryEngineBase } from '@comunica/actor-init-query';
import { KeysInitQuery, KeysQuerySourceIdentify, KeysQueryOperation } from '@comunica/context-entries';
import { KeysRdfJoin } from '@comunica/context-entries';
import type { BindingsFactory } from '@comunica/utils-bindings-factory';
import type {
  Bindings,
  BindingsStream,
  FragmentSelectorShape,
  IActionContext,
  IQueryBindingsOptions,
  IQuerySource,
} from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { UnionIterator, type AsyncIterator, ArrayIterator, TransformIterator } from 'asynciterator';
import type { Algebra } from 'sparqlalgebrajs';
import { Factory } from 'sparqlalgebrajs';
import { parseRules,IRuleGraph, ScopedRules  } from './Rules';
import { BindingsToQuadsIterator } from '@comunica/actor-query-operation-construct';
import { StreamingStore } from 'rdf-streaming-store';
import { QuerySourceRdfJs } from '@comunica/actor-query-source-identify-rdfjs';
import { quadsToBindings } from '@comunica/bus-query-source-identify';

const UriTemplate = require('uri-template-lite');

const AF = new Factory();

export class QuerySourceReasoning implements IQuerySource {
  /**
   * The query source to wrap over.
   */
  private readonly innerSource: IQuerySource;
  /**
   * ID of the inner source, see KeysQuerySourceIdentify.sourceIds.
   */
  public readonly sourceId?: string;

  private readonly engineContext: any;

  public readonly rules: IRuleGraph;

  protected readonly selectorShape: FragmentSelectorShape;


  private readonly implicitQuadStore = new StreamingStore();
  private readonly implicitQuadQuerySource: IQuerySource;
  private readonly bindingsFactory: BindingsFactory;

  public constructor(
    innerSource: IQuerySource,
    sourceId: string | undefined,
    rules: ScopedRules,
    bindingsFactory: BindingsFactory,
    context: IActionContext
  ) {

    this.bindingsFactory = bindingsFactory;
    this.innerSource = innerSource;
    this.sourceId = sourceId;
    const dataFactory = context.getSafe(KeysInitQuery.dataFactory);
    const getAllQuadsOperation = AF.createPattern(
      dataFactory.variable('s'),
      dataFactory.variable('p'),
      dataFactory.variable('o'),
      dataFactory.variable('g'),
    );
    const ruleGraph = this.selectCorrespondingRuleSet(rules);

    const quadStream = this.innerSource.queryBindings(getAllQuadsOperation, context).map(bindings => {
      return BindingsToQuadsIterator.bindQuad(bindings, dataFactory.quad(
        dataFactory.variable('s'),
        dataFactory.variable('p'),
        dataFactory.variable('o'),
        dataFactory.variable('g')))!
    });


    const implicitQuads = this.generateImplicitQuads(ruleGraph, quadStream);
    implicitQuads.on('end', () => {
      this.implicitQuadStore.end();
    });
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

  private selectCorrespondingRuleSet(rules: ScopedRules): IRuleGraph {
    const ruleForAll: IRuleGraph = rules.get('*') === undefined ?
      { rules: [] } :
      parseRules(rules.get('*')!);

    if (typeof this.referenceValue === 'string') {
      const correspondingRules: IRuleGraph = ruleForAll;

      for (const [domain, ruleSet] of rules) {
        if (typeof domain === 'string') {
          const template = new UriTemplate(domain);
          if (template.match(this.referenceValue) !== null) {
            const ruleGraph = parseRules(ruleSet);
            correspondingRules.rules = [...correspondingRules.rules, ...ruleGraph.rules];
          }
        }
      }
    } else {
      const rawRules = rules.get(this.referenceValue);
      if (rawRules !== undefined) {
        const localStoreRule: IRuleGraph = {
          rules: ruleForAll.rules = [...ruleForAll.rules, ...parseRules(rawRules).rules],
        };
        return localStoreRule;
      }
    }
    return ruleForAll;
  }

  public async getSelectorShape(context: IActionContext): Promise<FragmentSelectorShape> {
    return this.selectorShape;
  }

  public queryBindings(
    operation: Algebra.Operation,
    context: IActionContext,
    options: IQueryBindingsOptions | undefined,
  ): BindingsStream {
    if (options !== undefined) {
      throw new Error('options in queryBindings are not supported in QuerySourceReasoning');
    }
    if (operation.type !== 'pattern') {
      throw new Error(`Attempted to pass non-pattern operation '${operation.type}' to QuerySourceRdfJs`);
    }

    const bindingStreamOriginal = this.innerSource.queryBindings(operation, context, options);
    const implicitBindingStream = this.implicitQuadQuerySource.queryBindings(operation, context, options);
    /**
    const transformedBindingStreamOriginal: BindingsStream = bindingStreamOriginal.transform({
      autoStart: false,
      transform: (bindings: Bindings, done, push) => {
        push(bindings);
        implicitBindingStream.on("data", (data)=>{
          push(data)
        })
        implicitBindingStream.on("end", ()=>{
          done();
        })
      },
    });
    */

    const cloneBindingStream = bindingStreamOriginal.clone();
    const cloneBindingStreamReturn = bindingStreamOriginal.clone();
    const cloneBindingStreamDebug = bindingStreamOriginal.clone();

    const cloneimplicitBindingStream= implicitBindingStream.clone();
    const cloneimplicitBindingStreamReturn = implicitBindingStream.clone();

    const unions: BindingsStream = new UnionIterator([/**cloneBindingStream,*/ cloneimplicitBindingStream], { autoStart: false });

    return unions//transformedBindingStreamOriginal
    /**
    //cloneBindingStreamReturn
    const quads = this.queryQuads(operation, context);
    return quadsToBindings(
      quads,
      operation,
      context.getSafe(KeysInitQuery.dataFactory),
      this.bindingsFactory,
      Boolean(context.get(KeysQueryOperation.unionDefaultGraph)),)
      */
  }

  public async queryBoolean(operation: Algebra.Ask, context: IActionContext): Promise<boolean> {
    const booleanRespOriginal = await this.innerSource.queryBoolean(operation, context);
    const booleanRespImplicit = await this.implicitQuadQuerySource.queryBoolean(operation, context);
    return booleanRespOriginal || booleanRespImplicit;
  }

  public queryQuads(operation: Algebra.Operation, context: IActionContext): AsyncIterator<RDF.Quad> {
    const originalQuads = this.innerSource.queryQuads(operation, context);
    const implicitQuads = this.implicitQuadQuerySource.queryQuads(operation, context);
    return new UnionIterator([originalQuads, implicitQuads], { autoStart: false });
  }

  public queryVoid(): Promise<void> {
    throw new Error('queryVoid is not implemented in QuerySourceReasoning');
  }

  public get referenceValue(): string | RDF.Source {
    return this.innerSource.referenceValue;
  }

  public toString(): string {
    return `QuerySourceReasoning(${this.innerSource.constructor.name})`;
  }
}

// actor-context-preprocess-query-source-reasoning
