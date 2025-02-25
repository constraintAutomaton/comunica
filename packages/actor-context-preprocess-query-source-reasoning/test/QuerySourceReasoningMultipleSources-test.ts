import { QuerySourceReasoningMultipleSources } from '../lib/QuerySourceReasoningMultipleSources';
import { IClosingCondition, IRuleGraph, Operator, SameAsRule } from "../lib";
import type * as RDF from '@rdfjs/types';
import { DataFactory } from "rdf-data-factory";
import { fromArray, AsyncIterator, WrappingIterator } from "asynciterator";
import { BindingsFactory } from '@comunica/utils-bindings-factory';
import { ActionContext } from "@comunica/core";
import { KeyReasoning, KeysInitQuery } from "@comunica/context-entries";
import { Algebra, Factory } from 'sparqlalgebrajs';
import { AbstractQuerySourceReasoning } from '../lib/QuerySourceReasoning';
import { IActionRdfMetadataAccumulate } from '@comunica/bus-rdf-metadata-accumulate';
import { StreamingStore } from 'rdf-streaming-store';
import "jest-rdf";

const DF = new DataFactory();
const BF = new BindingsFactory(DF);
const AF = new Factory();


describe("QuerySourceReasoningMultipleSources", () => {
    describe("constructor", () => {
        const originalGenerateImplicitQuadsMethod = AbstractQuerySourceReasoning.generateImplicitQuads;
        beforeEach(() => {
            AbstractQuerySourceReasoning.generateImplicitQuads = originalGenerateImplicitQuadsMethod;
        });

        afterAll(() => {
            AbstractQuerySourceReasoning.generateImplicitQuads = originalGenerateImplicitQuadsMethod;
        });

        it("should get the selected shape and the reference value and the implicit quad store should remain open", async () => {
            const innerSource: any = {
                queryBindings: jest.fn().mockReturnValue(
                    {
                        map: (callback: (binding: RDF.Bindings) => RDF.Quad) => {
                            const binding = BF.bindings([[DF.variable("foo"), DF.namedNode("bar")]]);
                            return fromArray([callback(binding)]);
                        },
                    },
                ),
                referenceValue: "foo"
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

            AbstractQuerySourceReasoning.generateImplicitQuads = jest.fn().mockReturnValueOnce({
                on: (event: any, callback: any) => {
                    if (event === "end") {
                        callback();
                    }
                }
            });

            const closingEvent: IClosingCondition = {
                closeHint: (_callback: () => void) => {
                    return;
                }
            };


            const querySource = new QuerySourceReasoningMultipleSources(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context,
                closingEvent);

            expect(await querySource.getSelectorShape()).toStrictEqual(selectorShape);
            expect(querySource.referenceValue).toStrictEqual("foo");
            expect((<any>querySource).implicitQuadStore.ended).toBe(false);
            expect(querySource.closed).toBe(false);
        });

        it("should get the selected shape and the reference value and the implicit quad store should  be close if the hint close it instantly", async () => {
            const innerSource: any = {
                queryBindings: jest.fn().mockReturnValue(
                    {
                        map: (callback: (binding: RDF.Bindings) => RDF.Quad) => {
                            const binding = BF.bindings([[DF.variable("foo"), DF.namedNode("bar")]]);
                            return fromArray([callback(binding)]);
                        },
                    },
                ),
                referenceValue: "foo"
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

            AbstractQuerySourceReasoning.generateImplicitQuads = jest.fn().mockReturnValueOnce({
                on: (event: any, callback: any) => {
                    if (event === "end") {
                        callback();
                    }
                }
            });

            const closingEvent: IClosingCondition = {
                closeHint: (callback: () => void) => {
                    callback();
                }
            };


            const querySource = new QuerySourceReasoningMultipleSources(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context,
                closingEvent);

            expect(await querySource.getSelectorShape()).toStrictEqual(selectorShape);
            expect(querySource.referenceValue).toStrictEqual("foo");
            expect((<any>querySource).implicitQuadStore.ended).toBe(true);
            expect(querySource.closed).toBe(true);
        });
    });

    describe("addSource", () => {
        let querySource: QuerySourceReasoningMultipleSources | undefined;
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

            const closingEvent: IClosingCondition = {
                closeHint: (_callback: () => void) => {
                }
            };

            querySource = new QuerySourceReasoningMultipleSources(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context,
                closingEvent
            );
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
            }
        });

        it("should add a sources with no quads", async () => {
            const quadStream: AsyncIterator<RDF.Quad> = fromArray(new Array<RDF.Quad>());
            const context = new ActionContext({
                [KeyReasoning.rules.name]: new Map()
            });
            expect(querySource?.addSource(quadStream, "foo", context)).toBeUndefined();

            const resp = (<StreamingStore>(<any>querySource).implicitQuadStore).match(null, null, null, null);

            querySource?.close();
            const implicitQuadStream = new WrappingIterator(resp);

            expect(await implicitQuadStream.toArray()).toStrictEqual([]);
        });

        it("should add a sources with quads producing implicit quad", async () => {
            return new Promise((resolve) => {
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
                const quadRules = [
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
                ];
                const context = new ActionContext({
                    [KeyReasoning.rules.name]: new Map([["foo", quadRules]])
                });
                const implicitStore = <StreamingStore>(<any>querySource).implicitQuadStore;

                const resp = implicitStore.match();

                const quads: RDF.Quad[] = [];
                resp.on("data", (quad: RDF.Quad) => {
                    quads.push(quad);
                });

                resp.on("end", () => {
                    expect(quads).toBeRdfIsomorphic([
                        DF.quad(
                            DF.namedNode("o"),
                            DF.namedNode("p"),
                            DF.namedNode("o")
                        ),
                        DF.quad(
                            DF.namedNode("o1"),
                            DF.namedNode("p1"),
                            DF.namedNode("o1")
                        ),
                    ]);
                    resolve(undefined);
                });

                expect(querySource?.addSource(quadStream, "foo", context)).toBeUndefined();

                querySource?.close();
            });
        });

        it("should return an error if the query source is closed", () => {
            querySource?.close();

            const quadStream: AsyncIterator<RDF.Quad> = fromArray(new Array<RDF.Quad>());
            const context = new ActionContext({
                [KeyReasoning.rules.name]: new Map()
            });
            expect(querySource?.addSource(quadStream, "foo", context)).toStrictEqual(new Error("The query source is closed"));
        });

        it("should return an error if the rule key is not in the context", async () => {
            const quadStream: AsyncIterator<RDF.Quad> = fromArray(new Array<RDF.Quad>());
            const context = new ActionContext();
            expect(querySource?.addSource(quadStream, "foo", context)).toStrictEqual(new Error('the "KeyReasoning" is not defined in the context'));
        });
    });

    describe("toString", () => {
        let querySource: QuerySourceReasoningMultipleSources | undefined;
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

            const closingEvent: IClosingCondition = {
                closeHint: (_callback: () => void) => {
                }
            };

            querySource = new QuerySourceReasoningMultipleSources(
                innerSource,
                sourceId,
                rules,
                BF,
                mediatorRdfMetadataAccumulate,
                context,
                closingEvent
            );
            (<any>querySource).implicitQuadQuerySource = {
                queryBindings: jest.fn(),
            }
        });
            it("return a string", () => {
                expect(querySource!.toString()).toBe(`QuerySourceReasoningMultipleSources(${innerSourceName})`);
            })
        });
    
});