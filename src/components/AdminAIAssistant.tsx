import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Minimize2, Maximize2, Send, Loader2, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AdminAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("analytics-assistant", {
        body: { 
          message: userMessage,
          conversationHistory: messages
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to get response from AI assistant");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-6 right-6 z-50 shadow-2xl border-primary/20 transition-all duration-300",
        isMinimized ? "w-72 h-14" : "w-96 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Analytics Assistant</h3>
            {!isMinimized && (
              <p className="text-xs text-muted-foreground">Ask about claims data</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <>
          <ScrollArea className="flex-1 h-[380px] p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Bot className="h-12 w-12 mb-4 text-primary/30" />
                <p className="text-sm font-medium mb-2">Hi! I'm your analytics assistant.</p>
                <p className="text-xs">Ask me about claims, coverage rates, trends, or any data insights.</p>
                <div className="mt-4 space-y-2">
                  <button
                    className="text-xs text-primary hover:underline block"
                    onClick={() => setInput("What's the current coverage rate?")}
                  >
                    "What's the current coverage rate?"
                  </button>
                  <button
                    className="text-xs text-primary hover:underline block"
                    onClick={() => setInput("Show me recent claim trends")}
                  >
                    "Show me recent claim trends"
                  </button>
                  <button
                    className="text-xs text-primary hover:underline block"
                    onClick={() => setInput("How many active claims do we have?")}
                  >
                    "How many active claims do we have?"
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about claims data..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
