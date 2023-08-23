import { Bus } from '@comunica/core';
import { ActorInterEngineCommunicationHttp } from '../lib/ActorInterEngineCommunicationHttp';

describe('ActorInterEngineCommunicationHttp', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('An ActorInterEngineCommunicationHttp instance', () => {
    let actor: ActorInterEngineCommunicationHttp;

    beforeEach(() => {
      actor = new ActorInterEngineCommunicationHttp({ name: 'actor', bus });
    });

    it('should test', () => {
      return expect(actor.test({ todo: true })).resolves.toEqual({ todo: true }); // TODO
    });

    it('should run', () => {
      return expect(actor.run({ todo: true })).resolves.toMatchObject({ todo: true }); // TODO
    });
  });
});
