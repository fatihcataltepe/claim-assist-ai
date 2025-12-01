import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mic, Send, CheckCircle2, Loader2, Phone, FileText, Truck, Bell, Volume2 } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";

const STAGES = [
  { key: 'data_gathering', label: 'Gathering Information', icon: FileText },
  { key: 'coverage_check', label: 'Checking Coverage', icon: CheckCircle2 },
  { key: 'arranging_services', label: 'Arranging Services', icon: Truck },
  { key: 'notification_sent', label: 'Notification Sent', icon: Bell },
];

export default function ClaimSubmission() {
  const navigate = useNavigate();
  const [claimId, setClaimId] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("data_gathering");
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [claimData, setClaimData] = useState<any>(null);
  const [voiceMode, setVoiceMode] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    console.log('ClaimSubmission component mounted');
    initializeClaim();
    
    return () => {
      console.log('ClaimSubmission component unmounting - THIS SHOULD NOT HAPPEN');
    };
  }, []);

  const initializeClaim = async () => {
    try {
      const { data, error } = await supabase
        .from("claims")
        .insert({
          driver_name: "",
          driver_phone: "",
          policy_number: "",
          location: "",
          incident_description: "",
          status: "data_gathering",
        })
        .select()
        .single();

      if (error) throw error;

      setClaimId(data.id);
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm here to help you file your claim. To get started, could you please tell me your name and policy number?",
        },
      ]);
    } catch (error) {
      console.error("Error initializing claim:", error);
      toast.error("Failed to initialize claim");
    }
  };

  const speakText = async (text: string) => {
    if (!voiceMode) return;

    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text, voice: "alloy" },
      });

      if (error) throw error;

      // Convert base64 to audio and play
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
      // Don't show toast for TTS errors to avoid interrupting the flow
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
      
      setCurrentStatus(data.status);
      setClaimData(data.claimData);

      // Speak the assistant's response
      speakText(assistantMessage);

      // If completed, show notification
      console.log('Status received:', data.status);
      if (data.status === "notification_sent" || data.status === "completed") {
        console.log('Notification sent - staying on page');
        setTimeout(() => {
          toast.success("Services arranged! SMS notification sent to your phone.");
          setCurrentStatus("completed");
        }, 2000);
      }
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

  const currentStageIndex = STAGES.findIndex((s) => s.key === currentStatus);
  const progressPercentage = ((currentStageIndex + 1) / STAGES.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <audio ref={audioRef} className="hidden" />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">File a Claim</h1>
            <p className="text-muted-foreground">AI-powered claims assistant</p>
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

        {/* Progress Section */}
        <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Claim Progress</h2>
              <span className="text-sm text-muted-foreground">
                {Math.round(progressPercentage)}% Complete
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const isActive = index <= currentStageIndex;
                const isCurrent = index === currentStageIndex;
                
                return (
                  <div
                    key={stage.key}
                    className={`flex flex-col items-center p-4 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-muted/50 border-2 border-transparent"
                    } ${isCurrent ? "shadow-glow" : ""}`}
                  >
                    <Icon
                      className={`w-8 h-8 mb-2 ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span className={`text-sm font-medium text-center ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {claimData?.is_covered !== undefined && (
              <div className={`mt-4 p-4 rounded-lg ${
                claimData.is_covered 
                  ? "bg-success/10 border border-success/30" 
                  : "bg-destructive/10 border border-destructive/30"
              }`}>
                <p className={`font-semibold ${
                  claimData.is_covered ? "text-success" : "text-destructive"
                }`}>
                  {claimData.is_covered ? "✓ Coverage Confirmed" : "✗ Not Covered"}
                </p>
                <p className="text-sm mt-1">{claimData.coverage_details}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Chat Interface */}
        <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
          <div className="space-y-4">
            {/* Messages */}
            <div className="h-[400px] overflow-y-auto space-y-4 pr-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  } animate-fade-in`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-foreground shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
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
                console.log('Form submitted, preventing default');
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

        {/* Services Panel */}
        {claimData?.arranged_services && claimData.arranged_services.length > 0 && (
          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">Arranged Services</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {claimData.arranged_services.map((service: any, index: number) => (
                  <Card key={index} className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg capitalize">
                          {service.service_type.replace('_', ' ')}
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
      </div>
    </div>
  );
}
