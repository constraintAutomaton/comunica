import { ActorInterEngineCommunication, IActionInterEngineCommunication, IActorInterEngineCommunicationOutput, IActorInterEngineCommunicationArgs } from '@comunica/bus-inter-engine-communication';
import { IActorArgs, IActorTest } from '@comunica/core';

/**
 * A Comunica module to communicate between engines using websockets
 */
export class ActorInterEngineCommunicationInterEngineCommunicationWebsocket extends ActorInterEngineCommunication {
  public constructor(args: IActorInterEngineCommunicationArgs) {
    super(args);
  }

  public async test(action: IActionInterEngineCommunication): Promise<IActorTest> {
    return true; // TODO implement
  }

  public async run(action: IActionInterEngineCommunication): Promise<IActorInterEngineCommunicationOutput> {
    return true; // TODO implement
  }
}
