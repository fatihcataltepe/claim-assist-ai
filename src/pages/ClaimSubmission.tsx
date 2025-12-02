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
import { Mic, Send, CheckCircle2, XCircle, Loader2, Phone, FileText, Truck, Bell, Volume2 } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";

const STAGES = [
  { key: 'data_gathering', label: 'Gathering Information', icon: FileText },
  { key: 'coverage_check', label: 'Checking Coverage', icon: CheckCircle2 },
  { key: 'arranging_services', label: 'Arranging Services', icon: Truck },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    console.log('ClaimSubmission component mounted');
    initializeClaim();
    
    return () => {
      console.log('ClaimSubmission component unmounting - THIS SHOULD NOT HAPPEN');
    };
  }, []);

  // Sync status from claimData when it updates
  useEffect(() => {
    if (claimData?.status && claimData.status !== currentStatus) {
      console.log('Status sync: updating from', currentStatus, 'to', claimData.status);
      setCurrentStatus(claimData.status);
    }
  }, [claimData?.status]);

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
      
      // Update claim data first
      setClaimData(data.claimData);
      
      // Use status from claimData if available, otherwise fall back to data.status
      const newStatus = data.claimData?.status || data.status;
      console.log('Status update:', { 
        fromResponse: data.status, 
        fromClaimData: data.claimData?.status, 
        using: newStatus 
      });
      
      if (newStatus && newStatus !== currentStatus) {
        setCurrentStatus(newStatus);
      }

      // Fetch notifications if status is arranging_services or completed
      if (data.status === 'arranging_services' || data.status === 'completed') {
        fetchNotifications();
      }

      // Speak the assistant's response
      speakText(assistantMessage);
    } catch (error) {
      console.error("Error processing message:", error);
      toast.error("Failed to process message");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!claimId) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
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

            {claimData?.is_covered !== undefined && currentStatus === 'coverage_check' && (
              <div className={`mt-4 p-4 rounded-lg ${
                claimData.is_covered 
                  ? "bg-success/10 border border-success/30" 
                  : "bg-destructive/10 border border-destructive/30"
              }`}>
                <p className={`font-semibold mb-3 ${
                  claimData.is_covered ? "text-success" : "text-destructive"
                }`}>
                  {claimData.is_covered ? "✓ Coverage Confirmed" : "✗ Not Covered"}
                </p>
                
                {(() => {
                  try {
                    const details = typeof claimData.coverage_details === 'string' 
                      ? JSON.parse(claimData.coverage_details) 
                      : claimData.coverage_details;
                    
                    const formatServiceName = (name: string) => 
                      name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    
                    return (
                      <div className="space-y-3">
                        {details.services_covered?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Covered Services</p>
                            <div className="flex flex-wrap gap-2">
                              {details.services_covered.map((service: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-sm">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {formatServiceName(service)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {details.services_not_covered?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not Covered</p>
                            <div className="flex flex-wrap gap-2">
                              {details.services_not_covered.map((service: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive text-sm">
                                  <XCircle className="w-3.5 h-3.5" />
                                  {formatServiceName(service)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {details.explanation && (
                          <p className="text-sm text-muted-foreground mt-2">{details.explanation}</p>
                        )}
                      </div>
                    );
                  } catch {
                    return <p className="text-sm">{claimData.coverage_details}</p>;
                  }
                })()}
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
