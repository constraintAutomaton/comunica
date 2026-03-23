import type { QueryEngineBase } from '@comunica/actor-init-query';
import { QuerySourceSchema } from '@comunica/actor-query-source-identify-schema';
import { KeysQueryOperation } from '@comunica/context-entries';
import type { IActionContext, IQuerySourceWrapper } from '@comunica/types';
import {
  Algebra,
  AlgebraFactory,
  algebraUtils,
  isKnownOperation,
} from '@comunica/utils-algebra';
import { assignOperationSource, getOperationSource } from '@comunica/utils-query-operation';
import type * as RDF from '@rdfjs/types';
import { type Result, type SafePromise, result, error, isError } from 'result-interface';
import type { ISummary } from 'shex_to_summary';

const AF = new AlgebraFactory();

export async function resultAwareSourceSelection(
  Q: Algebra.Operation,
  F: IFederationMember[],
  queryEngine: QueryEngineBase,
  context: IActionContext,
): SafePromise<Algebra.Operation, string> {
  if (isKnownOperation(Q, Algebra.Types.PROJECT)) {
    const QBgpConvertedIntoJoin = <Algebra.Project>algebraUtils.mapOperation(
      Q,
      {
        [Algebra.Types.BGP]: {
          transform: (op: Algebra.Bgp) => AF.createJoin(op.patterns),
        },
      },
    );

    const plans = await recurResultAwareSourceSelection(
      QBgpConvertedIntoJoin.input,
      F,
      QBgpConvertedIntoJoin.variables,
      queryEngine,
    );

    const realSources: IQuerySourceWrapper[] = context.get(KeysQueryOperation.querySources) ?? [];
    const plansWithRealSources: Algebra.Operation[] = [];
    for (const plan of plans) {
      const r = assignActualSources(plan, realSources);
      if (isError(r)) {
        return r;
      }
      plansWithRealSources.push(r.value);
    }

    return result(AF.createProject(AF.createUnion(plansWithRealSources, true), QBgpConvertedIntoJoin.variables));
  }
  return error('only support SELECT queries');
}

export async function recurResultAwareSourceSelection(
  Q: Algebra.Operation,
  federation: IFederationMember[],
  variables: RDF.Variable[],
  queryEngine: QueryEngineBase,
): Promise<Algebra.Operation[]> {
  const plans: Algebra.Operation[] = [];

  if (isKnownOperation(Q, Algebra.Types.PATTERN)) {
    for (const federationMember of federation) {
      let clonedQ = <Algebra.Pattern>algebraUtils.mapOperation(Q, {});
      const wrapper: IQuerySourceWrapper = {
        source:
          new QuerySourceSchema(federationMember.summary, federationMember.url),
      };
      clonedQ = assignOperationSource(clonedQ, wrapper);
      plans.push(clonedQ);
    }
  } else if (isKnownOperation(Q, Algebra.Types.JOIN)) {
    const subPlanSets: Algebra.Operation[][] = [];
    for (const subQ of Q.input) {
      subPlanSets.push(await recurResultAwareSourceSelection(subQ, federation, variables, queryEngine));
    }
    for (const combination of cartesianProduct(subPlanSets)) {
      plans.push(AF.createJoin(combination, true));
    }
  } else if (isKnownOperation(Q, Algebra.Types.UNION)) {
    for (const subQ of Q.input) {
      plans.push(...await recurResultAwareSourceSelection(subQ, federation, variables, queryEngine));
    }
  } else if (isKnownOperation(Q, Algebra.Types.FILTER)) {
    const currentPlans = await recurResultAwareSourceSelection(Q.input, federation, variables, queryEngine);
    plans.push(...currentPlans.map(plan => AF.createFilter(plan, Q.expression)));
  }

  return selectPlan(plans, queryEngine);
}

function cartesianProduct<T extends Algebra.Operation>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap(combo => curr.map(item => [ ...combo, item ])),
    [[]],
  );
}

export async function selectPlan(
  plans: Algebra.Operation[],
  queryEngine: QueryEngineBase,
): Promise<Algebra.Operation[]> {
  const valid: Algebra.Operation[] = [];
  for (const plan of plans) {
    const ask = AF.createAsk(plan);
    // Empty context: AssignSourcesExhaustive is a no-op (sources.length === 0).
    // ActorQueryOperationSource reads metadata.scopedSource on each PATTERN
    // and routes to the correct QuerySourceSchema.queryBindings().
    // Empty sources: AssignSourcesExhaustive is a no-op (sources.length === 0),
    // preserving per-pattern metadata.scopedSource annotations.
    const isValid = await queryEngine.queryBoolean(ask, { sources: []});
    if (isValid) {
      valid.push(plan);
    }
  }
  return valid;
}

export function assignActualSources(
  plan: Algebra.Operation,
  realSources: IQuerySourceWrapper[],
): Result<Algebra.Operation, string> {
  if (isKnownOperation(plan, Algebra.Types.PATTERN)) {
    const url = getOperationSource(plan)?.source.referenceValue;
    if (typeof url !== 'string') {
      return result(plan);
    }
    const realWrapper = realSources.find(w => w.source.referenceValue === url);
    if (realWrapper === undefined) {
      return error(
        `No real source found for federation member URL: "${url}". ` +
        `Available: [${realSources.map(w => String(w.source.referenceValue)).join(', ')}]`,
      );
    }
    return result(assignOperationSource(plan, realWrapper));
  }
  if (isKnownOperation(plan, Algebra.Types.JOIN)) {
    const newInputs: Algebra.Operation[] = [];
    for (const sub of plan.input) {
      const r = assignActualSources(sub, realSources);
      if (isError(r)) {
        return r;
      }
      newInputs.push(r.value);
    }
    return result(AF.createJoin(newInputs, true));
  }
  if (isKnownOperation(plan, Algebra.Types.UNION)) {
    const newInputs: Algebra.Operation[] = [];
    for (const sub of plan.input) {
      const r = assignActualSources(sub, realSources);
      if (isError(r)) {
        return r;
      }
      newInputs.push(r.value);
    }
    return result(AF.createUnion(newInputs, true));
  }
  if (isKnownOperation(plan, Algebra.Types.FILTER)) {
    const r = assignActualSources(plan.input, realSources);
    if (isError(r)) {
      return r;
    }
    return result(AF.createFilter(r.value, plan.expression));
  }
  return result(plan);
}

export interface IFederationMember {
  url: string;
  summary: ISummary;
}
