import { IRuleGraph, SameAsRule } from "../lib";
import type * as RDF from '@rdfjs/types';
import { DataFactory } from "rdf-data-factory";
import { QuerySourceReasoning } from "../lib/QuerySourceReasoning";
import { AsyncIterator, fromArray } from "asynciterator";

const DF = new DataFactory();

describe('QuerySourceReasoning', () => {
    describe("chainReasoningOverAQuad", () => {
        const A_QUAD = DF.quad(
            DF.namedNode("s"),
            DF.namedNode("p"),
            DF.namedNode("o")
        );

        it("should produce no quads given an empty rule set", () => {
            const rules: IRuleGraph = { rules: [] };
            const resp = QuerySourceReasoning.chainReasoningOverAQuad(rules, A_QUAD);
            expect(resp).toStrictEqual([]);
        });

        it("should produce no quad given one chain rule not related", () => {
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("foo"),
                        DF.namedNode("c")
                    )
                ]
            };
            const resp = QuerySourceReasoning.chainReasoningOverAQuad(rules, A_QUAD);
   
            expect(resp).toStrictEqual([]);
        });

        it("should produce a quad given one chain rule", () => {
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const resp = QuerySourceReasoning.chainReasoningOverAQuad(rules, A_QUAD);
            const expectedImplicitQuads = DF.quad(
                DF.namedNode("c"),
                DF.namedNode("p"),
                DF.namedNode("o")
            );
            expect(resp).toStrictEqual([expectedImplicitQuads]);
        });

        it("should produce quads given multiple chain rules", () => {
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    ),
                    new SameAsRule(
                        DF.namedNode("c"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("c1"),
                        DF.namedNode("c2")
                    )
                ]
            };
            const resp = QuerySourceReasoning.chainReasoningOverAQuad(rules, A_QUAD);
            const expectedImplicitQuads = [
                DF.quad(
                    DF.namedNode("c"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c1"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c2"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),

            ];
            expect(resp).toStrictEqual(expectedImplicitQuads);
        });

        it("should produce quads given multiple chain rules and unrelated ones", () => {
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    ),
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("a")
                    ),
                    new SameAsRule(
                        DF.namedNode("a"),
                        DF.namedNode("b")
                    ),
                    new SameAsRule(
                        DF.namedNode("c"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("bar"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("c1"),
                        DF.namedNode("c2")
                    )
                ]
            };
            const resp = QuerySourceReasoning.chainReasoningOverAQuad(rules, A_QUAD);
            const expectedImplicitQuads = [
                DF.quad(
                    DF.namedNode("c"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("a"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("b"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c1"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c2"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),

            ];
            expect(resp).toStrictEqual(expectedImplicitQuads);
        });
    });

    describe("generateImplicitQuads", ()=>{
        it("should return no implicit quads given an empty quad stream", async ()=>{
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    ),
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("a")
                    ),
                    new SameAsRule(
                        DF.namedNode("a"),
                        DF.namedNode("b")
                    ),
                    new SameAsRule(
                        DF.namedNode("c"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("bar"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("c1"),
                        DF.namedNode("c2")
                    )
                ]
            };
            const quadStream: AsyncIterator<RDF.Quad> = fromArray(new Array<RDF.Quad>());

            const implicitQuads = await QuerySourceReasoning.generateImplicitQuads(rules, quadStream).toArray();
            
            expect(implicitQuads).toStrictEqual([]);
        });

        it("should return no implicit quads given an empty quad stream", async ()=>{
            const rules: IRuleGraph = {
                rules: []
            };
            const quadStream: AsyncIterator<RDF.Quad> = fromArray([
                DF.quad(
                    DF.namedNode("s"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("s1"),
                    DF.namedNode("p1"),
                    DF.namedNode("o1")
                ),
                DF.quad(
                    DF.namedNode("s2"),
                    DF.namedNode("p2"),
                    DF.namedNode("o2")
                )
            ]);

            const implicitQuads = await QuerySourceReasoning.generateImplicitQuads(rules, quadStream).toArray();
            
            expect(implicitQuads).toStrictEqual([]);
        });

        it("should return implicit quads given rules and a quad stream", async ()=>{
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    ),
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("a")
                    ),
                    new SameAsRule(
                        DF.namedNode("a"),
                        DF.namedNode("b")
                    ),
                    new SameAsRule(
                        DF.namedNode("c"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("bar"),
                        DF.namedNode("c1")
                    ),
                    new SameAsRule(
                        DF.namedNode("c1"),
                        DF.namedNode("c2")
                    )
                ]
            };
            const quadStream: AsyncIterator<RDF.Quad> = fromArray([
                DF.quad(
                    DF.namedNode("s"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("s1"),
                    DF.namedNode("p1"),
                    DF.namedNode("o1")
                ),
                DF.quad(
                    DF.namedNode("s2"),
                    DF.namedNode("p2"),
                    DF.namedNode("o2")
                )
            ]);

            const implicitQuads = await QuerySourceReasoning.generateImplicitQuads(rules, quadStream).toArray();
            const expectedImplicitQuad = [
                DF.quad(
                    DF.namedNode("c"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("a"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("b"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c1"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),
                DF.quad(
                    DF.namedNode("c2"),
                    DF.namedNode("p"),
                    DF.namedNode("o")
                ),

            ]
            expect(implicitQuads).toStrictEqual(expectedImplicitQuad);
        });
    });

    describe("constructor", ()=>{
        it("should get the selected shape and close the implicit quad store when the stream has ended", ()=>{
            //const innerSource = jest.mock()
        });
    })
});