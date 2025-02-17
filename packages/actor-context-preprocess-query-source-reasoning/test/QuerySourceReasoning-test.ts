import { IRuleGraph, SameAsRule } from "../lib";
import type * as RDF from '@rdfjs/types';
import { DataFactory } from "rdf-data-factory";
import { QuerySourceReasoning } from "../lib/QuerySourceReasoning";
import { AsyncIterator, fromArray } from "asynciterator";
import { BindingsFactory } from '@comunica/utils-bindings-factory';
import { ActionContext } from "@comunica/core";
import { KeysInitQuery } from "@comunica/context-entries";
import { Algebra, Factory, translate } from 'sparqlalgebrajs';
import { IActionRdfMetadataAccumulate } from "@comunica/bus-rdf-metadata-accumulate";

const DF = new DataFactory();
const BF = new BindingsFactory(DF);
const AF = new Factory();


describe('QuerySourceReasoning', () => {
    const A_QUAD = DF.quad(
        DF.namedNode("s"),
        DF.namedNode("p"),
        DF.namedNode("o")
    );
    describe("chainReasoningOverAQuad", () => {

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

    describe("generateImplicitQuads", () => {
        it("should return no implicit quads given an empty quad stream", async () => {
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

        it("should return no implicit quads given an empty quad stream", async () => {
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

        it("should return implicit quads given rules and a quad stream", async () => {
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

    describe("constructor", () => {
        const originalGenerateImplicitQuadsMethod = QuerySourceReasoning.generateImplicitQuads;
        beforeEach(() => {
            QuerySourceReasoning.generateImplicitQuads = originalGenerateImplicitQuadsMethod;
        });

        afterAll(() => {
            QuerySourceReasoning.generateImplicitQuads = originalGenerateImplicitQuadsMethod;
        });

        it("should get the selected shape and the reference value and close the implicit quad store when the stream has ended", async () => {
            const quadStream = fromArray([]);
            const innerSource: any = {
                queryBindings: jest.fn().mockReturnValueOnce(
                    {
                        map: () => quadStream,
                        referenceValue: "foo"

                    }
                )
            };
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const sourceId = undefined;
            const mediatorRdfMetadataAccumulate: any = jest.fn();
            const context = new ActionContext({
                [KeysInitQuery.dataFactory.name]: DF,
            });

            const selectorShape = {
                type: 'operation',
                operation: {
                    operationType: 'pattern',
                    pattern: AF.createPattern(
                        DF.variable('s'),
                        DF.variable('p'),
                        DF.variable('o'),
                    ),
                },
                variablesOptional: [
                    DF.variable('s'),
                    DF.variable('p'),
                    DF.variable('o'),
                ],
            };

            QuerySourceReasoning.generateImplicitQuads = jest.fn().mockReturnValueOnce({
                on: (event: any, callback: any) => {
                    if (event === "end") {
                        callback();
                    }
                }
            });

            const querySource = new QuerySourceReasoning(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context);

            expect(await querySource.getSelectorShape()).toStrictEqual(selectorShape);
            expect(await querySource.referenceValue).toStrictEqual("foo");
            expect((<any>querySource).implicitQuadStore.ended).toBe(true);
        });
    });

    describe("queryBindings", () => {
        let querySource: QuerySourceReasoning | undefined;
        let innerSource: any;

        beforeEach(() => {
            const quadStream = fromArray([]);
            innerSource = {
                queryBindings: jest.fn().mockReturnValueOnce(
                    {
                        map: () => quadStream,
                        referenceValue: "foo"

                    }
                ),
                queryBoolean: jest.fn()
            };
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const sourceId = undefined;
            const mediatorRdfMetadataAccumulate: any = <any>{
                async mediate(action: IActionRdfMetadataAccumulate) {
                    if (action.mode === 'initialize') {
                        return { metadata: { cardinality: { type: 'exact', value: 0 } } };
                    }

                    const metadata = { ...action.accumulatedMetadata };
                    const subMetadata = action.appendingMetadata;
                    if (!subMetadata.cardinality || !Number.isFinite(subMetadata.cardinality.value)) {
                        // We're already at infinite, so ignore any later metadata
                        metadata.cardinality.type = 'estimate';
                        metadata.cardinality.value = Number.POSITIVE_INFINITY;
                    } else {
                        if (subMetadata.cardinality.type === 'estimate') {
                            metadata.cardinality.type = 'estimate';
                        }
                        metadata.cardinality.value += subMetadata.cardinality.value;
                    }
                    if (metadata.requestTime ?? subMetadata.requestTime) {
                        metadata.requestTime = metadata.requestTime ?? 0;
                        subMetadata.requestTime = subMetadata.requestTime ?? 0;
                        metadata.requestTime += subMetadata.requestTime;
                    }
                    if (metadata.pageSize ?? subMetadata.pageSize) {
                        metadata.pageSize = metadata.pageSize ?? 0;
                        subMetadata.pageSize = subMetadata.pageSize ?? 0;
                        metadata.pageSize += subMetadata.pageSize;
                    }

                    return { metadata };
                },
            };
            const context = new ActionContext({
                [KeysInitQuery.dataFactory.name]: DF,
            });

            querySource = new QuerySourceReasoning(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context);
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
                queryBoolean: jest.fn()
            }
        });

        it("should throw an error given options are provided", () => {
            const operation: any = {};
            const context: any = {};
            const options: any = {};

            expect(() => querySource!.queryBindings(operation, context, options))
                .toThrow(
                    new Error('options in queryBindings are not supported in QuerySourceReasoning')
                );
        });

        it("should throw an error given a non pattern operation", () => {
            const operation = translate('ASK { ?x ?y ?z }');
            const context: any = {};
            const options: any = undefined;

            expect(() => querySource!.queryBindings(operation, context, options))
                .toThrow(
                    new Error(`Attempted to pass non-pattern operation '${operation.type}' to QuerySourceReasoning`)
                )
        });

        it('should return a quad stream when only the inner source has results', async () => {
            const operation: any = {
                type: "pattern"
            };
            const context: any = {};
            const expectedBindings = [
                BF.bindings([[DF.variable("foo"), DF.namedNode("bar")]]),
                BF.bindings([[DF.variable("foo1"), DF.namedNode("bar1")]])
            ];

            const originalBindingStream = fromArray(expectedBindings);
            const metadata = { variable: DF.variable('a'), canBeUndef: false, cardinality: { type: 'exact', value: 12 } };
            originalBindingStream.setProperty("metadata", metadata)

            innerSource.queryBindings.mockReturnValueOnce(originalBindingStream);
            const implicitBindingStream = fromArray([]);
            const implicitMetadata = { variable: DF.variable('a'), canBeUndef: false, cardinality: { type: 'exact', value: 0 } };
            implicitBindingStream.setProperty("metadata", implicitMetadata);
            (<any>querySource).implicitQuadQuerySource.queryBindings.mockReturnValueOnce(implicitBindingStream);

            const resp = querySource!.queryBindings(operation, context);
            await expect(new Promise(resolve => resp.getProperty('metadata', resolve))).resolves
                .toEqual(metadata)
            const bindings = await resp.toArray();

            expect(bindings).toStrictEqual(expectedBindings);
        });
    });

    describe("queryQuads", () => {
        let querySource: QuerySourceReasoning | undefined;
        let innerSource: any;

        beforeEach(() => {
            const quadStream = fromArray([]);
            innerSource = {
                queryBindings: jest.fn().mockReturnValueOnce(
                    {
                        map: () => quadStream,
                        referenceValue: "foo"

                    }
                ),
                queryBoolean: jest.fn()
            };
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const sourceId = undefined;
            const mediatorRdfMetadataAccumulate: any = <any>{
                async mediate(action: IActionRdfMetadataAccumulate) {
                    if (action.mode === 'initialize') {
                        return { metadata: { cardinality: { type: 'exact', value: 0 } } };
                    }

                    const metadata = { ...action.accumulatedMetadata };
                    const subMetadata = action.appendingMetadata;
                    if (!subMetadata.cardinality || !Number.isFinite(subMetadata.cardinality.value)) {
                        // We're already at infinite, so ignore any later metadata
                        metadata.cardinality.type = 'estimate';
                        metadata.cardinality.value = Number.POSITIVE_INFINITY;
                    } else {
                        if (subMetadata.cardinality.type === 'estimate') {
                            metadata.cardinality.type = 'estimate';
                        }
                        metadata.cardinality.value += subMetadata.cardinality.value;
                    }
                    if (metadata.requestTime ?? subMetadata.requestTime) {
                        metadata.requestTime = metadata.requestTime ?? 0;
                        subMetadata.requestTime = subMetadata.requestTime ?? 0;
                        metadata.requestTime += subMetadata.requestTime;
                    }
                    if (metadata.pageSize ?? subMetadata.pageSize) {
                        metadata.pageSize = metadata.pageSize ?? 0;
                        subMetadata.pageSize = subMetadata.pageSize ?? 0;
                        metadata.pageSize += subMetadata.pageSize;
                    }

                    return { metadata };
                },
            };
            const context = new ActionContext({
                [KeysInitQuery.dataFactory.name]: DF,
            });

            querySource = new QuerySourceReasoning(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context);
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
                queryBoolean: jest.fn()
            }
        });

        it("should throw", () => {
            expect(() => querySource!.queryQuads()).toThrow(
                new Error('queryQuads is not implemented in QuerySourceReasoning')
            );
        })
    });

    describe("queryVoid", () => {
        let querySource: QuerySourceReasoning | undefined;
        let innerSource: any;

        beforeEach(() => {
            const quadStream = fromArray([]);
            innerSource = {
                queryBindings: jest.fn().mockReturnValueOnce(
                    {
                        map: () => quadStream,
                        referenceValue: "foo"

                    }
                ),
                queryBoolean: jest.fn()
            };
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const sourceId = undefined;
            const mediatorRdfMetadataAccumulate: any = <any>{
                async mediate(action: IActionRdfMetadataAccumulate) {
                    if (action.mode === 'initialize') {
                        return { metadata: { cardinality: { type: 'exact', value: 0 } } };
                    }

                    const metadata = { ...action.accumulatedMetadata };
                    const subMetadata = action.appendingMetadata;
                    if (!subMetadata.cardinality || !Number.isFinite(subMetadata.cardinality.value)) {
                        // We're already at infinite, so ignore any later metadata
                        metadata.cardinality.type = 'estimate';
                        metadata.cardinality.value = Number.POSITIVE_INFINITY;
                    } else {
                        if (subMetadata.cardinality.type === 'estimate') {
                            metadata.cardinality.type = 'estimate';
                        }
                        metadata.cardinality.value += subMetadata.cardinality.value;
                    }
                    if (metadata.requestTime ?? subMetadata.requestTime) {
                        metadata.requestTime = metadata.requestTime ?? 0;
                        subMetadata.requestTime = subMetadata.requestTime ?? 0;
                        metadata.requestTime += subMetadata.requestTime;
                    }
                    if (metadata.pageSize ?? subMetadata.pageSize) {
                        metadata.pageSize = metadata.pageSize ?? 0;
                        subMetadata.pageSize = subMetadata.pageSize ?? 0;
                        metadata.pageSize += subMetadata.pageSize;
                    }

                    return { metadata };
                },
            };
            const context = new ActionContext({
                [KeysInitQuery.dataFactory.name]: DF,
            });

            querySource = new QuerySourceReasoning(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context);
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
                queryBoolean: jest.fn()
            }
        });

        it("should throw", () => {
            expect(() => querySource!.queryVoid()).toThrow(
                new Error('queryVoid is not implemented in QuerySourceReasoning')
            );
        })
    });

    describe("toString", () => {
        let querySource: QuerySourceReasoning | undefined;
        let innerSource: any;
        const innerSourceName = "bar"

        beforeEach(() => {
            const quadStream = fromArray([]);
            innerSource = {
                queryBindings: jest.fn().mockReturnValueOnce(
                    {
                        map: () => quadStream,
                        referenceValue: "foo"

                    }
                ),
                queryBoolean: jest.fn(),
                toString: () => innerSourceName
            };
            const rules: IRuleGraph = {
                rules: [
                    new SameAsRule(
                        DF.namedNode("s"),
                        DF.namedNode("c")
                    )
                ]
            };
            const sourceId = undefined;
            const mediatorRdfMetadataAccumulate: any = <any>{
                async mediate(action: IActionRdfMetadataAccumulate) {
                    if (action.mode === 'initialize') {
                        return { metadata: { cardinality: { type: 'exact', value: 0 } } };
                    }

                    const metadata = { ...action.accumulatedMetadata };
                    const subMetadata = action.appendingMetadata;
                    if (!subMetadata.cardinality || !Number.isFinite(subMetadata.cardinality.value)) {
                        // We're already at infinite, so ignore any later metadata
                        metadata.cardinality.type = 'estimate';
                        metadata.cardinality.value = Number.POSITIVE_INFINITY;
                    } else {
                        if (subMetadata.cardinality.type === 'estimate') {
                            metadata.cardinality.type = 'estimate';
                        }
                        metadata.cardinality.value += subMetadata.cardinality.value;
                    }
                    if (metadata.requestTime ?? subMetadata.requestTime) {
                        metadata.requestTime = metadata.requestTime ?? 0;
                        subMetadata.requestTime = subMetadata.requestTime ?? 0;
                        metadata.requestTime += subMetadata.requestTime;
                    }
                    if (metadata.pageSize ?? subMetadata.pageSize) {
                        metadata.pageSize = metadata.pageSize ?? 0;
                        subMetadata.pageSize = subMetadata.pageSize ?? 0;
                        metadata.pageSize += subMetadata.pageSize;
                    }

                    return { metadata };
                },
            };
            const context = new ActionContext({
                [KeysInitQuery.dataFactory.name]: DF,
            });

            querySource = new QuerySourceReasoning(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context);
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
                queryBoolean: jest.fn()
            }
        });

        it("return a string", () => {
            expect(querySource!.toString()).toBe(`QuerySourceReasoning(${innerSourceName})`);
        })
    });
});