import {
  ActorQueryOperation, ActorQueryOperationTypedMediated, Bindings,
  IActorQueryOperationOutput,
  IActorQueryOperationOutputBindings,
  IActorQueryOperationTypedMediatedArgs,
} from "@comunica/bus-query-operation";
import { BindingsStream } from "@comunica/bus-query-operation";
import { ActionContext, IActorTest } from "@comunica/core";
import { termToString } from 'rdf-string';
import { Algebra } from "sparqlalgebrajs";
import { AsyncEvaluator, ExpressionError } from "sparqlee";

/**
 * A comunica Extend Query Operation Actor.
 *
 * See https://www.w3.org/TR/sparql11-query/#sparqlAlgebra;
 */
export class ActorQueryOperationExtend extends ActorQueryOperationTypedMediated<Algebra.Extend> {

  constructor(args: IActorQueryOperationTypedMediatedArgs) {
    super(args, 'extend');
  }

  public async testOperation(pattern: Algebra.Extend, context: ActionContext): Promise<IActorTest> {
    // Will throw error for unsupported opperations
    const _ = new AsyncEvaluator(pattern.expression);
    return true;
  }

  public async runOperation(pattern: Algebra.Extend, context: ActionContext)
    : Promise<IActorQueryOperationOutputBindings> {

    const { expression, input, variable } = pattern;

    const output: IActorQueryOperationOutputBindings = ActorQueryOperation.getSafeBindings(
      await this.mediatorQueryOperation.mediate({ operation: input, context }));

    const extendKey = variable.value;
    const evaluator = new AsyncEvaluator(expression);

    // Transform the stream by extending each Bindings with the expression result
    const transform = async (bindings: Bindings, next: any) => {
      try {
        const result = await evaluator.evaluate(bindings);
        const extended = bindings.set(extendKey, result); // Extend is undefined when the key exists.
        bindingsStream._push(extended);
      } catch (err) {
        if (this.isExpressionError(err)) {
          // Errors silently don't actually extend according to the spec
          // TODO: Do we try to emit a warning here?
          bindingsStream._push(bindings);
        } else {
          bindingsStream.emit('error', err);
        }
      }
      next();
    };

    const variables = [extendKey]; // TODO: Can I access existing variables already to concat with?
    const bindingsStream = output.bindingsStream.transform<Bindings>({ transform });
    const metadata = output.metadata;
    return { type: 'bindings', bindingsStream, metadata, variables };
  }

  // Expression errors are errors intentionally thrown because of expression-data mismatches.
  // They are distinct from other errors in the sense that their behaviour is defined by
  // the SPARQL spec.
  // In this specific case, they should be ignored (while others obviously should not).
  // This function is separate so it can more easily be mocked in tests.
  public isExpressionError(error: Error): boolean {
    return error instanceof ExpressionError;
  }

}