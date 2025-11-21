import React, { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
}

interface GeminiModel {
    name: string;
    displayName: string;
    description: string;
}

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [models, setModels] = useState<GeminiModel[]>([]);
    const [selectedModel, setSelectedModel] = useState('gemini-pro');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load available models on mount
    useEffect(() => {
        const loadModels = async () => {
            if (window.electronAPI?.listGeminiModels) {
                const availableModels = await window.electronAPI.listGeminiModels();
                if (availableModels && availableModels.length > 0) {
                    setModels(availableModels);
                    // Automatically select the first available model
                    setSelectedModel(availableModels[0].name);
                }
            }
        };
        loadModels();
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            if (window.electronAPI) {
                const response = await window.electronAPI.chatWithGemini({
                    message: userMessage.content,
                    history,
                    model: selectedModel,
                });

                const modelMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: response,
                };
                setMessages((prev) => [...prev, modelMessage]);
            } else {
                // Fallback for browser dev mode (mock)
                setTimeout(() => {
                    setMessages((prev) => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'model',
                        content: "I'm a mock Gemini response. Please run in Electron to use real API.",
                    }]);
                }, 1000);
            }
        } catch (error: any) {
            console.error(error);
            setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: `Error: ${error.message || 'Failed to get response'}`,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <header className="p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <h2 className="text-lg font-semibold">Gemini Chat</h2>
                    {models.length > 0 && (
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            {models.map((model) => (
                                <option key={model.name} value={model.name}>
                                    {model.displayName}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            <div className="flex-1 p-4 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20">
                            <p className="text-xl">Welcome to Electron AI</p>
                            <p className="text-sm mt-2">Configure your API keys in Settings to start chatting.</p>
                            {selectedModel && (
                                <p className="text-xs mt-4 text-gray-600">Using model: {selectedModel}</p>
                            )}
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-800/50 backdrop-blur">
                <div className="relative max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        className="w-full bg-gray-900 border border-gray-600 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500 transition-colors pr-12 text-white placeholder-gray-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;
