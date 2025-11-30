import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, MapPin, Car, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    fetchClaims();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('claims-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims' },
        () => fetchClaims()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchClaims = async () => {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClaims(data);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      data_gathering: "bg-blue-500",
      coverage_check: "bg-yellow-500",
      arranging_services: "bg-orange-500",
      notification_sent: "bg-green-500",
      completed: "bg-green-600",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      data_gathering: "Gathering Info",
      coverage_check: "Checking Coverage",
      arranging_services: "Arranging Services",
      notification_sent: "Notification Sent",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  const filteredClaims = claims.filter((claim) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return claim.status !== "completed";
    if (activeFilter === "completed") return claim.status === "completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage all claims</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Claims
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
            <div className="text-3xl font-bold text-primary mb-1">{claims.length}</div>
            <div className="text-sm text-muted-foreground">Total Claims</div>
          </Card>
          <Card className="p-6 bg-card/80 backdrop-blur border-orange-500/20 shadow-lg">
            <div className="text-3xl font-bold text-orange-500 mb-1">
              {claims.filter((c) => c.status !== "completed").length}
            </div>
            <div className="text-sm text-muted-foreground">Active Claims</div>
          </Card>
          <Card className="p-6 bg-card/80 backdrop-blur border-success/20 shadow-lg">
            <div className="text-3xl font-bold text-success mb-1">
              {claims.filter((c) => c.status === "completed").length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </Card>
          <Card className="p-6 bg-card/80 backdrop-blur border-accent/20 shadow-lg">
            <div className="text-3xl font-bold text-accent mb-1">
              {claims.filter((c) => c.is_covered).length}
            </div>
            <div className="text-sm text-muted-foreground">Covered Claims</div>
          </Card>
        </div>

        {/* Claims List */}
        <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
          <Tabs defaultValue="all" onValueChange={setActiveFilter}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Claims</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value={activeFilter} className="space-y-4">
              {filteredClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No claims found
                </div>
              ) : (
                filteredClaims.map((claim) => (
                  <Card
                    key={claim.id}
                    className="p-6 border-primary/10 hover:border-primary/30 transition-all cursor-pointer hover:shadow-md"
                    onClick={() => setSelectedClaim(claim)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">
                          {claim.driver_name || "Anonymous"}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {claim.policy_number && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              {claim.policy_number}
                            </span>
                          )}
                          {claim.driver_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {claim.driver_phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(claim.status)} text-white`}>
                        {getStatusLabel(claim.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {claim.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <div className="text-xs text-muted-foreground">Location</div>
                            <div className="text-sm">{claim.location}</div>
                          </div>
                        </div>
                      )}
                      {(claim.vehicle_make || claim.vehicle_model) && (
                        <div className="flex items-start gap-2">
                          <Car className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <div className="text-xs text-muted-foreground">Vehicle</div>
                            <div className="text-sm">
                              {claim.vehicle_year} {claim.vehicle_make} {claim.vehicle_model}
                            </div>
                          </div>
                        </div>
                      )}
                      {claim.created_at && (
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <div className="text-xs text-muted-foreground">Created</div>
                            <div className="text-sm">
                              {format(new Date(claim.created_at), "MMM dd, yyyy HH:mm")}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {claim.incident_description && (
                      <div className="mb-4">
                        <div className="text-xs text-muted-foreground mb-1">Incident</div>
                        <div className="text-sm">{claim.incident_description}</div>
                      </div>
                    )}

                    {claim.is_covered !== null && (
                      <div
                        className={`p-3 rounded-lg ${
                          claim.is_covered
                            ? "bg-success/10 border border-success/30"
                            : "bg-destructive/10 border border-destructive/30"
                        }`}
                      >
                        <div className={`text-sm font-semibold ${
                          claim.is_covered ? "text-success" : "text-destructive"
                        }`}>
                          {claim.is_covered ? "✓ Covered" : "✗ Not Covered"}
                        </div>
                        {claim.coverage_details && (
                          <div className="text-xs mt-1">{claim.coverage_details}</div>
                        )}
                      </div>
                    )}

                    {claim.arranged_services && claim.arranged_services.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">
                          Arranged Services
                        </div>
                        <div className="space-y-2">
                          {claim.arranged_services.map((service: any, idx: number) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <Badge variant="outline">{service.service_type}</Badge>
                              <span>{service.provider_name}</span>
                              {service.estimated_arrival && (
                                <span className="text-muted-foreground">
                                  ETA: {service.estimated_arrival} min
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
