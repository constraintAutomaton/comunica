import { Bus } from '@comunica/core';
import { ActorQuerySourceIdentifyHypermediaReasoningWrapper } from '../lib/ActorQuerySourceIdentifyHypermediaReasoningWrapper';

describe('ActorQuerySourceIdentifyHypermediaReasoningWrapper', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('An ActorQuerySourceIdentifyHypermediaReasoningWrapper instance', () => {
    let actor: ActorQuerySourceIdentifyHypermediaReasoningWrapper;

    beforeEach(() => {
      actor = new ActorQuerySourceIdentifyHypermediaReasoningWrapper({ name: 'actor', bus });
    });

    it('should test', () => {
      return expect(actor.test({ todo: true })).resolves.toEqual({ todo: true }); // TODO
    });

    it('should run', () => {
      return expect(actor.run({ todo: true })).resolves.toMatchObject({ todo: true }); // TODO
    });
  });
});
