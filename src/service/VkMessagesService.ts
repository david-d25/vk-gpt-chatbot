import {Attachment, ExternalAttachment, PhotoAttachment, VK} from "vk-io";
import VkMessagesOrmService from "orm/VkMessagesOrmService";
import {Context} from "../Context";

export type VkMessage = {
    conversationMessageId: number;
    peerId: number;
    fromId: number;
    timestamp: number;
    attachments: (Attachment | ExternalAttachment)[];
    text: string | null;
}

export default class VkMessagesService {
    private static readonly MAX_ATTACHMENTS_PER_MESSAGE = 10;
    private vk!: VK;
    private messagesOrmService!: VkMessagesOrmService;

    constructor (private context: Context) {
        context.onReady(this.start.bind(this));
    }

    private messagesByPeerId: Map<number, VkMessage[]> = new Map();

    private start() {
        this.vk = this.context.vk!;
        this.messagesOrmService = this.context.vkMessagesOrmService!;

        this.vk.updates.start().then(() => {
            console.log("Started VK messages long polling");
        }).catch(error => {
            console.error('Error starting Long Polling:', error);
        });

        this.vk.updates.on('message_new', async (context, next) => {
            const { conversationMessageId, senderId, peerId, text, createdAt } = context;

            if (!this.messagesByPeerId.has(peerId))
                this.messagesByPeerId.set(peerId, []);

            const peerMessages = this.messagesByPeerId.get(peerId)!;
            const message: VkMessage = {
                conversationMessageId: conversationMessageId!,
                peerId: peerId,
                fromId: senderId,
                timestamp: createdAt,
                attachments: [],
                text: typeof text == 'undefined' ? null : text
            };

            console.log(`Got message from id ${message.fromId}: '${message.text}'`);

            if (context.attachments.length > 0) {
                if (message.text == null)
                    message.text = '';
                for (const i in context.attachments) {
                    const attachment = context.attachments[i];
                    message.attachments.push(attachment);
                    message.text += ` (attachment:${attachment.type}, id=${i})`;
                }
            }

            peerMessages.push(message);

            await this.messagesOrmService!.addMessage(message);
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
        return (await this.messagesOrmService!.getMessagesByPeerIdWithLimitSortedByTimestamp(peerId, count)).reverse();
    }

    async send(toId: number, message: string, attachedImageUrls: string[] = []) {
        let requestBody = {
            peer_id: toId,
            random_id: Math.floor(Math.random()*10000000),
            message,
            attachment: undefined as string | undefined
        };

        try {
            if (attachedImageUrls.length > 0) {
                const uploadServerResponse = await this.vk.api.photos.getMessagesUploadServer({});
                const uploadServerUrl = uploadServerResponse.upload_url;

                function photoToString(photo: PhotoAttachment) {
                    return `photo${photo.ownerId}_${photo.id}${photo.accessKey ? `_${photo.accessKey}` : ''}`;
                }

                const attachments = await Promise.all(
                    attachedImageUrls.map(url => this.vk.upload.messagePhoto({
                        peer_id: toId,
                        source: {
                            uploadUrl: uploadServerUrl,
                            values: [{
                                value: url
                            }]
                        }
                    }))
                );
                requestBody.attachment = attachments.map(photoToString).join(',');
            }
        } catch (e) {
            console.error('Failed to attach image:', e);
            requestBody.message += "\n\n(не получилось прикрепить картинку)";
        }

        await this.vk.api.messages.send(requestBody).then(async (res) => {
            await this.messagesOrmService.addMessage({
                fromId: 0,
                conversationMessageId: res,
                peerId: toId,
                text: message,
                attachments: [],
                timestamp: new Date().getTime()/1000
            });
            console.log(`Sent message to id ${toId}: '${message}'`);
        }).catch(e => {
            console.error(`Failed to send message to id ${toId}: '${message}'`, e);
        });
    }
}