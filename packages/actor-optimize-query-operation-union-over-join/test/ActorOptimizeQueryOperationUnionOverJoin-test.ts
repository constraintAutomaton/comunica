import type { ActorInitQueryBase } from '@comunica/actor-init-query';
import { Bus } from '@comunica/core';
import { ActorOptimizeQueryOperationUnionOverJoin } from '../lib/ActorOptimizeQueryOperationUnionOverJoin';
import '@comunica/utils-jest';

describe('ActorOptimizeQueryOperationUnionOverJoin', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('An ActorOptimizeQueryOperationUnionOverJoin instance', () => {
    let actor: ActorOptimizeQueryOperationUnionOverJoin;
    let actorInitQuery: ActorInitQueryBase;

    beforeEach(() => {
      actorInitQuery = <ActorInitQueryBase><unknown>{};
      actor = new ActorOptimizeQueryOperationUnionOverJoin({ name: 'actor', bus, actorInitQuery });
    });

    it('should be an ActorOptimizeQueryOperationUnionOverJoin', () => {
      expect(actor).toBeInstanceOf(ActorOptimizeQueryOperationUnionOverJoin);
    });
  });
});
