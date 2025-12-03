import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mic, Send, Loader2, Volume2 } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import ClaimProgress from "@/components/ClaimProgress";
import ClaimSidebar from "@/components/ClaimSidebar";
import { useClaimRealtime } from "@/hooks/useClaimRealtime";
import ReactMarkdown from "react-markdown";

export default function ClaimSubmission() {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { claimData, notifications, refetchClaim } = useClaimRealtime(claimId || null);

  useEffect(() => {
    if (!claimId) {
      toast.error("No claim ID provided");
      navigate("/");
      return;
    }
    loadExistingClaim();
  }, [claimId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadExistingClaim = async () => {
    if (!claimId) return;
    
    setIsInitializing(true);
    try {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .eq("id", claimId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Claim not found");
        navigate("/");
        return;
      }

      if (data.conversation_history && Array.isArray(data.conversation_history) && data.conversation_history.length > 0) {
        setMessages(data.conversation_history as Array<{ role: string; content: string }>);
      } else {
        setMessages([
          {
            role: "assistant",
            content: "Hello! I'm here to help you file your claim. To get started, could you please tell me your name and policy number?",
          },
        ]);
      }
    } catch (error) {
      console.error("Error loading claim:", error);
      toast.error("Failed to load claim");
      navigate("/");
    } finally {
      setIsInitializing(false);
    }
  };

  const speakText = async (text: string) => {
    if (!voiceMode) return;

    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text, voice: "alloy" },
      });

      if (error) throw error;

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (error) {
      console.error("Error speaking text:", error);
    }
  };

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || !claimId) return;

    const userMessage = { role: "user", content: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("process-claim", {
        body: {
          claimId,
          userMessage: messageToSend,
          conversationHistory: messages,
        },
      });

      if (error) throw error;

      const assistantMessage = data.message;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantMessage },
      ]);

      refetchClaim();
      speakText(assistantMessage);
    } catch (error) {
      console.error("Error processing message:", error);
      toast.error("Failed to process message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceRecorded = (transcript: string) => {
    handleSendMessage(transcript);
    setShowVoiceRecorder(false);
  };

  const currentStatus = claimData?.status || "data_gathering";

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">Loading claim...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <audio ref={audioRef} className="hidden" />
      
      {/* Expandable Side Panel */}
      <ClaimSidebar claimData={claimData} notifications={notifications} />
      
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Emergency Roadside Assistance</h1>
            <p className="text-sm text-muted-foreground">Your personal assistant for roadside emergencies</p>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Switch id="voice-mode" checked={voiceMode} onCheckedChange={setVoiceMode} />
            <Label htmlFor="voice-mode" className="cursor-pointer text-sm">Voice Mode</Label>
          </div>
        </div>

        {/* Progress Section */}
        <ClaimProgress claimData={claimData} currentStatus={currentStatus} />

        {/* Chat Interface */}
        <Card className="p-4 bg-card/80 backdrop-blur border-primary/20 shadow-lg flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-foreground shadow-sm prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-2xl flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              variant="outline"
              size="icon"
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Button type="submit" disabled={isLoading || !inputMessage.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>

          {showVoiceRecorder && (
            <div className="mt-2">
              <VoiceRecorder
                onRecordingComplete={handleVoiceRecorded}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}