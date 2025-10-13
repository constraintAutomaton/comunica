import { ActionContext, Bus } from "@comunica/core";
import {
  OnlineSchemaAligmentRuleManager,
  DF,
  IRuleSet,
} from "../lib/OnlineSchemaAligmentRuleManager";
import "@comunica/utils-jest";
import { error, result } from "result-interface";
import { ArrayIterator, AsyncIterator } from "asynciterator";
import { rdfParser } from "rdf-parse";
import Streamify from "streamify-string";
import { KeyReasoning } from "@comunica/context-entries";

describe("OnlineSchemaAligmentRuleManager", () => {

  describe("test", () => {
    let actor: OnlineSchemaAligmentRuleManager;

    beforeEach(() => {
      actor = new OnlineSchemaAligmentRuleManager(<any>{});
    });

    it(`should not test given a context with no ${KeyReasoning.rules.name} key`, () => {
      expect(actor.test(new ActionContext())).toBe(false);
    });

    it(`should test given a context with a${KeyReasoning.rules.name} key`, () => {
      const context = new ActionContext({
          [KeyReasoning.rules.name]: new Map(),
        });
      expect(actor.test(context)).toBe(true);
    });
  });

  describe("discoverRuleSetFromTriples", () => {
    let actor: OnlineSchemaAligmentRuleManager;

    beforeEach(() => {
      actor = new OnlineSchemaAligmentRuleManager(<any>{});
    });

    it("should return an error given an stream error", async () => {
      const metadata: any = {
        on: (event: string, fn: Function) => {
          if (event === "error") {
            fn(new Error("expected"));
          }
        },
      };
      const resp = await actor.discoverRuleSetFromTriples(metadata);
      expect(resp).toEqual(error(new Error("expected")));
    });

    it("should return an error given a stream with no rule set IRI", async () => {
      const metadata: any = new ArrayIterator(
        [
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
          DF.quad(DF.blankNode(), DF.namedNode("aa"), DF.namedNode("k")),
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
        ],
        { autoStart: false }
      );

      const resp = await actor.discoverRuleSetFromTriples(metadata);
      expect(resp).toEqual(
        error(OnlineSchemaAligmentRuleManager.ERROR_MESSAGE_NO_RULE_SET)
      );
    });

    it("should return a result", async () => {
      const metadata: any = new ArrayIterator(
        [
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
          DF.quad(
            DF.namedNode("a"),
            OnlineSchemaAligmentRuleManager.RULE_SET_LOCATOR_NODE,
            DF.namedNode("r")
          ),
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
        ],
        { autoStart: false }
      );

      const resp = await actor.discoverRuleSetFromTriples(metadata);
      expect(resp).toEqual(result("r"));
    });
  });

  describe("parseRuleSet", () => {
    let actor: OnlineSchemaAligmentRuleManager;
    let mediatorDereferenceRdf = {
      mediate: jest.fn(),
    };
    const context = new ActionContext();

    beforeEach(() => {
      mediatorDereferenceRdf = {
        mediate: jest.fn(),
      };
      actor = new OnlineSchemaAligmentRuleManager(<any>mediatorDereferenceRdf);
    });

    it("should return an error given a mediatorDereferenceRdf error", async () => {
      mediatorDereferenceRdf.mediate.mockRejectedValueOnce(new Error("m"));
      const resp = await actor.parseRuleSet("r", context);

      expect(resp).toEqual(error(new Error("m")));
    });

    it("should return an error given a set of unrelated triples", async () => {
      const data = new ArrayIterator(
        [
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
          DF.quad(
            DF.namedNode("a"),
            OnlineSchemaAligmentRuleManager.RULE_SET_LOCATOR_NODE,
            DF.namedNode("r")
          ),
          DF.quad(DF.blankNode(), DF.blankNode(), DF.blankNode()),
        ],
        { autoStart: false }
      );

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("r", context);

      expect(resp).toEqual(
        error("the rule set did not have the correct RDF type")
      );
    });

    it("should return an error given a rule set with no subweb", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule1;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule2.
          
          _:rule1 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          _:rule2 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(error("no subweb was defined to this rule set"));
    });

    it("should return an error given a rule set where not every rules are declared", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule2.
          
          _:rule1 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          _:rule2 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(
        error("2 rule(s) was defined whereas 1 rule(s) was declared")
      );
    });

    it("should return an error given a rule set where inconsistent rules are defined", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule1;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule2.
          
          _:rule1 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          <rule3> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(error("the rule rule3 was not declared"));
    });

    it("should return an error given a rule set where a premise is missing ", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule2>.
          
          <rule1> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          <rule2> <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(error("the premise of rule2 was not defined"));
    });

    it("should return an error given a rule set where a inference is missing ", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule2>.
          
          <rule1> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          <rule2> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>; 
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(error("the inference of rule2 was not defined"));
    });

    it("should return an error given a rule set where a conclusion is missing ", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> <rule2>.
          
          <rule1> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          <rule2> <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>; 
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);

      expect(resp).toEqual(error("the conclusion of rule2 was not defined"));
    });

    it("should return the rule set", async () => {
      const string_triples = `
          <foo> a <${OnlineSchemaAligmentRuleManager.RULE_SET_CLASS.value}>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_SUBWEB.value}> "here!";
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule1;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_RULE.value}> _:rule2.
          
          _:rule1 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i1>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c1>.

          _:rule2 <${OnlineSchemaAligmentRuleManager.RULE_SET_PREMISE.value}> <p2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_INFERENCE.value}> <i2>;
            <${OnlineSchemaAligmentRuleManager.RULE_SET_CONCLUSION.value}> <c2>.
        `;
      const data = rdfParser.parse(Streamify(string_triples), {
        contentType: "text/turtle",
      });

      mediatorDereferenceRdf.mediate.mockResolvedValueOnce({
        data,
      });
      const resp = await actor.parseRuleSet("foo", context);
      expect((<any>resp).value.rules[0].premise).toEqual(DF.namedNode("p1"));
      expect(resp).toEqual(
        result({
          subweb: "here!",
          rules: [
            {
              premise: DF.namedNode("p1"),
              inference: DF.namedNode("i1"),
              conclusion: DF.namedNode("c1"),
            },
            {
              premise: DF.namedNode("p2"),
              inference: DF.namedNode("i2"),
              conclusion: DF.namedNode("c2"),
            },
          ],
        })
      );
    });
  });

  describe("injectRule", () => {
    let actor: OnlineSchemaAligmentRuleManager;

    beforeEach(() => {
      actor = new OnlineSchemaAligmentRuleManager(<any>{});
    });

    it("given a rule set it should insert it into the context", () => {
      const context = new ActionContext({
        [KeyReasoning.rules.name]: new Map(),
      });

      const ruleSet: IRuleSet = {
        subweb: "here",
        rules: [
          {
            premise: DF.namedNode("p1"),
            inference: DF.namedNode("i1"),
            conclusion: DF.namedNode("c1"),
          },
          {
            premise: DF.namedNode("p2"),
            inference: DF.namedNode("i2"),
            conclusion: DF.namedNode("c2"),
          },
        ],
      };

      const expectedRules = [
        DF.quad(DF.namedNode("p1"), DF.namedNode("i1"), DF.namedNode("c1")),
        DF.quad(DF.namedNode("p2"), DF.namedNode("i2"), DF.namedNode("c2")),
      ];

      actor.injectRule(ruleSet, context);

      expect(context.getSafe(KeyReasoning.rules)).toEqual(
        new Map([["here", expectedRules]])
      );
    });
  });

  describe("run", () => {
    let actor: OnlineSchemaAligmentRuleManager;
    let context = new ActionContext({
      [KeyReasoning.rules.name]: new Map(),
    });

    beforeEach(() => {
      context = new ActionContext({
        [KeyReasoning.rules.name]: new Map(),
      });
      actor = new OnlineSchemaAligmentRuleManager(<any>{});
    });

    it("should add no rules to the context given that the rule set was not discovered", async () => {
      actor.discoverRuleSetFromTriples = jest
        .fn()
        .mockResolvedValueOnce(error(""));
      const resp = await actor.run(new AsyncIterator(), context);

      expect(resp).toEqual({
        links: [],
      });

      expect(context.getSafe(KeyReasoning.rules)).toEqual(new Map());
    });

    it("should add no rules to the context given that the rule set was already handled", async () => {
      (<Set<string>>(<any>actor).ruleSetHandled).add("foo");
      actor.discoverRuleSetFromTriples = jest
        .fn()
        .mockResolvedValueOnce(result("foo"));
      const resp = await actor.run(new AsyncIterator(), context);

      expect(resp).toEqual({
        links: [],
      });

      expect(context.getSafe(KeyReasoning.rules)).toEqual(new Map());
    });

    it("should add no rules to the context given that the rule set is not parsable", async () => {
      actor.discoverRuleSetFromTriples = jest
        .fn()
        .mockResolvedValueOnce(result("foo"));
      actor.parseRuleSet = jest.fn().mockResolvedValueOnce(error(""));
      const resp = await actor.run(new AsyncIterator(), context);

      expect(resp).toEqual({
        links: [],
      });

      expect(context.getSafe(KeyReasoning.rules)).toEqual(new Map());
    });

    it("should add the remote rules", async () => {
      actor.discoverRuleSetFromTriples = jest
        .fn()
        .mockResolvedValueOnce(result("foo"));
      const ruleSet: IRuleSet = {
        subweb: "here",
        rules: [
          {
            premise: DF.namedNode("p1"),
            inference: DF.namedNode("i1"),
            conclusion: DF.namedNode("c1"),
          },
          {
            premise: DF.namedNode("p2"),
            inference: DF.namedNode("i2"),
            conclusion: DF.namedNode("c2"),
          },
        ],
      };

      actor.parseRuleSet = jest.fn().mockResolvedValueOnce(result(ruleSet));

      const expectedRules = [
        DF.quad(DF.namedNode("p1"), DF.namedNode("i1"), DF.namedNode("c1")),
        DF.quad(DF.namedNode("p2"), DF.namedNode("i2"), DF.namedNode("c2")),
      ];

      const resp = await actor.run(new AsyncIterator(), context);

      expect(resp).toEqual({
        links: [],
      });

      expect(context.getSafe(KeyReasoning.rules)).toEqual(
        new Map([["here", expectedRules]])
      );
    });
  });
});
