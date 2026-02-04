import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiApi } from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import './AiChat.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface AiChatProps {
  // İçerik sayfasında kullanılacaksa
  contentId?: number;
  contentTitle?: string;
  contentType?: string;
  contentDescription?: string;
}

export const AiChat: React.FC<AiChatProps> = ({
  contentId,
  contentTitle,
  contentType,
  contentDescription,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // İlk açılışta hoşgeldin mesajı
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: '0',
        role: 'assistant',
        content: contentTitle 
          ? `Merhaba! "${contentTitle}" hakkında ne bilmek istersin?`
          : 'Merhaba! Ben Saga AI asistanıyım. Film, dizi ve kitaplar hakkında sorular sorabilir, öneri alabilir veya platformda yardım isteyebilirsin.',
        timestamp: new Date(),
        suggestions: contentTitle 
          ? ['Bu içeriğin konusu ne?', 'Oyuncular/Yazarlar kimler?', 'Benzer içerikler öner']
          : ['Film öner', 'Kütüphaneme nasıl eklerim?', 'En popüler diziler neler?'],
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, contentTitle, messages.length]);

  // Yeni mesaj geldiğinde scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText]);

  // Typing efekti
  useEffect(() => {
    if (!typingMessageId) return;
    
    const message = messages.find(m => m.id === typingMessageId);
    if (!message) return;
    
    const fullText = message.content;
    if (displayedText.length >= fullText.length) {
      setTypingMessageId(null);
      return;
    }
    
    const timer = setTimeout(() => {
      setDisplayedText(fullText.slice(0, displayedText.length + 1));
    }, 15); // Her 15ms'de bir karakter
    
    return () => clearTimeout(timer);
  }, [typingMessageId, displayedText, messages]);

  // Chat açıldığında input'a focus
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // İçerik sayfasındaysak content-question kullan
      if (contentTitle && contentType) {
        const contentResponse = await aiApi.askAboutContent(
          contentId,
          contentTitle,
          contentType,
          messageText,
          contentDescription
        );
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: contentResponse.answer,
          timestamp: new Date(),
          suggestions: contentResponse.relatedQuestions,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Asistan modu - sohbet geçmişi ile
        console.log('🎯 Asistan modu - sorgu:', messageText);
        
        // Önceki mesajları hazırla (welcome mesajı hariç, son 10 mesaj)
        const chatHistory = messages
          .filter(m => m.id !== '0') // Welcome mesajını hariç tut
          .slice(-10) // Son 10 mesaj
          .map(m => ({ role: m.role, content: m.content }));
        
        const assistantResponse = await aiApi.assistant(messageText, location.pathname, chatHistory);
        console.log('📥 Asistan yanıtı alındı:', assistantResponse);
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantResponse.message,
          timestamp: new Date(),
          suggestions: assistantResponse.suggestions,
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Typing efektini başlat
        setDisplayedText('');
        setTypingMessageId(assistantMessage.id);

        // Aksiyon varsa yönet
        if (assistantResponse.action === 'navigate' && assistantResponse.actionData?.url) {
          setTimeout(() => {
            navigate(assistantResponse.actionData!.url as string);
          }, 1500);
        } else if (assistantResponse.action === 'search' && assistantResponse.actionData?.query) {
          // Arama aksiyonu - keşfet sayfasına query ile yönlendir
          setTimeout(() => {
            const searchQuery = assistantResponse.actionData!.query as string;
            navigate(`/kesfet?q=${encodeURIComponent(searchQuery)}`);
            setIsOpen(false); // Chat'i kapat
          }, 1500);
        }
      }
    } catch (error) {
      console.error('❌ AI Chat hatası:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, contentId, contentTitle, contentType, contentDescription, messages, location.pathname, navigate]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    // Welcome mesajını tekrar ekle
    const welcomeMessage: ChatMessage = {
      id: '0',
      role: 'assistant',
      content: contentTitle 
        ? `"${contentTitle}" hakkında ne bilmek istersin?`
        : 'Sohbet temizlendi. Yeni bir konuya başlayabilirsin!',
      timestamp: new Date(),
      suggestions: contentTitle 
        ? ['Bu içeriğin konusu ne?', 'Oyuncular/Yazarlar kimler?', 'Benzer içerikler öner']
        : ['Film öner', 'Kütüphaneme nasıl eklerim?', 'En popüler diziler neler?'],
    };
    setMessages([welcomeMessage]);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className={`ai-chat-fab ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="AI Asistan"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-chat-panel glass">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-info">
              <span className="ai-chat-avatar">🤖</span>
              <div>
                <h3>Saga AI</h3>
                <span className="ai-chat-status">
                  {isLoading ? 'Yazıyor...' : 'Çevrimiçi'}
                </span>
              </div>
            </div>
            <div className="ai-chat-header-actions">
              <button className="ai-chat-clear" onClick={clearChat} title="Sohbeti Temizle">
                🗑️
              </button>
              <button className="ai-chat-close" onClick={() => setIsOpen(false)} title="Kapat">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-chat-message ${msg.role}`}>
                <div className="ai-chat-message-content">
                  {/* Typing efekti: aktif mesaj için displayedText göster */}
                  {msg.id === typingMessageId ? (
                    <>
                      {displayedText}
                      <span className="typing-cursor">|</span>
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
                {/* Suggestions sadece typing bittikten sonra göster */}
                {msg.suggestions && msg.suggestions.length > 0 && msg.id !== typingMessageId && (
                  <div className="ai-chat-suggestions">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="ai-chat-suggestion"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="ai-chat-message assistant">
                <div className="ai-chat-message-content typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              placeholder={contentTitle ? `"${contentTitle}" hakkında sor...` : 'Bir şey sor...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="ai-chat-send"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChat;
