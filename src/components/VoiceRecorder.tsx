import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onRecordingComplete: (transcript: string) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    // For demo purposes, we'll simulate transcription
    // In production, you'd send this to a speech-to-text API
    setTimeout(() => {
      const mockTranscript = "This is a simulated voice message transcription. In production, this would be actual speech-to-text conversion.";
      onRecordingComplete(mockTranscript);
      setIsProcessing(false);
      toast.success("Voice message processed");
    }, 1500);
  };

  return (
    <Card className="p-6 bg-accent/10 border-accent/30 mt-4 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 animate-pulse-glow">
              <div className="w-24 h-24 rounded-full bg-destructive/30"></div>
            </div>
          )}
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className="w-24 h-24 rounded-full relative z-10"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isRecording ? (
              <Square className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>
        </div>

        <div className="text-center">
          <p className="font-semibold">
            {isProcessing
              ? "Processing..."
              : isRecording
              ? "Recording... Tap to stop"
              : "Tap to start recording"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Speak clearly about your incident
          </p>
        </div>

        {!isRecording && !isProcessing && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
