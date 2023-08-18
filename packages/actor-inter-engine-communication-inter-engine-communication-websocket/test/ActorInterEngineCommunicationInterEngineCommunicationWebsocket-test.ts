import { Bus } from '@comunica/core';
import { ActorInterEngineCommunicationInterEngineCommunicationWebsocket } from '../lib/ActorInterEngineCommunicationInterEngineCommunicationWebsocket';

describe('ActorInterEngineCommunicationInterEngineCommunicationWebsocket', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('An ActorInterEngineCommunicationInterEngineCommunicationWebsocket instance', () => {
    let actor: ActorInterEngineCommunicationInterEngineCommunicationWebsocket;

    beforeEach(() => {
      actor = new ActorInterEngineCommunicationInterEngineCommunicationWebsocket({ name: 'actor', bus });
    });

    it('should test', () => {
      return expect(actor.test({ todo: true })).resolves.toEqual({ todo: true }); // TODO
    });

    it('should run', () => {
      return expect(actor.run({ todo: true })).resolves.toMatchObject({ todo: true }); // TODO
    });
  });
});
