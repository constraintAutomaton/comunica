import { BindingsFactory } from '@comunica/bindings-factory';
import type { MediatorHttp } from '@comunica/bus-http';
import type { IQuadSource } from '@comunica/bus-rdf-resolve-quad-pattern';
import type { Bindings, BindingsStream, IActionContext } from '@comunica/types';
import * as RDF from '@rdfjs/types';
import type { AsyncIterator } from 'asynciterator';
import { wrap } from 'asynciterator';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import LRU = require('lru-cache');
import { DataFactory } from 'rdf-data-factory';
import { getTerms, getVariables, mapTerms } from 'rdf-terms';
import type { Algebra } from 'sparqlalgebrajs';
import { Factory, toSparql } from 'sparqlalgebrajs';

const DF = new DataFactory();
const BF = new BindingsFactory();
const VAR_COUNT = DF.variable('count');
const HEURISTIC_REDUCTION_VALUE = -1;
let nTotal = 0;
let nCache = 0;
let nInfered = 0;

export class RdfSourceSparql implements IQuadSource {
  protected static readonly FACTORY: Factory = new Factory();

  private readonly url: string;
  private readonly context: IActionContext;
  private readonly mediatorHttp: MediatorHttp;

  private readonly endpointFetcher: SparqlEndpointFetcher;
  private readonly cache: LRU<string, [RDF.QueryResultCardinality, RDF.Quad]> | undefined;

  public constructor(url: string, context: IActionContext, mediatorHttp: MediatorHttp, forceHttpGet: boolean,
    cacheSize: number) {
    this.url = url;
    this.context = context;
    this.mediatorHttp = mediatorHttp;
    this.endpointFetcher = new SparqlEndpointFetcher({
      method: forceHttpGet ? 'GET' : 'POST',
      fetch: (input: Request | string, init?: RequestInit) => this.mediatorHttp.mediate(
        { input, init, context: this.context },
      ),
      prefixVariableQuestionMark: true,
    });
    this.cache = cacheSize > 0 ?
      new LRU<string, [RDF.QueryResultCardinality, RDF.Quad]>({ max: cacheSize }) :
      undefined;
  }

  /**
   * Replace all blank nodes in a pattern with variables.
   * If the pattern contains no blank nodes the original pattern gets returned.
   * @param {RDF.BaseQuad} pattern A quad pattern.
   * @return {RDF.BaseQuad} A quad pattern with no blank nodes.
   */
  public static replaceBlankNodes(pattern: RDF.BaseQuad): RDF.BaseQuad {
    const variableNames: string[] = getVariables(getTerms(pattern)).map(variableTerm => variableTerm.value);
    // Track the names the blank nodes get mapped to (required if the name has to change)
    const blankMap: Record<string, string> = {};
    let changed = false;

    // For every position, convert to a variable if there is a blank node
    const result = mapTerms(pattern, term => {
      if (term.termType === 'BlankNode') {
        let name = term.value;
        if (blankMap[name]) {
          name = blankMap[name];
        } else {
          if (variableNames.includes(name)) {
            // Increase index added to name until we find one that is available (2 loops at most)
            let idx = 0;
            while (variableNames.includes(`${name}${idx}`)) {
              ++idx;
            }
            name += idx;
          }
          blankMap[term.value] = name;
          variableNames.push(name);
        }
        changed = true;
        return DF.variable(name);
      }
      return term;
    });

    return changed ? result : pattern;
  }

  /**
   * Convert a quad pattern to a BGP with only that pattern.
   * @param {RDF.pattern} quad A quad pattern.
   * @return {Bgp} A BGP.
   */
  public static patternToBgp(pattern: RDF.BaseQuad): Algebra.Bgp {
    return RdfSourceSparql.FACTORY.createBgp([RdfSourceSparql.FACTORY
      .createPattern(pattern.subject, pattern.predicate, pattern.object, pattern.graph)]);
  }

  /**
   * Convert a quad pattern to a select query for this pattern.
   * @param {RDF.Quad} pattern A quad pattern.
   * @return {string} A select query string.
   */
  public static patternToSelectQuery(pattern: RDF.BaseQuad): string {
    const variables: RDF.Variable[] = getVariables(getTerms(pattern));
    return toSparql(RdfSourceSparql.FACTORY.createProject(
      RdfSourceSparql.patternToBgp(pattern),
      variables,
    ));
  }

  /**
   * Convert a quad pattern to a count query for the number of matching triples for this pattern.
   * @param {RDF.Quad} pattern A quad pattern.
   * @return {string} A count query string.
   */
  public static patternToCountQuery(pattern: RDF.BaseQuad): string {
    return toSparql(RdfSourceSparql.FACTORY.createProject(
      RdfSourceSparql.FACTORY.createExtend(
        RdfSourceSparql.FACTORY.createGroup(
          RdfSourceSparql.patternToBgp(pattern),
          [],
          [RdfSourceSparql.FACTORY.createBoundAggregate(
            DF.variable('var0'),
            'count',
            RdfSourceSparql.FACTORY.createWildcardExpression(),
            false,
          )],
        ),
        DF.variable('count'),
        RdfSourceSparql.FACTORY.createTermExpression(DF.variable('var0')),
      ),
      [DF.variable('count')],
    ));
  }
  private cardinalityInference(currentQuad: RDF.Quad): RDF.QueryResultCardinality | undefined {
    if (this.cache) {
      //console.log(`cache has size ${this.cache.size}`)
      for (const [query, [cardinality, quad]] of this.cache.entries()) {
        // we check if the current quad is more precise
        if (RdfSourceSparql.isSubPatternOf(currentQuad, quad)) {
          console.log(`There is a subpartern`);
          //console.log(`Cache Quad ${quad.subject.value} - ${quad.predicate.value} - ${quad.object.value}\nCurrent Quad ${currentQuad.subject.value} - ${currentQuad.predicate.value} - ${currentQuad.object.value}
          //`);

          return {
            type: 'estimate',
            value: cardinality.value - HEURISTIC_REDUCTION_VALUE
          }
        }

      }
    }
    console.log(`There is a NOT a subpartern`);
    return undefined;
  }

  /**
     * Checks if the given (child) pattern is a more bound version of the given (parent) pattern.
     * This will also return true if the patterns are equal.
     * @param {RDF.BaseQuad} child A child pattern.
     * @param {RDF.BaseQuad} parent A parent pattern.
     * @return {boolean} If child is a sub-pattern of parent
     */
  public static isSubPatternOf(child: RDF.BaseQuad, parent: RDF.BaseQuad): boolean {
    return (!RdfSourceSparql.isTermBound(parent.subject) || parent.subject.equals(child.subject)) &&
      (!RdfSourceSparql.isTermBound(parent.predicate) || parent.predicate.equals(child.predicate)) &&
      (!RdfSourceSparql.isTermBound(parent.object) || parent.object.equals(child.object)) &&
      (!RdfSourceSparql.isTermBound(parent.graph) || parent.graph.equals(child.graph));
  }

  /**
   * Check if the given RDF term is not bound to an exact value.
   * I.e., if it is not a Variable.
   * @param {RDF.Term} term An RDF term.
   * @return {boolean} If it is not bound.
   */
  public static isTermBound(term: RDF.Term): boolean {
    return term.termType !== 'Variable';
  }

  /**
   * Send a SPARQL query to a SPARQL endpoint and retrieve its bindings as a stream.
   * @param {string} endpoint A SPARQL endpoint URL.
   * @param {string} query A SPARQL query string.
   * @return {BindingsStream} A stream of bindings.
   */
  public queryBindings(endpoint: string, query: string): BindingsStream {
    const rawStream = this.endpointFetcher.fetchBindings(endpoint, query);
    return wrap<any>(rawStream, { autoStart: false, maxBufferSize: Number.POSITIVE_INFINITY })
      .map((rawData: Record<string, RDF.Term>) => BF.bindings(Object.entries(rawData)
        .map(([key, value]) => [DF.variable(key.slice(1)), value])));
  }

  public match(subject: RDF.Term, predicate: RDF.Term, object: RDF.Term, graph: RDF.Term): AsyncIterator<RDF.Quad> {
    const pattern = RdfSourceSparql.replaceBlankNodes(RdfSourceSparql.FACTORY.createPattern(
      subject,
      predicate,
      object,
      graph,
    ));
    const countQuery: string = RdfSourceSparql.patternToCountQuery(pattern);
    const selectQuery: string = RdfSourceSparql.patternToSelectQuery(pattern);
    nTotal += 1;
    const inference = undefined;
    
    /**this.cardinalityInference(DF.quad(
      <RDF.NamedNode>subject,
      <RDF.NamedNode>predicate,
      <RDF.NamedNode>object,
    ));*/
    const printStat = () => {
      console.log(`${nCache} cached query; ${nInfered} infered cardinality; ${nTotal} total number of cardinality request => ${((nInfered + nCache) / nTotal) * 100} ration cardinality without count.`);
    };

    // Emit metadata containing the estimated count (reject is never called)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    new Promise<RDF.QueryResultCardinality>(resolve => {
      const cachedCardinality = this.cache?.get(countQuery);
      if (cachedCardinality !== undefined) {
        nCache += 1;
        printStat();
        return resolve(cachedCardinality[0]);
      } else if (inference) {
        nInfered += 1;
        printStat();
        return resolve(inference);
      }
      printStat();



      const bindingsStream: BindingsStream = this.queryBindings(this.url, countQuery);
      bindingsStream.on('data', (bindings: Bindings) => {
        const count = bindings.get(VAR_COUNT);
        const cardinality: RDF.QueryResultCardinality = { type: 'estimate', value: Number.POSITIVE_INFINITY };
        if (count) {
          const cardinalityValue: number = Number.parseInt(count.value, 10);
          if (!Number.isNaN(cardinalityValue)) {
            cardinality.type = 'exact';
            cardinality.value = cardinalityValue;
            this.cache?.set(countQuery, [cardinality, DF.quad(
              <RDF.NamedNode>subject,
              <RDF.NamedNode>predicate,
              <RDF.NamedNode>object,
            )]);
          }
        }
        return resolve(cardinality);
      });
      bindingsStream.on('error', () => resolve({ type: 'estimate', value: Number.POSITIVE_INFINITY }));
      bindingsStream.on('end', () => resolve({ type: 'estimate', value: Number.POSITIVE_INFINITY }));
    })
      .then(cardinality => quads.setProperty('metadata', { cardinality, canContainUndefs: true }));

    // Materialize the queried pattern using each found binding.
    const quads: AsyncIterator<RDF.Quad> & RDF.Stream = this.queryBindings(this.url, selectQuery)
      .map((bindings: Bindings) => <RDF.Quad>mapTerms(pattern, (value: RDF.Term) => {
        if (value.termType === 'Variable') {
          const boundValue = bindings.get(value);
          if (!boundValue) {
            quads.destroy(new Error(`The endpoint ${this.url} failed to provide a binding for ${value.value}.`));
          }
          return boundValue!;
        }
        return value;
      }));

    return quads;
  }
}
