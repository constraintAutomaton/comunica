import { DataFactory } from "rdf-data-factory";
import { IRuleGraph, Operator, parseRules, SameAsRule } from "../lib";

const DF = new DataFactory();

describe("SameAsRule", () => {
    describe("constructor", () => {
        it("should construct with the right values", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            expect(rule.premise).toStrictEqual(premise);
            expect(rule.conclusion).toStrictEqual(conclusion);
            expect(rule.operator).toStrictEqual(Operator.SAME_AS);
        })

    });

    describe("toString", () => {
        it("should convert the rule into a string", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            expect(rule.toString()).toBe(`${premise.value}-${Operator.SAME_AS}-${conclusion.value}`)
        });
    });

    describe("forwardChaining", () => {
        it("should forward chain with a subject matching the premise", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("a"),
                DF.namedNode("p"),
                DF.namedNode("o")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            const expectedImplicitQuads = DF.quad(
                conclusion,
                aQuad.predicate,
                aQuad.object
            );
            expect(implicitQuad).toStrictEqual(expectedImplicitQuads);
        });

        it("should not forward chain with a subject matching the premise and the conclusion is a literal", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.literal("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("a"),
                DF.namedNode("p"),
                DF.namedNode("o")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            expect(implicitQuad).toStrictEqual(undefined);
        });

        it("should forward chain with a predicate matching the premise", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("s"),
                DF.namedNode("a"),
                DF.namedNode("o")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            const expectedImplicitQuads = DF.quad(
                aQuad.subject,
                conclusion,
                aQuad.object
            );
            expect(implicitQuad).toStrictEqual(expectedImplicitQuads);
        });

        it("should not forward chain with a predicate matching the premise and the conclusion is a literal", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.literal("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("s"),
                DF.namedNode("a"),
                DF.namedNode("o")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            expect(implicitQuad).toStrictEqual(undefined);
        });

        it("should forward chain with an object matching the premise", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("s"),
                DF.namedNode("p"),
                DF.namedNode("a")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            const expectedImplicitQuads = DF.quad(
                aQuad.subject,
                aQuad.predicate,
                conclusion
            );
            expect(implicitQuad).toStrictEqual(expectedImplicitQuads);
        });

        it("should forward chain with a graph matching the premise", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.namedNode("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("s"),
                DF.namedNode("p"),
                DF.namedNode("o"),
                DF.namedNode("a")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            const expectedImplicitQuads = DF.quad(
                aQuad.subject,
                aQuad.predicate,
                aQuad.object,
                conclusion
            );
            expect(implicitQuad).toStrictEqual(expectedImplicitQuads);
        });

        it("should not forward chain with a graph matching the premise but the conclusion is a literal", () => {
            const premise = DF.namedNode("a");
            const conclusion = DF.literal("b");

            const rule = new SameAsRule(premise, conclusion);

            const aQuad = DF.quad(
                DF.namedNode("s"),
                DF.namedNode("p"),
                DF.namedNode("o"),
                DF.namedNode("a")
            );

            const implicitQuad = rule.forwardChaining(aQuad);
            expect(implicitQuad).toStrictEqual(undefined);
        });
    });
});

describe("parseRules", () => {
    it("should have no rules given no quads", () => {
        expect(parseRules([])).toStrictEqual({ rules: [] })
    });

    it("should parse a rule", ()=>{
        const quads = [
            DF.quad(
                DF.namedNode("s"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o")
            )
        ];
        const expectedRule: IRuleGraph ={
            rules:[
                new SameAsRule(DF.namedNode("s"), DF.namedNode("o"))
            ]
        };
        
        const resp = parseRules(quads);

        expect(resp).toStrictEqual(expectedRule);
    });

    it("should parse multiple rules", ()=>{
        const quads = [
            DF.quad(
                DF.namedNode("s"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o")
            ),
            DF.quad(
                DF.namedNode("s1"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o1")
            ),
            DF.quad(
                DF.namedNode("s2"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o2")
            )
        ];
        const expectedRule: IRuleGraph ={
            rules:[
                new SameAsRule(DF.namedNode("s"), DF.namedNode("o")),
                new SameAsRule(DF.namedNode("s1"), DF.namedNode("o1")),
                new SameAsRule(DF.namedNode("s2"), DF.namedNode("o2"))
            ]
        };
        
        const resp = parseRules(quads);

        expect(resp).toStrictEqual(expectedRule);
    });

    it("should parse multiple rules with unrelated quads", ()=>{
        const quads = [
            DF.quad(
                DF.namedNode("s"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o")
            ),
            DF.quad(
                DF.namedNode("s"),
                DF.namedNode("a"),
                DF.namedNode("o")
            ),
            DF.quad(
                DF.namedNode("s2"),
                DF.namedNode("foo"),
                DF.namedNode("bar")
            ),
            DF.quad(
                DF.namedNode("s1"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o1")
            ),
            DF.quad(
                DF.namedNode("s2"),
                DF.namedNode(Operator.SAME_AS),
                DF.namedNode("o2")
            ),
            DF.quad(
                DF.namedNode("s2"),
                DF.namedNode("foo"),
                DF.namedNode("bar")
            ),
            DF.quad(
                DF.namedNode("s24"),
                DF.namedNode("foo12"),
                DF.namedNode("bar23")
            ),
        ];
        const expectedRule: IRuleGraph ={
            rules:[
                new SameAsRule(DF.namedNode("s"), DF.namedNode("o")),
                new SameAsRule(DF.namedNode("s1"), DF.namedNode("o1")),
                new SameAsRule(DF.namedNode("s2"), DF.namedNode("o2"))
            ]
        };
        
        const resp = parseRules(quads);

        expect(resp).toStrictEqual(expectedRule);
    });
});