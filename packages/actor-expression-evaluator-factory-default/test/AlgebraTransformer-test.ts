import {
  ActorFunctionFactoryExpressionBnode,
} from '@comunica/actor-function-factory-expression-bnode';
import {
  ActorFunctionFactoryExpressionCoalesce,
} from '@comunica/actor-function-factory-expression-coalesce';
import { ActorFunctionFactoryExpressionIf } from '@comunica/actor-function-factory-expression-if';
import { ActorFunctionFactoryTermNot } from '@comunica/actor-function-factory-term-not';
import { ActorFunctionFactoryTermUnaryMinus } from '@comunica/actor-function-factory-term-unary-minus';
import { createFuncMediator } from '@comunica/bus-function-factory/test/util';
import * as Eval from '@comunica/utils-expression-evaluator';
import { getMockEEActionContext } from '@comunica/utils-expression-evaluator/test/util/helpers';
import { DataFactory } from 'rdf-data-factory';
import { expressionTypes, types } from 'sparqlalgebrajs/lib/algebra';
import { Wildcard } from 'sparqljs';
import { AlgebraTransformer } from '../lib/AlgebraTransformer';

const DF = new DataFactory();

describe('AlgebraTransformer', () => {
  let algebraTransformer: AlgebraTransformer;
  beforeEach(() => {
    algebraTransformer = new AlgebraTransformer(
      // This basically requires the function bus.
      Eval.prepareEvaluatorActionContext(getMockEEActionContext()),
      createFuncMediator([
        args => new ActorFunctionFactoryExpressionBnode(args),
        args => new ActorFunctionFactoryExpressionIf(args),
        args => new ActorFunctionFactoryExpressionCoalesce(args),
        args => new ActorFunctionFactoryTermUnaryMinus(args),
        args => new ActorFunctionFactoryTermNot(args),
      ], {}),
    );
  });

  it('transform term', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.TERM,
      term: DF.namedNode('http://example.com'),
    })).resolves.toEqual(new Eval.NamedNode('http://example.com'));

    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.TERM,
      term: DF.blankNode('foo'),
    })).resolves.toEqual(new Eval.BlankNode('foo'));

    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.TERM,
      term: DF.literal('foo'),
    })).resolves.toEqual(new Eval.StringLiteral('foo'));

    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.TERM,
      term: DF.variable('foo'),
    })).resolves.toEqual(new Eval.Variable('?foo'));
  });

  it('transform special operator upper case', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'BNODE',
      args: [],
    })).resolves.toBeInstanceOf(Eval.Operator);
  });

  it('transform special operator lower case', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'bnode',
      args: [],
    })).resolves.toBeInstanceOf(Eval.Operator);
  });

  it('transform special operator bad arity', async() => {
    await expect(() => algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'if',
      args: [],
    })).rejects.toThrow(Eval.InvalidArity);
  });

  it('transform special operator infinite arity', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'coalesce',
      args: [],
    })).resolves.toBeInstanceOf(Eval.Operator);
  });

  it('transform regular operator lower case', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'uminus',
      args: [{
        type: types.EXPRESSION,
        expressionType: expressionTypes.TERM,
        term: DF.literal(''),
      }],
    })).resolves.toBeInstanceOf(Eval.Operator);
  });

  it('transform regular operator upper case', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'UMINUS',
      args: [{
        type: types.EXPRESSION,
        expressionType: expressionTypes.TERM,
        term: DF.literal(''),
      }],
    })).resolves.toBeInstanceOf(Eval.Operator);
  });

  it('transform regular operator bad arity', async() => {
    await expect(() => algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: '!',
      args: [],
    })).rejects.toThrow(Eval.InvalidArity);
  });

  it('transform not existing operator bad arity', async() => {
    await expect(() => algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.OPERATOR,
      operator: 'foo',
      args: [],
    })).rejects.toThrow('No actors are able to reply to a message in the bus test-bus-function-factory');
  });

  it('transform existence', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.EXISTENCE,
      not: false,
      input: {
        type: types.VALUES,
        variables: [],
        bindings: [],
      },
    })).resolves.toEqual(new Eval.Existence({
      type: types.EXPRESSION,
      expressionType: expressionTypes.EXISTENCE,
      not: false,
      input: {
        type: types.VALUES,
        variables: [],
        bindings: [],
      },
    }));
  });

  it('transform aggregate', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.AGGREGATE,
      aggregator: 'count',
      distinct: false,
      expression: {
        type: types.EXPRESSION,
        expressionType: expressionTypes.TERM,
        term: DF.variable('a'),
      },
    })).resolves.toEqual(new Eval.Aggregate('count', {
      type: types.EXPRESSION,
      expressionType: expressionTypes.AGGREGATE,
      aggregator: 'count',
      distinct: false,
      expression: {
        type: types.EXPRESSION,
        expressionType: expressionTypes.TERM,
        term: DF.variable('a'),
      },
    }));
  });

  it('transform wildcard', async() => {
    await expect(algebraTransformer.transformAlgebra({
      type: types.EXPRESSION,
      expressionType: expressionTypes.WILDCARD,
      wildcard: new Wildcard(),
    })).resolves.toEqual(new Eval.NamedNode('*'));
  });
});
