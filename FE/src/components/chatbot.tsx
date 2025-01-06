import React, { useState, useRef, useEffect } from "react";

const Chatbot = () => {
    const [isMinimized, setIsMinimized] = useState<boolean>(true);
    const [input, setInput] = useState<string>("");
    const [chat, setChat] = useState<{ question: string; answer: string }[]>([]);
    const chatHistoryRef = useRef<HTMLDivElement | null>(null);

    const dashboardGreen = "#31b099";

    const actions = [
        { question: "How to initiate a meeting with an expert?", answer: "Go to the 'Chat' section, select an expert, and click 'Request Meeting'." },
        { question: "How to accept a meeting?", answer: "Navigate to the 'Dashboard', locate pending invitations, and click 'Accept'." },
        { question: "How to change my avatar image?", answer: "Go to the 'Profile' section and upload a new image." },
        { question: "What does the calendar do?", answer: "The calendar helps you manage your appointments and availability." },
        { question: "How to change availability (Experts only)?", answer: "Go to the 'Availability' section and update your schedule." },
        { question: "What is the 'Seminar' section?", answer: "The 'Seminar' section lists all scheduled seminars you can join or host." },
    ];

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const matchedAction = actions.find((action) =>
            action.question.toLowerCase().includes(input.toLowerCase())
        );

        if (matchedAction) {
            setChat([...chat, { question: input, answer: matchedAction.answer }]);
        } else {
            setChat([...chat, { question: input, answer: "Sorry, I don't understand the question. Please select an action or type a question." }]);
        }

        setInput("");
    };

    const handleQuickAction = (action: { question: string; answer: string }) => {
        setChat([...chat, { question: action.question, answer: action.answer }]);
    };

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chat]);

    return (
        <div
            className={`chatbot fixed bottom-4 right-4 ${isMinimized ? "bg-green" : "bg-black"}`}
            style={{
                width: isMinimized ? "200px" : "350px",
                height: isMinimized ? "50px" : "500px",
                border: "1px solid #28A745",
                borderRadius: "10px",
                overflow: "hidden",
                transition: "width 0.3s, height 0.3s",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                cursor: isMinimized ? "pointer" : "default",
            }}
            onClick={() => isMinimized && setIsMinimized(false)}
        >
            {isMinimized ? (
                <div className="flex items-center justify-between h-full w-full px-4">
                    <span className="text-white text-lg font-semibold">HelpBot</span>
                    <span className="text-white text-lg font-bold">↑</span>
                </div>
            ) : (
                <div className="h-full flex flex-col text-white">
                    {/* Header */}
                    <div
                        className="flex justify-between items-center px-4 py-2 cursor-pointer"
                        style={{ backgroundColor: dashboardGreen }}
                        onClick={() => setIsMinimized(true)}
                    >
                        <h2 className="text-lg font-semibold">HelpBot</h2>
                        <span className="text-xl font-bold text-white">↓</span>
                    </div>

                    {/* Chat History */}
                    <div
                        ref={chatHistoryRef}
                        className="flex-grow overflow-y-auto p-4 bg-gray-900"
                        style={{
                            border: `1px solid ${dashboardGreen}`,
                            height: "60%",
                        }}
                    >
                        {chat.map((c, index) => (
                            <div key={index} className="mb-4">
                                <p className="text-green-400 font-medium"><strong>You:</strong> {c.question}</p>
                                <p className="text-gray-300"><strong>Bot:</strong> {c.answer}</p>
                            </div>
                        ))}
                        {chat.length === 0 && (
                            <p className="text-gray-500 text-center">Select a quick action or type your question below!</p>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div
                        className="p-4 bg-black overflow-y-auto"
                        style={{
                            maxHeight: "120px", // Adjusted for 2-3 quick actions
                        }}
                    >
                        <h3 className="text-sm font-semibold text-green-400 mb-2">Quick Actions:</h3>
                        <div className="flex flex-col gap-2">
                            {actions.slice(0, 3).map((action, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleQuickAction(action)}
                                    className="bg-gray-800 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-sm shadow"
                                >
                                    {action.question}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input Bar */}
                    <form
                        onSubmit={handleChatSubmit}
                        className="flex items-center p-4 bg-black"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={handleInput}
                            className="flex-grow p-2 bg-gray-800 text-white rounded-l focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Ask me a question..."
                        />
                        <button
                            type="submit"
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-r"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Chatbot;
