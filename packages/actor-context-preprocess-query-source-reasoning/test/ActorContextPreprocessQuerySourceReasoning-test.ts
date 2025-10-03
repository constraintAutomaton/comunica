
import { ActionContext, Bus } from '@comunica/core';
import { ActorContextPreprocessQuerySourceReasoning, IActorContextPreprocessQuerySourceReasoningArg } from '../lib/ActorContextPreprocessQuerySourceReasoning';
import '@comunica/utils-jest';
import { type ScopedRules } from '../lib/Rules';
import { KeyReasoning, KeysQueryOperation } from '@comunica/context-entries';

jest.mock('../lib/Rules', () => ({
    parseRules: jest.fn().mockImplementation((val) => { return { rules: [val] } }),
}));


describe('ActorContextPreprocessQuerySourceReasoning', () => {

    describe("test", () => {
        it("should always test", async () => {
            const bus: any = new Bus({ name: 'bus' });
            const mediatorMergeBindingsContext: any = jest.fn();
            const mediatorRdfMetadataAccumulate: any = jest.fn();

            const args: IActorContextPreprocessQuerySourceReasoningArg = {
                bus,
                name: "actor",
                mediatorRdfMetadataAccumulate,
                mediatorMergeBindingsContext
            };

            const actor = new ActorContextPreprocessQuerySourceReasoning(args);

            await expect(actor.test({ context: new ActionContext() })).resolves.toPassTestVoid();

        });
    });

    describe(ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet.name, () => {
        const allRules: any = "allRules";
        const ruleToAnIRi1: [any, any] = ["http:///www.iri1", "ruleToAnIRi1"];
        const ruleToAnIRi2: [any, any] = ["http:///www.iri2/{location}/here", "ruleToAnIRi2"];
        const ruleToASource1: [any, any] = [jest.fn(), "ruleToASource1"];
        const ruleToASource2: [any, any] = [jest.fn(), "ruleToASource2"];



        const scoppedRule: ScopedRules = new Map([
            ["*", allRules],
            ruleToAnIRi1,
            ruleToAnIRi2,
            ruleToASource1,
            ruleToASource2
        ]);

        it("should return all rules given the * rule given a reference value that is not included", () => {
            const expectedRule = [allRules];
            const rules = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(scoppedRule, "foo");

            expect(rules).toStrictEqual({ rules: expectedRule });
        });

        it("should return the rules with a fixed IRI", () => {
            const expectedRule = [allRules, ruleToAnIRi1[1]];
            const rules = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(scoppedRule, "http:///www.iri1");

            expect(rules).toStrictEqual({ rules: expectedRule });
        });

        it("should return the rules targeting an URI template", () => {
            const expectedRule = [allRules, ruleToAnIRi2[1]];
            const rules = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(scoppedRule, "http:///www.iri2/somewhere/here");

            expect(rules).toStrictEqual({ rules: expectedRule });
        });

        it("should return the rules targetting an RDF source", () => {
            const expectedRule = [allRules, ruleToASource1[1]];
            const rules = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(scoppedRule, ruleToASource1[0]);

            expect(rules).toStrictEqual({ rules: expectedRule });
        });

        it("should return the rules targetting an RDF source that does not exist", () => {
            const expectedRule = [allRules];
            const rules = ActorContextPreprocessQuerySourceReasoning.selectCorrespondingRuleSet(scoppedRule, <any>jest.fn());

            expect(rules).toStrictEqual({ rules: expectedRule });
        });
    });

    describe("run", () => {
        let actor: ActorContextPreprocessQuerySourceReasoning = <any>{};

        beforeEach(() => {
            const bus: any = new Bus({ name: 'bus' });
            const mediatorMergeBindingsContext: any = jest.fn();
            const mediatorRdfMetadataAccumulate: any = jest.fn();

            const args: IActorContextPreprocessQuerySourceReasoningArg = {
                bus,
                name: "actor",
                mediatorRdfMetadataAccumulate,
                mediatorMergeBindingsContext
            };

            actor = new ActorContextPreprocessQuerySourceReasoning(args);
        });

        it("should not change the context given a context with no querySources keys", async ()=>{
            const context = new ActionContext({});
            const action = {
                context,
            }
            const resp = await actor.run(action);

            expect(resp.context).toStrictEqual(context);
        });

        it(`should throw given a context with no ${KeyReasoning.rules.name}`, async ()=>{
            const context = new ActionContext({
                [KeysQueryOperation.querySources.name]: []
            });
            const action = {
                context,
            }

            await expect(actor.run(action)).rejects.toThrow(new Error(`${KeyReasoning.rules.name} is not defined in the context`))
        });
    });
});

