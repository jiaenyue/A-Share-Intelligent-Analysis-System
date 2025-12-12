import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { StockData } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatWidgetProps {
  currentStock: StockData | null;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ currentStock }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, loading, clearHistory } = useChat(currentStock);
  const { t, language } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!inputValue.trim() && !selectedImage) return;
    sendMessage(inputValue, selectedImage ? [selectedImage] : undefined);
    setInputValue('');
    setSelectedImage(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Advanced Markdown Parser ---
  const formatInline = (text: string) => {
    // 0. Pre-process: Handle AI potentially returning HTML tags instead of Markdown
    // We convert common HTML tags to Markdown before escaping to ensure they render correctly
    let processed = text
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        .replace(/<i>(.*?)<\/i>/g, '*$1*');

    // 1. Escape HTML first to prevent broken layout from symbols like < or >
    let formatted = processed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Bold **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 3. Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 4. Inline Code `text`
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded font-mono text-xs text-red-500 dark:text-red-300">$1</code>');
    
    return formatted;
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // --- Code Block Handling ---
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                elements.push(
                    <div key={`code-${idx}`} className="bg-gray-800 text-gray-200 p-3 rounded-lg my-2 overflow-x-auto font-mono text-xs">
                        <pre>{codeBuffer.join('\n')}</pre>
                    </div>
                );
                codeBuffer = [];
                inCodeBlock = false;
            } else {
                // Start of code block
                inCodeBlock = true;
            }
            return;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            return;
        }

        // --- Regular Content Parsing ---

        // 1. Headers
        if (line.startsWith('### ')) {
            elements.push(<h4 key={idx} className="font-bold text-sm mt-3 mb-1 text-gray-800 dark:text-gray-100">{formatInline(line.substring(4))}</h4>);
            return;
        }
        if (line.startsWith('## ')) {
            elements.push(<h3 key={idx} className="font-bold text-base mt-4 mb-2 text-primary-light dark:text-primary-dark">{formatInline(line.substring(3))}</h3>);
            return;
        }

        // 2. Unordered Lists (- or *)
        if (trimmed.match(/^[-*]\s/)) {
            elements.push(
                <div key={idx} className="flex gap-2 ml-1 my-1">
                    <span className="text-primary-light font-bold mt-1.5">•</span>
                    <span className="flex-1 leading-relaxed" dangerouslySetInnerHTML={{__html: formatInline(trimmed.substring(2))}} />
                </div>
            );
            return;
        }

        // 3. Ordered Lists (1. )
        const orderedMatch = trimmed.match(/^(\d+)\.\s/);
        if (orderedMatch) {
             const num = orderedMatch[1];
             const content = trimmed.replace(/^(\d+)\.\s/, '');
             elements.push(
                <div key={idx} className="flex gap-2 ml-1 my-1">
                    <span className="text-primary-light font-mono font-bold mt-0.5">{num}.</span>
                    <span className="flex-1 leading-relaxed" dangerouslySetInnerHTML={{__html: formatInline(content)}} />
                </div>
            );
            return;
        }

        // 4. Horizontal Rule
        if (trimmed === '---' || trimmed === '***') {
            elements.push(<hr key={idx} className="my-3 border-gray-200 dark:border-gray-600" />);
            return;
        }

        // 5. Empty Lines (Spacing)
        if (trimmed === '') {
            elements.push(<div key={idx} className="h-2" />);
            return;
        }

        // 6. Paragraphs
        elements.push(
            <p key={idx} className="leading-relaxed mb-1" dangerouslySetInnerHTML={{__html: formatInline(line)}} />
        );
    });

    // Handle unclosed code block (e.g., during streaming)
    if (inCodeBlock && codeBuffer.length > 0) {
         elements.push(
            <div key="code-incomplete" className="bg-gray-800 text-gray-200 p-3 rounded-lg my-2 overflow-x-auto font-mono text-xs opacity-80">
                <pre>{codeBuffer.join('\n')}</pre>
            </div>
        );
    }

    return elements;
  };

  const suggestions = [
      language === 'zh' ? "分析当前股票趋势" : "Analyze current trend",
      language === 'zh' ? "有什么风险？" : "What are the risks?",
      language === 'zh' ? "长期投资价值如何？" : "Long-term value?",
      language === 'zh' ? "解释一下MACD指标" : "Explain MACD indicator"
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all transform hover:scale-105 ${
            isOpen ? 'bg-red-500 rotate-90' : 'bg-primary-light dark:bg-primary-dark'
        } text-white`}
      >
        {isOpen ? (
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {/* Chat Panel */}
      <div 
        className={`fixed bottom-24 right-6 w-96 max-w-[90vw] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-40 transition-all duration-300 origin-bottom-right flex flex-col ${
            isOpen ? 'opacity-100 scale-100 pointer-events-auto h-[600px]' : 'opacity-0 scale-90 pointer-events-none h-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">AI</div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Gemini 3 Pro</h3>
                    <p className="text-xs text-green-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Online
                    </p>
                </div>
            </div>
            <button onClick={clearHistory} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Clear Chat">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
                        {language === 'zh' ? '我是您的 AI 投资顾问。请问有什么可以帮您？' : 'I am your AI Investment Advisor. How can I help you today?'}
                    </p>
                    <div className="grid grid-cols-1 gap-2 w-full px-4">
                        {suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => sendMessage(s)}
                                className="text-xs py-2 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-left"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-primary-light dark:bg-primary-dark text-white rounded-tr-none' 
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-600'
                    }`}>
                        {msg.images && msg.images.length > 0 && (
                            <div className="mb-2">
                                <img src={msg.images[0]} alt="Upload" className="max-w-full rounded-lg max-h-32 object-cover" />
                            </div>
                        )}
                        <div className="text-sm">
                            {renderMarkdown(msg.content)}
                        </div>
                    </div>
                </div>
            ))}
            
            {loading && !messages.some(m => m.isStreaming) && (
                 <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-none px-4 py-3 border border-gray-100 dark:border-gray-600">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            {selectedImage && (
                <div className="mb-2 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg w-fit">
                    <img src={selectedImage} alt="Selected" className="w-8 h-8 object-cover rounded" />
                    <span className="text-xs text-gray-500 truncate max-w-[150px]">Image attached</span>
                    <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
                    title="Upload Image"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                />
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={language === 'zh' ? "输入消息..." : "Type a message..."}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                    disabled={loading}
                />
                <button 
                    onClick={handleSend}
                    disabled={loading || (!inputValue.trim() && !selectedImage)}
                    className="p-2 bg-primary-light dark:bg-primary-dark text-white rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </div>
        </div>
      </div>
    </>
  );
};

export default ChatWidget;