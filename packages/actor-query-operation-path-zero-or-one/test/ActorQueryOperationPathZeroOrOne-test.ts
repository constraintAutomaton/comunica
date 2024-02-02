import type { Bindings } from '@comunica/bindings-factory';
import { BindingsFactory } from '@comunica/bindings-factory';
import { ActorQueryOperation } from '@comunica/bus-query-operation';
import { KeysQueryOperation } from '@comunica/context-entries';
import { Bus, ActionContext } from '@comunica/core';
import { MetadataValidationState } from '@comunica/metadata';
import type * as RDF from '@rdfjs/types';
import { ArrayIterator } from 'asynciterator';
import { DataFactory } from 'rdf-data-factory';
import { QUAD_TERM_NAMES } from 'rdf-terms';
import { Algebra, Factory } from 'sparqlalgebrajs';
import { ActorQueryOperationPathZeroOrOne } from '../lib/ActorQueryOperationPathZeroOrOne';
import '@comunica/jest';

const DF = new DataFactory();
const BF = new BindingsFactory();

describe('ActorQueryOperationPathZeroOrOne', () => {
  let bus: any;
  let mediatorQueryOperation: any;
  let mediatorMergeBindingsContext: any;
  const factory: Factory = new Factory();

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
    mediatorQueryOperation = {
      mediate(arg: any) {
        const vars: RDF.Variable[] = [];
        const distinct: boolean = arg.operation.type === 'distinct';

        for (const name of QUAD_TERM_NAMES) {
          if (arg.operation.input && (arg.operation.input[name].termType === 'Variable' ||
          arg.operation.input[name].termType === 'BlankNode')) {
            vars.push(arg.operation.input[name]);
          } else if (arg.operation[name] && (arg.operation[name].termType === 'Variable' ||
          arg.operation[name].termType === 'BlankNode')) {
            vars.push(arg.operation[name]);
          }
        }

        const bindings: Bindings[] = [];
        if (vars.length > 0) {
          for (let i = 0; i < 3; ++i) {
            const bind: [RDF.Variable, RDF.Term][] = [];
            for (const [ j, element ] of vars.entries()) {
              bind.push([ element, DF.namedNode(`${1 + i + j}`) ]);
            }
            bindings.push(BF.bindings(bind));
          }
        } else {
          bindings.push(BF.bindings());
        }

        return Promise.resolve({
          bindingsStream: new ArrayIterator(distinct ? [ bindings[0] ] : bindings),
          metadata: () => Promise.resolve({
            state: new MetadataValidationState(),
            cardinality: { type: 'estimate', value: distinct ? 1 : 3 },
            canContainUndefs: false,
            variables: vars,
          }),
          operated: arg,
          type: 'bindings',
        });
      },
    };
    // Mediator with no actors attached to it
    mediatorMergeBindingsContext = {
      mediate(arg: any) {
        return {};
      },
    };
  });

  describe('The ActorQueryOperationPathZeroOrOne module', () => {
    it('should be a function', () => {
      expect(ActorQueryOperationPathZeroOrOne).toBeInstanceOf(Function);
    });

    it('should be a ActorQueryOperationPathZeroOrOne constructor', () => {
      expect(new (<any> ActorQueryOperationPathZeroOrOne)({ name: 'actor', bus, mediatorQueryOperation }))
        .toBeInstanceOf(ActorQueryOperationPathZeroOrOne);
      expect(new (<any> ActorQueryOperationPathZeroOrOne)({ name: 'actor', bus, mediatorQueryOperation }))
        .toBeInstanceOf(ActorQueryOperation);
    });

    it('should not be able to create new ActorQueryOperationPathZeroOrOne objects without \'new\'', () => {
      expect(() => { (<any> ActorQueryOperationPathZeroOrOne)(); }).toThrow();
    });
  });

  describe('An ActorQueryOperationPathZeroOrOne instance', () => {
    let actor: ActorQueryOperationPathZeroOrOne;

    beforeEach(() => {
      actor = new ActorQueryOperationPathZeroOrOne({ name: 'actor',
        bus,
        mediatorQueryOperation,
        mediatorMergeBindingsContext });
    });

    it('should test on ZeroOrOne paths', () => {
      const op: any = { context: new ActionContext(),
        operation: { type: Algebra.types.PATH, predicate: { type: Algebra.types.ZERO_OR_ONE_PATH }}};
      return expect(actor.test(op)).resolves.toBeTruthy();
    });

    it('should test on different paths', () => {
      const op: any = { context: new ActionContext(),
        operation: { type: Algebra.types.PATH, predicate: { type: 'dummy' }}};
      return expect(actor.test(op)).rejects.toBeTruthy();
    });

    it('should mediate with distinct if not in context', async() => {
      const op: any = { operation: factory.createPath(
        DF.namedNode('s'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.variable('x'),
      ),
      context: new ActionContext() };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 1 },
        canContainUndefs: false,
        variables: [ DF.variable('x') ],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings([[ DF.variable('x'), DF.namedNode('1') ]]),
      ]);
    });

    it('should mediate with distinct if false in context', async() => {
      const op: any = { operation: factory.createPath(
        DF.namedNode('s'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.variable('x'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: false }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 1 },
        canContainUndefs: false,
        variables: [ DF.variable('x') ],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings([[ DF.variable('x'), DF.namedNode('1') ]]),
      ]);
    });

    it('should support ZeroOrOne paths (:s :p? ?o)', async() => {
      const op: any = { operation: factory.createPath(
        DF.namedNode('s'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.variable('x'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: true }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 3 },
        canContainUndefs: false,
        variables: [ DF.variable('x') ],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings([[ DF.variable('x'), DF.namedNode('s') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('1') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('2') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('3') ]]),
      ]);
    });

    it('should support ZeroOrOne paths (?s :p? :o)', async() => {
      const op: any = { operation: factory.createPath(
        DF.variable('x'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.namedNode('o'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: true }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 3 },
        canContainUndefs: false,
        variables: [ DF.variable('x') ],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings([[ DF.variable('x'), DF.namedNode('o') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('1') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('2') ]]),
        BF.bindings([[ DF.variable('x'), DF.namedNode('3') ]]),
      ]);
    });

    it('should support ZeroOrOne paths (:s :p? :o)', async() => {
      const op: any = { operation: factory.createPath(
        DF.namedNode('s'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.namedNode('1'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: true }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 3 },
        canContainUndefs: false,
        variables: [],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings(),
      ]);
    });

    it('should support ZeroOrOne paths (:s :p? :s)', async() => {
      const op: any = { operation: factory.createPath(
        DF.namedNode('s'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.namedNode('s'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: true }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'exact', value: 1 },
        canContainUndefs: false,
        variables: [],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings(),
      ]);
    });

    it('should support ZeroOrOne paths with 2 variables', async() => {
      const op: any = { operation: factory.createPath(
        DF.variable('x'),
        factory.createZeroOrOnePath(factory.createLink(DF.namedNode('p'))),
        DF.variable('y'),
      ),
      context: new ActionContext({ [KeysQueryOperation.isPathArbitraryLengthDistinctKey.name]: true }) };
      const output = ActorQueryOperation.getSafeBindings(await actor.run(op));
      expect(await output.metadata()).toEqual({
        state: expect.any(MetadataValidationState),
        cardinality: { type: 'estimate', value: 3 },
        canContainUndefs: false,
        variables: [ DF.variable('x'), DF.variable('y') ],
      });
      await expect(output.bindingsStream).toEqualBindingsStream([
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('1') ],
          [ DF.variable('y'), DF.namedNode('2') ],
        ]),
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('2') ],
          [ DF.variable('y'), DF.namedNode('3') ],
        ]),
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('3') ],
          [ DF.variable('y'), DF.namedNode('4') ],
        ]),
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('1') ],
          [ DF.variable('y'), DF.namedNode('3') ],
        ]),
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('2') ],
          [ DF.variable('y'), DF.namedNode('4') ],
        ]),
        BF.bindings([
          [ DF.variable('x'), DF.namedNode('3') ],
          [ DF.variable('y'), DF.namedNode('5') ],
        ]),
      ]);
    });
  });
});
