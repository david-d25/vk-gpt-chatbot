import axios, {AxiosResponse} from "axios";
import ConfigService from "service/ConfigService";
import {Context} from "../Context";

export default class ChatGptService {

    private config!: ConfigService;

    constructor(context: Context) {
        context.onReady(() => {
            this.config = context.configService!;
        });
    }

    private apiUrl = "https://api.openai.com/v1/chat/completions";
    private jsonMediaType = "application/json; charset=utf-8";

    async request(
        systemMessage: string,
        chatMessages: {
            role: string,
            name?: string,
            content: string
        }[],
        model: string,
        maxTokens: number,
        temperature: number,
        topP: number,
        frequencyPenalty: number,
        presencePenalty: number
    ): Promise<string> {
        const messages = [];

        messages.push({
            role: "system",
            content: systemMessage
        });

        chatMessages.forEach(message => {
            messages.push({
                role: message.role,
                name: message.name,
                content: message.content
            });
        });

        const body: any = {};
        body['messages'] = messages;
        body['model'] = model;
        body['max_tokens'] = maxTokens;
        body['temperature'] = temperature;
        body['top_p'] = topP;
        body['frequency_penalty'] = frequencyPenalty;
        body['presence_penalty'] = presencePenalty;
        body['n'] = 1;

        const key = this.config.getEnv('OPENAI_SECRET_KEY');
        const config = {
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': this.jsonMediaType
            }
        }

        let result = "";
        try {
            const response = await axios.post(this.apiUrl, body, config);
            result = this.parseResponse(response);
        } catch (e) {
            console.error(e);
        }
        return result;
    }

    private parseResponse(response: AxiosResponse): string {
        return response.data['choices'][0]['message']['content'];
    }
}