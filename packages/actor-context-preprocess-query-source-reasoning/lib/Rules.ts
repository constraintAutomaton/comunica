import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';

const DF = new DataFactory();

export interface IRule {
  premise: Premise;
  operator: Operator;
  conclusion: Conclusion;
  forwardChaining: (quad: RDF.Quad) => RDF.Quad | undefined;
}

export class SameAsRule implements IRule {
  public readonly premise: Premise;
  public readonly operator: Operator = Operator.SAME_AS;
  public readonly conclusion: Conclusion;

  public constructor(premise: Premise, conclusion: Conclusion) {
    this.premise = premise;
    this.conclusion = conclusion;
  }

  public forwardChaining(quad: RDF.Quad): RDF.Quad | undefined {
    if (quad.subject.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(this.conclusion, quad.predicate, quad.object, quad.graph);
    }

    if (quad.predicate.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(quad.subject, this.conclusion, quad.object, quad.graph);
    }

    if (quad.object.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(quad.subject, quad.predicate, this.conclusion, quad.graph);
    }

    if (quad.graph.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(quad.subject, quad.predicate, quad.object, this.conclusion);
    }
  }
}

export type Premise = RDF.NamedNode | RDF.Literal;
export type Conclusion = RDF.NamedNode | RDF.Literal;
export enum Operator {
  SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs',
}

export interface IRuleGraph {
  rules: IRule[];
}

export type ScopedRules = Map<string | RDF.Source, RDF.Quad[]>;

export function parseRules(quads: RDF.Quad[]): IRuleGraph {
  const ruleGraph: IRuleGraph = {
    rules: [],
  };

  for (const quad of quads) {
    if (quad.predicate.value === Operator.SAME_AS &&
      (quad.object.termType === 'Literal' || quad.object.termType === 'NamedNode') &&
      (quad.subject.termType === 'NamedNode')
    ) {
      const rule: IRule = new SameAsRule(
        quad.subject,
        quad.object,
      );
      ruleGraph.rules.push(rule);
    }
  }

  return ruleGraph;
}
