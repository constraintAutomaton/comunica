import { IActionContext } from "@comunica/types";
import type * as RDF from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import type { MediatorDereferenceRdf } from "@comunica/bus-dereference-rdf";
import { error, isError, result, safePromise, SafePromise } from "result-interface";
import { Operator, KeyReasoning } from "./Rules";

export const DF = new DataFactory<RDF.BaseQuad>();

export class OnlineSchemaAligmentRuleManager {
  public readonly mediatorDereferenceRdf: MediatorDereferenceRdf;

  public readonly disallowedOnlineRules:Set<Operator>;
  public static readonly ERROR_MESSAGE_NO_RULE_SET =
    "there is no rule set in this resource";

  public static readonly RDF_TYPE_NODE = DF.namedNode(
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
  );
  public static readonly RULE_SET_PREFIX = "https://exemple.com#";
  public static readonly RULE_SET_CLASS = DF.namedNode(
    `${this.RULE_SET_PREFIX}RuleSet`
  );
  public static readonly RULE_SET_RULE = DF.namedNode(
    `${this.RULE_SET_PREFIX}rule`
  );
  public static readonly RULE_SET_LOCATOR_NODE = DF.namedNode(
    `${this.RULE_SET_PREFIX}ruleSetLocation`
  );
  public static readonly RULE_SET_PREMISE = DF.namedNode(
    `${this.RULE_SET_PREFIX}premise`
  );
  public static readonly RULE_SET_INFERENCE = DF.namedNode(
    `${this.RULE_SET_PREFIX}inference`
  );
  public static readonly RULE_SET_CONCLUSION = DF.namedNode(
    `${this.RULE_SET_PREFIX}conclusion`
  );
  public static readonly RULE_SET_SUBWEB = DF.namedNode(
    `${this.RULE_SET_PREFIX}subweb`
  );

  private readonly ruleSetHandled: Set<string> = new Set();

  public constructor(mediatorDereferenceRdf: MediatorDereferenceRdf, disallowedOnlineRules: Set<Operator>){
    this.mediatorDereferenceRdf = mediatorDereferenceRdf;
    this.disallowedOnlineRules = disallowedOnlineRules;
  }

  public test(context: IActionContext): boolean {
    if (context.has(KeyReasoning.rules)) {
      return true;
    }
    return false;
  }

  public async run(
    quads: RDF.Stream<RDF.Quad>,
    context:IActionContext
  ): Promise<void> {
    const respLinkLocation = await this.discoverRuleSetFromTriples(
      quads
    );
    if (isError(respLinkLocation)) {
      return;
    }
    const { value: ruleSetLocation } = respLinkLocation;

    if(this.ruleSetHandled.has(ruleSetLocation)){
      return;
    }
    const respParsedRules = await this.parseRuleSet(
      ruleSetLocation,
      context
    );
    if (isError(respParsedRules)) {
      return;
    }

    this.ruleSetHandled.add(ruleSetLocation);
    const { value: ruleSet } = respParsedRules;
    this.injectRule(ruleSet, context);

    return;
  }

  /**
   * Discover a set of rules resource in a knowledge graph
   * @param {RDF.Stream} metadata the streamed knowledge graph
   * @returns {SafePromise<string, string|Error>} - The IRI of the rule set resource
   */
  public async discoverRuleSetFromTriples(
    metadata: RDF.Stream
  ): SafePromise<string, string|Error> {
    return new Promise((resolve) => {
      let ruleSetLocation: string | undefined;
      metadata.on("data", (quad: RDF.Quad) => {
        if (
          quad.predicate.equals(OnlineSchemaAligmentRuleManager.RULE_SET_LOCATOR_NODE)
        ) {
          ruleSetLocation = quad.object.value;
        }
      });

      metadata.on("error", (err) => {
        resolve(error(err));
      });

      metadata.on("end", () => {
        if (ruleSetLocation === undefined) {
          resolve(error(OnlineSchemaAligmentRuleManager.ERROR_MESSAGE_NO_RULE_SET));
        } else {
          resolve(result(ruleSetLocation));
        }
      });
    });
  }

  public async parseRuleSet(
    ruleSetIri: string,
    context: IActionContext
  ): SafePromise<IRuleSet, string | Error> {
    return new Promise(async (resolve) => {
      const responseDeref = await safePromise(
        this.mediatorDereferenceRdf.mediate({ url: ruleSetIri, context })
      );
      if (isError(responseDeref)) {
        resolve(error(<Error>responseDeref.error));
        return;
      }

      const ruleSetInfo: IRuleSetInformation = {
        isRuleSet: false,
        rules: new Map(),
        ruleDeclared: new Set()
      };
      const {
        value: { data: metadata },
      } = responseDeref;

      metadata.on("data", (quad: RDF.Quad) => {
        this.processRuleQuad(quad, ruleSetIri, ruleSetInfo);
      });

      metadata.on("error", (err) => {
        resolve(error(err));
      });

      metadata.on("end", () => {
        if (!ruleSetInfo.isRuleSet) {
           resolve(error("the rule set did not have the correct RDF type"));
           return;
        }
        if (ruleSetInfo.subweb === undefined) {
          resolve(error("no subweb was defined to this rule set"));
          return;
        }

        if(ruleSetInfo.rules.size !== ruleSetInfo.ruleDeclared.size){
          resolve(error(`${ruleSetInfo.rules.size} rule(s) was defined whereas ${ruleSetInfo.ruleDeclared.size} rule(s) was declared`))
          return;
        }

        const rules: IRule[] = [];
        for (const [key, rule] of ruleSetInfo.rules) {
          if(!ruleSetInfo.ruleDeclared.has(key)){
            resolve(error(`the rule ${key} was not declared`));
            return;
          }

          if (!rule.premise) {
             resolve(error(`the premise of ${key} was not defined`));
             return;
          }

          if (!rule.inference) {
            resolve(error(`the inference of ${key} was not defined`));
            return;
          }

          if (!rule.conclusion) {
            resolve(error(`the conclusion of ${key} was not defined`));
            return;
          }
          // because of the partial object we have to cast or create a type guard
          rules.push(<IRule>rule);
        }
        resolve(
          result({
            subweb: ruleSetInfo.subweb,
            rules,
          })
        );
      });
    });
  }

  private processRuleQuad(
    quad: RDF.Quad,
    ruleSetIri: string,
    ruleSetInformation: IRuleSetInformation
  ): void {
    if (
      quad.subject.value === ruleSetIri &&
      OnlineSchemaAligmentRuleManager.RDF_TYPE_NODE.equals(quad.predicate) &&
      OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.equals(quad.object)
      
    ) {
      ruleSetInformation.isRuleSet = true;
    } else if (
      quad.subject.value === ruleSetIri &&
      OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.equals(quad.predicate)
    ) {
      ruleSetInformation.subweb = quad.object.value;
    } else if(
      quad.subject.value === ruleSetIri &&
      OnlineSchemaAligmentRuleManager.RULE_SET_RULE.equals(quad.predicate)
    ){
      ruleSetInformation.ruleDeclared.add(quad.object.value);
    } else if (
      OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.equals(quad.predicate) && quad
    ) {
      const rule = ruleSetInformation.rules.get(quad.subject.value);
      if (!rule) {
        ruleSetInformation.rules.set(quad.subject.value, {
          premise: quad.object,
        });
        return;
      }
      rule.premise = quad.object;
    } else if (
      OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.equals(quad.predicate)
    ) {
      const rule = ruleSetInformation.rules.get(quad.subject.value);
      if (!rule) {
        ruleSetInformation.rules.set(quad.subject.value, {
          inference: quad.object,
        });
        return;
      }
      rule.inference = quad.object;
    } else if (
      OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.equals(quad.predicate)
    ) {
      const rule = ruleSetInformation.rules.get(quad.subject.value);
      if (!rule) {
        ruleSetInformation.rules.set(quad.subject.value, {
          conclusion: quad.object,
        });
        return;
      }
      rule.conclusion = quad.object;
    }
  }

  public injectRule(ruleSet: IRuleSet, context: IActionContext):void {
    const engineRules = context.getSafe(KeyReasoning.rules);
    const rules: RDF.BaseQuad[] = [];
    for (const rule of ruleSet.rules) {
      const parsedRule: RDF.BaseQuad = DF.quad(
        rule.premise,
        rule.inference,
        rule.conclusion
      );
      if(!this.disallowedOnlineRules.has(<Operator>rule.inference.value)){
        rules.push(parsedRule);
      }
    }
    engineRules.set(ruleSet.subweb, rules);
  }
}

interface IRuleSetInformation {
  subweb?: string;
  ruleDeclared: Set<string>;
  rules: Map<string, Partial<IRule>>;
  isRuleSet: boolean;
}

export interface IRuleSet {
  subweb: string;
  rules: IRule[];
}

export interface IRule {
  premise: RDF.Term;
  inference: RDF.Term;
  conclusion: RDF.Term;
}