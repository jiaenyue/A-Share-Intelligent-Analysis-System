
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat, Content } from "@google/genai";
import { ChatMessage } from '../types/chat';
import { StockData } from '../types/stock';
import { useLanguage } from '../contexts/LanguageContext';

const SYSTEM_INSTRUCTION_EN = `You are an expert AI Financial Advisor for the A-Share (Chinese Stock Market). 
Your goal is to provide professional, data-driven, and risk-aware investment guidance.
You have access to technical indicators, valuation metrics, and market trends provided in the context.
- Be concise and direct.
- Use Markdown for formatting (bold, lists). Do not use HTML tags.
- If the user asks about the current stock, use the provided context.
- DISCLAIMER: Always remind the user that this is for informational purposes only, not financial advice.`;

const SYSTEM_INSTRUCTION_ZH = `你是一位精通 A 股市场的 AI 智能投资顾问。
你的目标是提供专业、数据驱动且关注风险的投资指导。
你可以利用上下文中的技术指标、估值数据和市场趋势进行分析。
- 回答要简洁、直接。
- 使用 Markdown 格式（加粗、列表等）优化排版。不要使用 HTML 标签。
- 当用户询问当前股票时，请基于提供的上下文数据回答。
- 免责声明：始终提醒用户以上信息仅供参考，不构成投资建议。`;

export const useChat = (currentStock: StockData | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const { language } = useLanguage();
  
  // Initialize Chat Session
  const initSession = useCallback(() => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return;

      const ai = new GoogleGenAI({ apiKey });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: language === 'zh' ? SYSTEM_INSTRUCTION_ZH : SYSTEM_INSTRUCTION_EN,
        },
      });
    } catch (e) {
      console.error("Failed to init chat session", e);
    }
  }, [language]);

  // Re-initialize session whenever initSession changes (which happens when language changes)
  useEffect(() => {
    chatSessionRef.current = null; // Force reset
    initSession();
  }, [initSession]);

  // Helper to convert base64 to Part
  const createParts = (text: string, images?: string[]) => {
     const parts: any[] = [{ text }];
     if (images && images.length > 0) {
       images.forEach(img => {
         // Assume img is raw base64 without prefix, or strip it if present
         const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
         parts.push({
           inlineData: {
             mimeType: 'image/png', // Defaulting to png for simplicity, Gemini handles most standard types
             data: base64Data
           }
         });
       });
     }
     return parts;
  };

  const sendMessage = async (text: string, images?: string[]) => {
    if (!chatSessionRef.current) initSession();
    if (!chatSessionRef.current) return;

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      images,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // 2. Prepare Context (if stock changed or for every message to be safe)
      let promptText = text;
      
      // Enforce language in prompt to ensure model switches context immediately even if history was in another language
      const langDirective = language === 'zh' ? "\n(请用中文回答)" : "\n(Please answer in English)";
      
      if (currentStock) {
         const context = `
[Context: User is viewing ${currentStock.name} (${currentStock.code})]
Price: ${currentStock.candles[currentStock.candles.length-1].close}
MA Trend: ${currentStock.candles[currentStock.candles.length-1].ma20 ? 'Available' : 'Calculating'}
`;
         promptText = `${context}\n\nUser Question: ${text}${langDirective}`;
      } else {
         promptText = `${text}${langDirective}`;
      }

      // 3. Create Placeholder for Stream
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      // 4. Stream Response
      const messagePayload = createParts(promptText, images);

      // Pass payload as 'message', not 'parts' or 'content'
      const stream = await chatSessionRef.current.sendMessageStream({ 
          message: messagePayload 
      } as any);

      let fullText = '';
      
      for await (const chunk of stream) {
        const chunkText = chunk.text; // Access .text directly per guidelines
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => 
            msg.id === botMsgId 
              ? { ...msg, content: fullText }
              : msg
          ));
        }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (err) {
      console.error("Chat Error", err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: language === 'zh' ? "抱歉，我遇到了一些问题，请稍后再试。" : "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
        isStreaming: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    chatSessionRef.current = null;
    initSession(); // Re-init to clear backend history context
  };

  return { messages, sendMessage, loading, clearHistory };
};
