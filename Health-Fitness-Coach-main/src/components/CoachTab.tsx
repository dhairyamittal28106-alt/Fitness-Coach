import { useState, useRef, useEffect, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useGlobalModelLoader } from '../hooks/useGlobalModelLoader';
import { ModelBanner } from './ModelBanner';
import { GeminiService } from '../services/GeminiService';

interface Message {
    role: 'user' | 'assistant';
    text: string;
}

const SYSTEM_PROMPT = "You are an expert Health & Fitness Coach. You provide concise, actionable advice on exercise, nutrition, and wellness. Always be encouraging but realistic.";

export function CoachTab() {
    const loader = useGlobalModelLoader(ModelCategory.Language);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [generating, setGenerating] = useState(false);
    const cancelRef = useRef<(() => void) | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    // Pre-load model on mount
    useEffect(() => {
        loader.ensure();
    }, []); // Run only once on mount


    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || generating) return;

        if (loader.state !== 'ready') {
            const ok = await loader.ensure();
            if (!ok) return;
        }

        setInput('');
        setMessages((prev) => [...prev, { role: 'user', text }]);
        setGenerating(true);

        const assistantIdx = messages.length + 1;
        setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);

        const isCloudEnabled = localStorage.getItem('fitness-ai-cloud-mode') !== 'false';

        try {
            if (isCloudEnabled && GeminiService.isSupported) {
                // Intelligent Processing Active

                let accumulated = '';
                for await (const chunk of GeminiService.chatStream(text, SYSTEM_PROMPT)) {
                    accumulated += chunk;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[assistantIdx] = { role: 'assistant', text: accumulated };
                        return updated;
                    });
                }

                setGenerating(false);
                return;
            }
        } catch (err) {
            console.warn("Cloud processing failed, falling back to local:", err);
        }

        try {
            // Construct prompt with system instructions
            const fullPrompt = `${SYSTEM_PROMPT}\n\nUser: ${text}\nCoach:`;

            const fastMode = localStorage.getItem('fitness-ai-fast-mode') === 'true';

            const { stream, result: resultPromise, cancel } = await TextGeneration.generateStream(fullPrompt, {
                maxTokens: fastMode ? 128 : 256,
                temperature: 0.7,
                stopSequences: ['User:', 'Coach:'],
            });
            cancelRef.current = cancel;

            let accumulated = '';
            for await (const token of stream) {
                accumulated += token;
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[assistantIdx] = { role: 'assistant', text: accumulated };
                    return updated;
                });
            }
            await resultPromise;
        } catch (err) {
            setMessages((prev) => {
                const updated = [...prev];
                let msg = `Error: ${err instanceof Error ? err.message : String(err)}`;
                if (msg.includes("-135")) {
                    msg = "The AI is currently busy or out of memory. Please try again in a few seconds or check your connection.";
                }
                updated[assistantIdx] = { role: 'assistant', text: msg };
                return updated;
            });
        } finally {
            cancelRef.current = null;
            setGenerating(false);
        }
    }, [input, generating, messages.length, loader]);

    return (
        <div className="tab-panel chat-panel">
            <ModelBanner
                state={loader.state}
                progress={loader.progress}
                error={loader.error}
                onLoad={loader.ensure}
                label="Coach AI"
                category={ModelCategory.Language}
            />

            <div className="message-list" ref={listRef}>
                {messages.length === 0 && (
                    <div className="empty-state">
                        <h3>💬 Chat with Coach</h3>
                        <p>Ask about workouts, diet, or lifestyle</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`message message-${msg.role}`}>
                        <div className="message-bubble">
                            <p>{msg.text || '...'}</p>
                        </div>
                    </div>
                ))}
            </div>

            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input
                    type="text"
                    placeholder="Ask your coach..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={generating}
                />
                <button type="submit" className="btn btn-primary" disabled={!input.trim() || generating}>
                    {generating ? '...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
