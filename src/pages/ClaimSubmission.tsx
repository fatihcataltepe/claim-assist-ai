import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mic, Send, Loader2, Phone, Truck, Bell, Volume2, Bot, User, Headset } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import ClaimProgress from "@/components/ClaimProgress";
import ClaimDetails from "@/components/ClaimDetails";
import { useClaimRealtime } from "@/hooks/useClaimRealtime";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
  isHumanAgent?: boolean;
}

export default function ClaimSubmission() {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use real-time hook for claim data
  const { claimData, notifications, refetchClaim } = useClaimRealtime(claimId || null);

  useEffect(() => {
    if (!claimId) {
      toast.error("No claim ID provided");
      navigate("/");
      return;
    }
    loadExistingClaim();
  }, [claimId]);

  // Sync messages with real-time claim data updates
  useEffect(() => {
    if (claimData?.conversation_history && Array.isArray(claimData.conversation_history)) {
      setMessages(claimData.conversation_history as Array<{ role: string; content: string }>);
    }
  }, [claimData?.conversation_history]);

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

      // Load conversation history from database or start fresh
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

      // Refetch claim data after processing (real-time will also update it)
      refetchClaim();

      // Speak the assistant's response
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Emergency Roadside Assistance</h1>
            <p className="text-muted-foreground">Your personal assistant for roadside emergencies</p>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Switch
              id="voice-mode"
              checked={voiceMode}
              onCheckedChange={setVoiceMode}
            />
            <Label htmlFor="voice-mode" className="cursor-pointer">
              Voice Mode
            </Label>
          </div>
        </div>

        {/* Progress Section - Now uses real-time data */}
        <ClaimProgress claimData={claimData} currentStatus={currentStatus} />

        {/* Chat Interface */}
        <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
          <div className="space-y-4">
            {/* Messages */}
            <div className="h-[400px] overflow-y-auto space-y-4 pr-4">
              {messages.map((msg, idx) => {
                const isAssistant = msg.role === "assistant";
                const isHumanAgent = (msg as ChatMessage).isHumanAgent;
                
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 ${
                      isAssistant ? "justify-start" : "justify-end"
                    } animate-fade-in`}
                  >
                    {isAssistant && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isHumanAgent ? 'bg-orange-500/10' : 'bg-primary/10'}`}>
                        {isHumanAgent ? (
                          <Headset className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Bot className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        isAssistant
                          ? isHumanAgent
                            ? "bg-orange-500/10 text-foreground border border-orange-500/20"
                            : "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground shadow-md"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold opacity-70 ${isHumanAgent ? 'text-orange-600' : ''}`}>
                          {isAssistant ? (isHumanAgent ? "Human Agent" : "AI Assistant") : "You"}
                        </span>
                        {(msg as ChatMessage).timestamp && (
                          <span className="text-xs opacity-50">
                            {format(new Date((msg as ChatMessage).timestamp!), "HH:mm")}
                          </span>
                        )}
                      </div>
                      <div className={`text-sm ${isAssistant && !isHumanAgent ? "prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0" : "whitespace-pre-wrap"}`}>
                        {isAssistant && !isHumanAgent ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                    {!isAssistant && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted p-4 rounded-2xl flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}
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
                className="transition-smooth"
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>

            {showVoiceRecorder && (
              <VoiceRecorder
                onRecordingComplete={handleVoiceRecorded}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            )}
          </div>
        </Card>

        {/* Claim Details Panel */}
        <ClaimDetails claimData={claimData} />

        {/* Services Panel */}
        {claimData?.arranged_services && Array.isArray(claimData.arranged_services) && claimData.arranged_services.length > 0 && (
          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">Arranged Services</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(claimData.arranged_services as any[]).map((service: any, index: number) => (
                  <Card key={index} className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg capitalize">
                          {service.service_type?.replace('_', ' ') || 'Service'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          service.status === 'dispatched'
                            ? 'bg-success/20 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {service.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Truck className="w-4 h-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">{service.provider_name}</p>
                          </div>
                        </div>

                        {service.provider_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-primary" />
                            <a
                              href={`tel:${service.provider_phone}`}
                              className="text-primary hover:underline"
                            >
                              {service.provider_phone}
                            </a>
                          </div>
                        )}

                        {service.estimated_arrival && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-primary" />
                            <span className="text-muted-foreground">
                              ETA: {service.estimated_arrival} minutes
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Notifications Panel */}
        {notifications.length > 0 && (
          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">Notifications</h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {notifications.map((notification: any, index: number) => (
                  <Card key={index} className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            notification.type === 'sms'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                          }`}>
                            {notification.type.toUpperCase()}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            notification.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                              : notification.status === 'sent'
                              ? 'bg-success/20 text-success'
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                            {notification.status}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">To: <span className="font-medium text-foreground">{notification.recipient}</span></p>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-foreground">{notification.message}</p>
                        </div>

                        {notification.error_message && (
                          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                            <p className="text-xs text-destructive">Error: {notification.error_message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
