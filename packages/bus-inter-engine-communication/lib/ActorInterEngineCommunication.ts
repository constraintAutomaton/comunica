import { Actor, IAction, IActorArgs, IActorOutput, IActorTest, Mediate } from '@comunica/core';
import { IMessage, IChannel } from './types';

/**
 * A comunica actor for inter-engine-communication events.
 *
 * Actor types:
 * * Input:  IActionInterEngineCommunication:      TODO: fill in.
 * * Test:   <none>
 * * Output: IActorInterEngineCommunicationOutput: TODO: fill in.
 *
 * @see IActionInterEngineCommunication
 * @see IActorInterEngineCommunicationOutput
 */
export abstract class ActorInterEngineCommunication extends Actor<IActionInterEngineCommunication, IActorTest, IActorInterEngineCommunicationOutput> {
  /**
   * Channels available to the engine.
   * @type {Map<string, IChannel>}
   */
  protected channels: Map<string, IChannel>;
  /**
  * @param args - @defaultNested {<default_bus> a <cc:components/Bus.jsonld#Bus>} bus
  */
  public constructor(args: IActorInterEngineCommunicationArgs) {
    super(args);
  }
  /**
   * A function to send a @type {IMessage} to a @type {IChannel}.
   * @param message {IMessage} - The message to be send
   * @param channelName {string} - The @type {IChannel}
   * 
   * @returns {Promise<undefined | Error>} Returns an error if the message was not sent successfully
   */
  abstract send(message: IMessage, channelName: string): Promise<undefined | Error>;
  /**
   * A function to wait for a @type {IMessage} from a @type {IChannel}
   * @param channelName {string} - name of the channel to wait from
   * @param timeout {number | undefined} - maximum time to wait for the message, if sent to undefined
   * then the wait time is infinite
   * @returns {Promise<IMessage | Error>} returns the @type {IMessage} or an error
   */
  abstract recv(channelName: string, timeout: number | undefined): Promise<IMessage | Error>;
}

export interface IActionInterEngineCommunication extends IAction {

}

export interface IActorInterEngineCommunicationOutput extends IActorOutput {

}

export type IActorInterEngineCommunicationArgs = IActorArgs<
  IActionInterEngineCommunication, IActorTest, IActorInterEngineCommunicationOutput>;

export type MediatorInterEngineCommunication = Mediate<
  IActionInterEngineCommunication, IActorInterEngineCommunicationOutput>;
