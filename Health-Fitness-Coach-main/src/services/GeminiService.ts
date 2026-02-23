/**
 * GeminiService.ts
 * Reliable service for Gemini 1.5 Flash API calls (Text and Vision).
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export class GeminiService {
    private static apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;

    static get isSupported(): boolean {
        return !!this.apiKey && navigator.onLine;
    }

    /**
     * Chat completion with streaming support
     */
    static async *chatStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
        const contents = [];
        if (systemPrompt) {
            contents.push({ role: "user", parts: [{ text: `System Instruction: ${systemPrompt}\n\nUser: ${prompt}` }] });
        } else {
            contents.push({ role: "user", parts: [{ text: prompt }] });
        }

        const url = `${GEMINI_API_URL.replace("generateContent", "streamGenerateContent")}?alt=sse&key=${this.apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini Streaming API Error (${response.status}): ${errText || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body to read");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("data: ")) {
                    const jsonStr = trimmedLine.substring(6).trim();
                    if (!jsonStr) continue;
                    try {
                        const json = JSON.parse(jsonStr);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) yield text;
                    } catch (e) {
                        console.warn("[GeminiService] SSE Parse Error:", e);
                    }
                }
            }
        }
    }

    /**
     * Non-streaming chat for simple needs (though we'll favor streaming)
     */
    static async chat(prompt: string, systemPrompt?: string): Promise<string> {
        let full = "";
        for await (const chunk of this.chatStream(prompt, systemPrompt)) {
            full += chunk;
        }
        return full;
    }

    /**
     * Vision analysis (Image + Text)
     */
    static async vision(
        prompt: string,
        imageBuffer: Uint8Array,
        width: number,
        height: number
    ): Promise<string> {
        // Convert RGB buffer to Base64 (Gemini expects JPEG/PNG or data URI)
        // For simplicity, we'll convert the RGB buffer to a Canvas and then a Data URL
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context");

        const imgData = ctx.createImageData(width, height);
        for (let i = 0; i < imageBuffer.length; i++) {
            imgData.data[i] = imageBuffer[i];
        }
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64Data = dataUrl.split(",")[1];

        const body = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Data,
                            },
                        },
                    ],
                },
            ],
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}
