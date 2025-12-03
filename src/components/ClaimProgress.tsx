import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, FileText, Truck, FileCheck } from "lucide-react";

const STAGES = [
  { key: 'data_gathering', label: 'Gathering Information', icon: FileText },
  { key: 'coverage_check', label: 'Checking Coverage', icon: FileCheck },
  { key: 'arranging_services', label: 'Arranging Services', icon: Truck },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
];

interface ClaimProgressProps {
  claimData: any;
  currentStatus: string;
}

export default function ClaimProgress({ claimData, currentStatus }: ClaimProgressProps) {
  const currentStageIndex = STAGES.findIndex((s) => s.key === currentStatus);
  const progressPercentage = ((currentStageIndex + 1) / STAGES.length) * 100;

  const formatServiceName = (name: string) =>
    name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Parse coverage details if it's a string
  const getCoverageDetails = () => {
    if (!claimData?.coverage_details) return null;
    try {
      return typeof claimData.coverage_details === 'string'
        ? JSON.parse(claimData.coverage_details)
        : claimData.coverage_details;
    } catch {
      return null;
    }
  };

  const coverageDetails = getCoverageDetails();

  // Show coverage info when we have coverage decision (coverage_check or later stages)
  const showCoverageInfo = claimData?.is_covered !== undefined && claimData?.is_covered !== null;

  return (
    <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
      <div className="space-y-4">
        {/* Progress Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Claim Progress</h2>
          <span className="text-sm text-muted-foreground">
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>
        <Progress value={progressPercentage} className="h-3" />

        {/* Stage Indicators */}
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

        {/* Coverage Status */}
        {showCoverageInfo && (
          <div className={`mt-6 p-4 rounded-lg ${
            claimData.is_covered
              ? "bg-success/10 border border-success/30"
              : "bg-destructive/10 border border-destructive/30"
          }`}>
            <p className={`font-semibold mb-3 ${
              claimData.is_covered ? "text-success" : "text-destructive"
            }`}>
              {claimData.is_covered ? "✓ Coverage Confirmed" : "✗ Not Covered"}
            </p>

            {coverageDetails && (
              <div className="space-y-3">
                {coverageDetails.services_covered?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Covered Services</p>
                    <div className="flex flex-wrap gap-2">
                      {coverageDetails.services_covered.map((service: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {formatServiceName(service)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {coverageDetails.services_not_covered?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not Covered</p>
                    <div className="flex flex-wrap gap-2">
                      {coverageDetails.services_not_covered.map((service: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive text-sm">
                          <XCircle className="w-3.5 h-3.5" />
                          {formatServiceName(service)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {coverageDetails.explanation && (
                  <p className="text-sm text-muted-foreground mt-2">{coverageDetails.explanation}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
