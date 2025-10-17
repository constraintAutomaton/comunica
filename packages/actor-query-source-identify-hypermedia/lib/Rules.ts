import { ActionContextKey } from "@comunica/core";
import { QuerySourceReference } from "@comunica/types";
import type * as RDF from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";

const UriTemplate = require('uri-template-lite');
const DF = new DataFactory();

export const KeyReasoning = {
  /**
   * The rules to apply with their data source domain in the form of a URI template or of an RDF source.
   */
  rules: new ActionContextKey<ScopedRules>('@comunica/actor-context-preprocess-query-source-reasoning:rules'),
  disallowedOnlineRules: new ActionContextKey<Operator[]>('@comunica/actor-context-preprocess-query-source-reasoning:disallowedOnlineRules'),
  /**
   * The query source reasoning by the scope of the rule set
   */
  querySources: new ActionContextKey<ReasoningQuerySourceMap>('@comunica/actor-context-preprocess-query-source-reasoning:querySources'),

};


export function selectCorrespondingRuleSet(
  rules: ScopedRules,
  referenceValue: QuerySourceReference
): IRuleGraph {
  const ruleForAll: IRuleGraph =
    rules.get("*") === undefined ? { rules: [] } : parseRules(rules.get("*")!);

  if (typeof referenceValue === "string") {
    const correspondingRules: IRuleGraph = ruleForAll;

    for (const [domain, ruleSet] of rules) {
      if (typeof domain === "string") {
        const template = new UriTemplate(domain);
        if (template.match(referenceValue) !== null) {
          const ruleGraph = parseRules(ruleSet);
          correspondingRules.rules = [
            ...correspondingRules.rules,
            ...ruleGraph.rules,
          ];
        }
      }
    }
    return correspondingRules;
  } else {
    const rawRules = rules.get(referenceValue);
    if (rawRules !== undefined) {
      const localStoreRule: IRuleGraph = {
        rules: (ruleForAll.rules = [
          ...ruleForAll.rules,
          ...parseRules(rawRules).rules,
        ]),
      };
      return localStoreRule;
    }
    return ruleForAll;
  }
}

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
    if (
      quad.subject.equals(this.premise) &&
      this.conclusion.termType !== "Literal"
    ) {
      return DF.quad(this.conclusion, quad.predicate, quad.object, quad.graph);
    }

    if (
      quad.predicate.equals(this.premise) &&
      this.conclusion.termType !== "Literal"
    ) {
      return DF.quad(quad.subject, this.conclusion, quad.object, quad.graph);
    }

    if (quad.object.equals(this.premise)) {
      return DF.quad(quad.subject, quad.predicate, this.conclusion, quad.graph);
    }

    if (
      quad.graph.equals(this.premise) &&
      this.conclusion.termType !== "Literal"
    ) {
      return DF.quad(
        quad.subject,
        quad.predicate,
        quad.object,
        this.conclusion
      );
    }

    return undefined;
  }
}

export class EquivalentClass extends SameAsRule {
  public override readonly operator: Operator = Operator.EQUIVALENT_CLASS;
}

export class EquivalentPropery extends SameAsRule {
  public override readonly operator: Operator = Operator.EQUIVALENT_PROPERTY;
}

export class SubClassOf extends SameAsRule {
  public override readonly operator: Operator = Operator.SUB_CLASS_OF;
}

export class SubPropertyOf extends SameAsRule {
  public override readonly operator: Operator = Operator.SUB_PROPERTY_OF;
}

export class RelatedMatch extends SameAsRule {
  public override readonly operator: Operator = Operator.RELATED_MATCH;
}

export class CloseMatch extends SameAsRule {
  public override readonly operator: Operator = Operator.CLOSE_MATCH;
}

export class ExactMatch extends SameAsRule {
  public override readonly operator: Operator = Operator.EXACT_MATCH;
}

export class NarrowMatch extends SameAsRule {
  public override readonly operator: Operator = Operator.NARROW_MATCH;
}

export class BroadMatch extends SameAsRule {
  public override readonly operator: Operator = Operator.BROAD_MATCH;
}

export type Premise = RDF.NamedNode | RDF.Literal;
export type Conclusion = RDF.NamedNode | RDF.Literal;
export enum Operator {
  SAME_AS = "http://www.w3.org/2002/07/owl#sameAs",
  EQUIVALENT_CLASS = "http://www.w3.org/2002/07/owl#equivalentClass",
  EQUIVALENT_PROPERTY = "http://www.w3.org/2002/07/owl#equivalentProperty",
  SUB_CLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  SUB_PROPERTY_OF = "http://www.w3.org/2000/01/rdf-schema#subPropertyOf",
  RELATED_MATCH = "http://www.w3.org/2004/02/skos/core#relatedMatch",
  CLOSE_MATCH = "http://www.w3.org/2004/02/skos/core#closeMatch",
  EXACT_MATCH = "http://www.w3.org/2004/02/skos/core#exactMatch",
  NARROW_MATCH = "http://www.w3.org/2004/02/skos/core#narrowMatch",
  BROAD_MATCH = "http://www.w3.org/2004/02/skos/core#broadMatch",
}

const RULE_OPERATOR: Map<Operator, new (...args: any[]) => Rule> = new Map([
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
    if (
      RuleClass &&
      (quad.object.termType === "Literal" ||
        quad.object.termType === "NamedNode") &&
      quad.subject.termType === "NamedNode"
    ) {
      const rule: Rule = new RuleClass(quad.subject, quad.object);
      ruleGraph.rules.push(rule);
    }
  }

  return ruleGraph;
}
