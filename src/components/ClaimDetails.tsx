import { Card } from "@/components/ui/card";
import { User, Phone, Mail, FileText, Car, MapPin } from "lucide-react";

interface ClaimDetailsProps {
  claimData: any;
}

export default function ClaimDetails({ claimData }: ClaimDetailsProps) {
  if (!claimData) return null;

  const hasDriverInfo = claimData.driver_name || claimData.driver_phone || claimData.driver_email || claimData.policy_number;
  const hasVehicleInfo = claimData.vehicle_make || claimData.vehicle_model || claimData.vehicle_year;
  const hasIncidentInfo = claimData.location || claimData.incident_description;

  if (!hasDriverInfo && !hasVehicleInfo && !hasIncidentInfo) return null;

  return (
    <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">Claim Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Driver Information */}
          {hasDriverInfo && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Driver Information
              </h3>
              <div className="space-y-2 text-sm">
                {claimData.driver_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{claimData.driver_name}</span>
                  </div>
                )}
                {claimData.driver_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{claimData.driver_phone}</span>
                  </div>
                )}
                {claimData.driver_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{claimData.driver_email}</span>
                  </div>
                )}
                {claimData.policy_number && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Policy:</span>
                    <span className="font-medium">{claimData.policy_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Information */}
          {hasVehicleInfo && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicle Information
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <Car className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {[claimData.vehicle_year, claimData.vehicle_make, claimData.vehicle_model].filter(Boolean).join(' ')}
                </span>
              </div>
            </div>
          )}

          {/* Incident Information */}
          {hasIncidentInfo && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Incident Details
              </h3>
              <div className="space-y-2 text-sm">
                {claimData.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Location: </span>
                      <span className="font-medium">{claimData.location}</span>
                    </div>
                  </div>
                )}
                {claimData.incident_description && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Description: </span>
                      <span className="font-medium">{claimData.incident_description}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
