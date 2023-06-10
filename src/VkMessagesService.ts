import {VkMessage} from "./VkMessage";
import {VK} from "vk-io";
import VkMessagesOrmService from "./VkMessagesOrmService";

export default class VkMessagesService {
    constructor (
        private vk: VK,
        private messagesOrmService: VkMessagesOrmService
    ) {}

    private messagesByPeerId: Map<number, VkMessage[]> = new Map();

    start() {
        this.vk.updates.start().then(() => {
            console.log("Started");
        }).catch(error => {
            console.error('Error starting Long Polling:', error);
        });

        this.vk.updates.on('message_new', async (context, next) => {
            const { conversationMessageId, senderId, peerId, text, createdAt } = context;

            if (!this.messagesByPeerId.has(peerId))
                this.messagesByPeerId.set(peerId, []);

            const peerMessages = this.messagesByPeerId.get(peerId)!;
            const message = {
                conversationMessageId: conversationMessageId!,
                peerId: peerId,
                fromId: senderId,
                timestamp: createdAt,
                text: typeof text == 'undefined' ? null : text
            };

            console.log(`Got message from id ${message.fromId}: '${message.text}'`);

            if (context.attachments.length > 0) {
                if (message.text == null)
                    message.text = '';
                for (const attachment of context.attachments) {
                    message.text += ` (attachment: ${attachment.type})`;
                }
            }

            peerMessages.push(message);

            await this.messagesOrmService.addMessage(message);
            await next();
        });

        this.vk.updates.on('error', error => {
            console.error('Error in updates:', error);
        });
    }

    popSinglePeerIdMessages(): VkMessage[] {
        if (this.messagesByPeerId.size == 0)
            return [];
        const key = this.messagesByPeerId.keys().next().value;
        const result = this.messagesByPeerId.get(key)!;
        this.messagesByPeerId.delete(key);
        return result;
    }

    async getHistory(peerId: number, count: number): Promise<VkMessage[]> {
        return (await this.messagesOrmService.getMessagesByPeerIdWithLimitSortedByTimestamp(peerId, count)).reverse();
    }

    async send(toId: number, message: string) {
        await this.vk.api.messages.send({
            peer_id: toId,
            random_id: Math.floor(Math.random()*10000000),
            message
        }).then(async (res) => {
            await this.messagesOrmService.addMessage({
                fromId: 0,
                conversationMessageId: res,
                peerId: toId,
                text: message,
                timestamp: new Date().getTime()/1000
            });
            console.log(`Sent message to id ${toId}: '${message}'`);
        }).catch(e => {
            console.error(`Failed to send message to id ${toId}: '${message}'`, e);
        });
    }
}