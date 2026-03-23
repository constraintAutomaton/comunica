import type { QueryEngineBase } from '@comunica/actor-init-query';
import { QuerySourceSchema } from '@comunica/actor-query-source-identify-schema';
import { KeysQueryOperation } from '@comunica/context-entries';
import { ActionContext } from '@comunica/core';
import type { IQuerySourceWrapper } from '@comunica/types';
import { AlgebraFactory, Algebra, isKnownOperation } from '@comunica/utils-algebra';
import { assignOperationSource, getOperationSource } from '@comunica/utils-query-operation';
import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import { isError, type IError, type IResult } from 'result-interface';
import type { ISummary } from 'shex_to_summary';
import {
  resultAwareSourceSelection,
  recurResultAwareSourceSelection,
  selectPlan,
  assignActualSources,
  type IFederationMember,
} from '../lib/resultAwareSourceSelection';

const DF = new DataFactory();
const AF = new AlgebraFactory(<any>DF);

function makeSummary(quads: RDF.Quad[] = []): ISummary {
  return { statements: quads, unionStatement: [], constraints: new Map() };
}

function makeMemberSummary(url: string, quads: RDF.Quad[] = []): IFederationMember {
  return { url, summary: makeSummary(quads) };
}

function mockEngine(fn: (ask: Algebra.Ask) => Promise<boolean>): QueryEngineBase {
  return <any> { queryBoolean: (_ask: any, _ctx: any) => fn(_ask) };
}

function assertSource(op: Algebra.Operation, member: IFederationMember): void {
  const src = getOperationSource(<Algebra.Pattern> op)?.source;
  expect(src).toBeInstanceOf(QuerySourceSchema);
  expect(src?.referenceValue).toBe(member.url);
}

/**
 * Full pattern check: type, terms via .equals(), and source.
 * Pass an IFederationMember to verify a QuerySourceSchema annotation (pre-assignActualSources).
 * Pass an IQuerySourceWrapper to verify reference identity (post-assignActualSources).
 */
function assertPattern(
  op: Algebra.Operation,
  subject: RDF.Term,
  predicate: RDF.Term,
  object: RDF.Term,
  source: IFederationMember | IQuerySourceWrapper,
): void {
  expect(op.type).toBe('pattern');
  const p = <Algebra.Pattern> op;
  expect(p.subject.equals(subject)).toBe(true);
  expect(p.predicate.equals(predicate)).toBe(true);
  expect(p.object.equals(object)).toBe(true);
  if ('url' in source) {
    assertSource(op, source);
  } else {
    expect(getOperationSource(p)).toBe(source);
  }
}

const alwaysTrue = mockEngine(() => Promise.resolve(true));
const alwaysFalse = mockEngine(() => Promise.resolve(false));

const S = DF.namedNode('http://ex/s');
const P = DF.namedNode('http://ex/p');
const O = DF.namedNode('http://ex/o');
const X = DF.variable('x');

const PATTERN_S_P_O = AF.createPattern(S, P, O);
const PATTERN_S_P_X = AF.createPattern(S, P, X);

const MEMBER_A = makeMemberSummary('http://a.example/');
const MEMBER_B = makeMemberSummary('http://b.example/');

describe(selectPlan.name, () => {
  it('returns [] for empty input', async() => {
    await expect(selectPlan([], alwaysTrue)).resolves.toEqual([]);
  });

  it('accepts a plan when engine returns true', async() => {
    const plan = AF.createJoin([ PATTERN_S_P_O ]);
    const result = await selectPlan([ plan ], alwaysTrue);
    expect(result).toEqual([ plan ]);
  });

  it('rejects a plan when engine returns false', async() => {
    const plan = AF.createJoin([ PATTERN_S_P_O ]);
    await expect(selectPlan([ plan ], alwaysFalse)).resolves.toEqual([]);
  });

  it('filters mixed valid/invalid plans', async() => {
    const valid = AF.createPattern(S, P, O);
    const invalid = AF.createPattern(S, P, DF.namedNode('http://ex/z'));
    let call = 0;
    const mixed = mockEngine(() => Promise.resolve(call++ === 0));
    const result = await selectPlan([ valid, invalid ], mixed);
    expect(result).toEqual([ valid ]);
  });

  it('accepts a composite JOIN plan', async() => {
    const plan = AF.createJoin([ PATTERN_S_P_O, PATTERN_S_P_X ], true);
    const result = await selectPlan([ plan ], alwaysTrue);
    expect(result).toEqual([ plan ]);
  });
});

describe(recurResultAwareSourceSelection.name, () => {
  const vars: RDF.Variable[] = [ X ];

  describe('PATTERN', () => {
    it('produces one annotated PATTERN plan for a single member', async() => {
      const result = await recurResultAwareSourceSelection(PATTERN_S_P_O, [ MEMBER_A ], vars, alwaysTrue);
      expect(result).toHaveLength(1);
      assertPattern(result[0], S, P, O, MEMBER_A);
    });

    it('produces one plan per member with correct source annotations', async() => {
      const result = await recurResultAwareSourceSelection(PATTERN_S_P_O, [ MEMBER_A, MEMBER_B ], vars, alwaysTrue);
      expect(result).toHaveLength(2);
      assertPattern(result[0], S, P, O, MEMBER_A);
      assertPattern(result[1], S, P, O, MEMBER_B);
    });

    it('returns [] when engine rejects all plans', async() => {
      const result = await recurResultAwareSourceSelection(PATTERN_S_P_O, [ MEMBER_A, MEMBER_B ], vars, alwaysFalse);
      expect(result).toEqual([]);
    });
  });

  describe('JOIN', () => {
    it('produces a single JOIN plan for 1 member × 2 patterns', async() => {
      const join = AF.createJoin([ PATTERN_S_P_O, PATTERN_S_P_X ]);
      const result = await recurResultAwareSourceSelection(join, [ MEMBER_A ], vars, alwaysTrue);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('join');
      const inputs = (<Algebra.Join> result[0]).input;
      expect(inputs).toHaveLength(2);
      assertPattern(inputs[0], S, P, O, MEMBER_A);
      assertPattern(inputs[1], S, P, X, MEMBER_A);
    });

    it('produces all 4 JOIN combinations for 2 members × 2 patterns', async() => {
      const join = AF.createJoin([ PATTERN_S_P_O, PATTERN_S_P_X ]);
      const result = await recurResultAwareSourceSelection(join, [ MEMBER_A, MEMBER_B ], vars, alwaysTrue);
      expect(result).toHaveLength(4);
      for (const r of result) {
        expect(r.type).toBe('join');
        expect((<Algebra.Join> r).input).toHaveLength(2);
      }
      const inp = (i: number) => (<Algebra.Join> result[i]).input;
      assertPattern(inp(0)[0], S, P, O, MEMBER_A);
      assertPattern(inp(0)[1], S, P, X, MEMBER_A);
      assertPattern(inp(1)[0], S, P, O, MEMBER_A);
      assertPattern(inp(1)[1], S, P, X, MEMBER_B);
      assertPattern(inp(2)[0], S, P, O, MEMBER_B);
      assertPattern(inp(2)[1], S, P, X, MEMBER_A);
      assertPattern(inp(3)[0], S, P, O, MEMBER_B);
      assertPattern(inp(3)[1], S, P, X, MEMBER_B);
    });

    it('filters combinations via engine', async() => {
      const join = AF.createJoin([ PATTERN_S_P_O, PATTERN_S_P_X ]);
      const result = await recurResultAwareSourceSelection(join, [ MEMBER_A, MEMBER_B ], vars, alwaysFalse);
      expect(result).toEqual([]);
    });
  });

  describe('UNION', () => {
    it('produces one plan per UNION branch with correct structure', async() => {
      const union = AF.createUnion([ PATTERN_S_P_O, PATTERN_S_P_X ]);
      const result = await recurResultAwareSourceSelection(union, [ MEMBER_A ], vars, alwaysTrue);
      expect(result).toHaveLength(2);
      assertPattern(result[0], S, P, O, MEMBER_A);
      assertPattern(result[1], S, P, X, MEMBER_A);
    });

    it('filters branches via engine', async() => {
      const union = AF.createUnion([ PATTERN_S_P_O, PATTERN_S_P_X ]);
      const result = await recurResultAwareSourceSelection(union, [ MEMBER_A ], vars, alwaysFalse);
      expect(result).toEqual([]);
    });
  });

  describe('FILTER', () => {
    it('wraps each sub-plan in a FILTER preserving expression and annotating inner pattern', async() => {
      const expr = AF.createTermExpression(DF.namedNode('http://ex/filter'));
      const filter = AF.createFilter(PATTERN_S_P_O, expr);
      const result = await recurResultAwareSourceSelection(filter, [ MEMBER_A ], vars, alwaysTrue);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('filter');
      const f = <Algebra.Filter> result[0];
      expect(f.expression).toBe(expr);
      assertPattern(f.input, S, P, O, MEMBER_A);
    });
  });
});

describe(resultAwareSourceSelection.name, () => {
  const realA: IQuerySourceWrapper = { source: <any>{ referenceValue: MEMBER_A.url }};
  const realB: IQuerySourceWrapper = { source: <any> { referenceValue: MEMBER_B.url }};
  const ctxA = new ActionContext().set(KeysQueryOperation.querySources, [ realA ]);
  const ctxAB = new ActionContext().set(KeysQueryOperation.querySources, [ realA, realB ]);

  it('returns error for non-PROJECT operations', async() => {
    const res = await resultAwareSourceSelection(AF.createBgp([ PATTERN_S_P_O ]), [ MEMBER_A ], alwaysTrue, ctxA);
    expect(isError(res)).toBe(true);
    expect((<IError<string>> res).error).toBe('only support SELECT queries');
  });

  it('preserves PROJECT variables in the output', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const project = <Algebra.Project> (<IResult<Algebra.Operation>> res).value;
    expect(project.type).toBe('project');
    expect(project.variables).toHaveLength(1);
    expect(project.variables[0].equals(X)).toBe(true);
  });

  it('single member, single triple: UNION with 1 branch carrying real source', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const project = <Algebra.Project> (<IResult<Algebra.Operation>> res).value;
    const branches = (<Algebra.Union> project.input).input;

    expect(branches).toHaveLength(1);
    expect(branches[0].type).toBe('join');
    const inputs = (<Algebra.Join> branches[0]).input;
    expect(inputs).toHaveLength(1);
    assertPattern(inputs[0], S, P, O, realA);
  });

  it('returns an empty UNION when engine rejects all plans', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [ MEMBER_A ],
      alwaysFalse,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const project = <Algebra.Project> (<IResult<Algebra.Operation>> res).value;
    expect(isKnownOperation(project.input, Algebra.Types.UNION)).toBe(true);
    expect((<Algebra.Union> project.input).input).toHaveLength(0);
  });

  it('returns error when context has no real source matching a federation member', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      new ActionContext().set(KeysQueryOperation.querySources, []),
    );
    expect(isError(res)).toBe(true);
  });

  it('empty federation produces empty UNION', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [],
      alwaysTrue,
      new ActionContext().set(KeysQueryOperation.querySources, []),
    );
    expect(isError(res)).toBe(false);
    const project = <Algebra.Project> (<IResult<Algebra.Operation>> res).value;
    expect((<Algebra.Union> project.input).input).toHaveLength(0);
  });

  it('2-triple BGP: UNION has 1 JOIN branch with both patterns from MEMBER_A', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O, PATTERN_S_P_X ]), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const branches = (<Algebra.Union> (<Algebra.Project> (<IResult<Algebra.Operation>> res).value).input).input;
    expect(branches).toHaveLength(1);
    expect(branches[0].type).toBe('join');
    const inputs = (<Algebra.Join> branches[0]).input;
    expect(inputs).toHaveLength(2);
    assertPattern(inputs[0], S, P, O, realA);
    assertPattern(inputs[1], S, P, X, realA);
  });

  it('2 members × 1 triple: UNION has 2 branches, one per member', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O ]), [ X ]),
      [ MEMBER_A, MEMBER_B ],
      alwaysTrue,
      ctxAB,
    );
    expect(isError(res)).toBe(false);
    const branches = (<Algebra.Union> (<Algebra.Project> (<IResult<Algebra.Operation>> res).value).input).input;

    expect(branches).toHaveLength(2);
    expect(branches[0].type).toBe('join');
    assertPattern((<Algebra.Join> branches[0]).input[0], S, P, O, realA);
    expect(branches[1].type).toBe('join');
    assertPattern((<Algebra.Join> branches[1]).input[0], S, P, O, realB);
  });

  it('2 members × 2-triple BGP: UNION has 4 JOIN branches (cartesian product)', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createBgp([ PATTERN_S_P_O, PATTERN_S_P_X ]), [ X ]),
      [ MEMBER_A, MEMBER_B ],
      alwaysTrue,
      ctxAB,
    );
    expect(isError(res)).toBe(false);
    const branches = (<Algebra.Union> (<Algebra.Project> (<IResult<Algebra.Operation>> res).value).input).input;
    expect(branches).toHaveLength(4);
    for (const branch of branches) {
      expect(branch.type).toBe('join');
      expect((<Algebra.Join> branch).input).toHaveLength(2);
    }
    const inp = (i: number) => (<Algebra.Join> branches[i]).input;
    assertPattern(inp(0)[0], S, P, O, realA);
    assertPattern(inp(0)[1], S, P, X, realA);
    assertPattern(inp(1)[0], S, P, O, realA);
    assertPattern(inp(1)[1], S, P, X, realB);
    assertPattern(inp(2)[0], S, P, O, realB);
    assertPattern(inp(2)[1], S, P, X, realA);
    assertPattern(inp(3)[0], S, P, O, realB);
    assertPattern(inp(3)[1], S, P, X, realB);
  });

  it('FILTER inside PROJECT: UNION branches are FILTERs wrapping annotated patterns', async() => {
    const expr = AF.createTermExpression(DF.namedNode('http://ex/filter'));
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createFilter(PATTERN_S_P_O, expr), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const branches = (<Algebra.Union> (<Algebra.Project> (<IResult<Algebra.Operation>> res).value).input).input;
    expect(branches).toHaveLength(1);
    expect(branches[0].type).toBe('filter');
    const f = <Algebra.Filter> branches[0];

    expect(f.expression).toEqual(expr);
    assertPattern(f.input, S, P, O, realA);
  });

  it('UNION inside PROJECT: all branches are annotated from the single member', async() => {
    const res = await resultAwareSourceSelection(
      AF.createProject(AF.createUnion([ PATTERN_S_P_O, PATTERN_S_P_X ]), [ X ]),
      [ MEMBER_A ],
      alwaysTrue,
      ctxA,
    );
    expect(isError(res)).toBe(false);
    const branches = (<Algebra.Union> (<Algebra.Project> (<IResult<Algebra.Operation>> res).value).input).input;
    expect(branches).toHaveLength(2);
    assertPattern(branches[0], S, P, O, realA);
    assertPattern(branches[1], S, P, X, realA);
  });
});

describe(assignActualSources.name, () => {
  const schemaWrapper: IQuerySourceWrapper = { source: <any>{ referenceValue: MEMBER_A.url }};
  const realWrapper: IQuerySourceWrapper = { source: <any> { referenceValue: MEMBER_A.url }};

  it('assigns real source to a PATTERN with matching URL', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const r = assignActualSources(annotated, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    expect(getOperationSource(<Algebra.Pattern> (<IResult<Algebra.Operation>> r).value)).toBe(realWrapper);
  });

  it('returns error for PATTERN with no matching real source', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const r = assignActualSources(annotated, []);
    expect(isError(r)).toBe(true);
  });

  it('returns plan unchanged for PATTERN with no scopedSource', () => {
    const plan = AF.createPattern(S, P, O);
    const r = assignActualSources(plan, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    expect((<IResult<Algebra.Operation>> r).value).toBe(plan);
  });

  it('recursively assigns in a JOIN with a single pattern', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const join = AF.createJoin([ annotated ], true);
    const r = assignActualSources(join, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    const result = <Algebra.Join> (<IResult<Algebra.Operation>> r).value;
    expect(result.type).toBe('join');
    assertPattern(result.input[0], S, P, O, realWrapper);
  });

  it('recursively assigns in a JOIN with multiple patterns', () => {
    const ann1 = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const ann2 = assignOperationSource(AF.createPattern(S, P, X), schemaWrapper);
    const join = AF.createJoin([ ann1, ann2 ], true);
    const r = assignActualSources(join, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    const result = <Algebra.Join> (<IResult<Algebra.Operation>> r).value;
    expect(result.type).toBe('join');
    expect(result.input).toHaveLength(2);
    assertPattern(result.input[0], S, P, O, realWrapper);
    assertPattern(result.input[1], S, P, X, realWrapper);
  });

  it('returns error in a JOIN when a child has no matching real source', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const join = AF.createJoin([ annotated ], true);
    const r = assignActualSources(join, []);
    expect(isError(r)).toBe(true);
  });

  it('recursively assigns in a UNION with a single branch', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const union = AF.createUnion([ annotated ], true);
    const r = assignActualSources(union, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    const result = <Algebra.Union> (<IResult<Algebra.Operation>> r).value;
    expect(result.type).toBe('union');
    assertPattern(result.input[0], S, P, O, realWrapper);
  });

  it('recursively assigns in a UNION with multiple branches', () => {
    const ann1 = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const ann2 = assignOperationSource(AF.createPattern(S, P, X), schemaWrapper);
    const union = AF.createUnion([ ann1, ann2 ], true);
    const r = assignActualSources(union, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    const result = <Algebra.Union> (<IResult<Algebra.Operation>> r).value;
    expect(result.type).toBe('union');
    expect(result.input).toHaveLength(2);
    assertPattern(result.input[0], S, P, O, realWrapper);
    assertPattern(result.input[1], S, P, X, realWrapper);
  });

  it('recursively assigns in a FILTER', () => {
    const annotated = assignOperationSource(AF.createPattern(S, P, O), schemaWrapper);
    const expr = AF.createTermExpression(DF.namedNode('http://ex/filter'));
    const filter = AF.createFilter(annotated, expr);
    const r = assignActualSources(filter, [ realWrapper ]);
    expect(isError(r)).toBe(false);
    const result = <Algebra.Filter> (<IResult<Algebra.Operation>> r).value;
    expect(result.type).toBe('filter');
    expect(result.expression).toBe(expr);
    assertPattern(result.input, S, P, O, realWrapper);
  });
});
