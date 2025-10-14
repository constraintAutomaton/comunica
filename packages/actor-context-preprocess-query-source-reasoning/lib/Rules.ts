import { QuerySourceReference } from '@comunica/types';
import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';

const DF = new DataFactory();

export abstract class Rule {
  public readonly premise: Premise;
  public readonly operator: Operator;
  public readonly conclusion: Conclusion;

  public constructor(premise: Premise, conclusion: Conclusion) {
    this.premise = premise;
    this.conclusion = conclusion;
  }

  public toString(): string {
    return `${this.premise.value}-${this.operator}-${this.conclusion.value}`;
  }

  abstract forwardChaining(quad: RDF.Quad): RDF.Quad | undefined;
}

export class SameAsRule extends Rule {
  public override readonly operator: Operator = Operator.SAME_AS;

  public forwardChaining(quad: RDF.Quad): RDF.Quad | undefined {
    if (quad.subject.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(this.conclusion, quad.predicate, quad.object, quad.graph);
    }

    if (quad.predicate.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(quad.subject, this.conclusion, quad.object, quad.graph);
    }

    if (quad.object.equals(this.premise)) {
      return DF.quad(quad.subject, quad.predicate, this.conclusion, quad.graph);
    }

    if (quad.graph.equals(this.premise) && this.conclusion.termType !== 'Literal') {
      return DF.quad(quad.subject, quad.predicate, quad.object, this.conclusion);
    }

    return undefined;
  }
}

export class EquivalentClass extends SameAsRule{
  public override readonly operator: Operator = Operator.EQUIVALENT_CLASS;
}

export class EquivalentPropery extends SameAsRule{
  public override readonly operator: Operator = Operator.EQUIVALENT_PROPERTY;
}

export class SubClassOf extends SameAsRule{
  public override readonly operator: Operator = Operator.SUB_CLASS_OF;
}

export class SubPropertyOf extends SameAsRule{
  public override readonly operator: Operator = Operator.SUB_PROPERTY_OF;
}

export class RelatedMatch extends SameAsRule{
    public override readonly operator: Operator = Operator.RELATED_MATCH;
}

export class CloseMatch extends SameAsRule{
    public override readonly operator: Operator = Operator.CLOSE_MATCH;
}

export class ExactMatch extends SameAsRule{
    public override readonly operator: Operator = Operator.EXACT_MATCH;
}

export class NarrowMatch extends SameAsRule{
    public override readonly operator: Operator = Operator.NARROW_MATCH;
}

export class BroadMatch extends SameAsRule{
  public override readonly operator: Operator = Operator.BROAD_MATCH;
}

export type Premise = RDF.NamedNode | RDF.Literal;
export type Conclusion = RDF.NamedNode | RDF.Literal;
export enum Operator {
  SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs',
  EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass',
  EQUIVALENT_PROPERTY = 'http://www.w3.org/2002/07/owl#equivalentProperty',
  SUB_CLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  SUB_PROPERTY_OF = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
  RELATED_MATCH = 'http://www.w3.org/2004/02/skos/core#relatedMatch',
  CLOSE_MATCH = 'http://www.w3.org/2004/02/skos/core#closeMatch',
  EXACT_MATCH = 'http://www.w3.org/2004/02/skos/core#exactMatch',
  NARROW_MATCH = 'http://www.w3.org/2004/02/skos/core#narrowMatch',
  BROAD_MATCH = 'http://www.w3.org/2004/02/skos/core#broadMatch'
}

const RULE_OPERATOR: Map<Operator,new (...args: any[]) => Rule> = new Map([
  [Operator.SAME_AS, SameAsRule],
  [Operator.EQUIVALENT_CLASS, EquivalentClass],
  [Operator.EQUIVALENT_PROPERTY, EquivalentPropery],
  [Operator.SUB_CLASS_OF, SubClassOf],
  [Operator.SUB_PROPERTY_OF, SubPropertyOf],
  [Operator.RELATED_MATCH, RelatedMatch],
  [Operator.CLOSE_MATCH, CloseMatch],
  [Operator.EXACT_MATCH, ExactMatch],
  [Operator.NARROW_MATCH, NarrowMatch],
]);

export interface IRuleGraph {
  rules: Rule[];
}

export type ReasoningQuerySourceMap = Map<QuerySourceReference, boolean>;

export type ScopedRules = Map<QuerySourceReference, RDF.BaseQuad[]>;

export function parseRules(quads: RDF.BaseQuad[]): IRuleGraph {
  const ruleGraph: IRuleGraph = {
    rules: [],
  };

  for (const quad of quads) {
    const RuleClass = RULE_OPERATOR.get(quad.predicate.value as Operator);
    if ( RuleClass &&
      (quad.object.termType === 'Literal' || quad.object.termType === 'NamedNode') &&
      (quad.subject.termType === 'NamedNode')
    ) {
      const rule: Rule = new RuleClass(
        quad.subject,
        quad.object,
      );
      ruleGraph.rules.push(rule);
    }
  }

  return ruleGraph;
}
