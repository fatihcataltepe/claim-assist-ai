import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Phone, MapPin, Car, Clock, CheckCircle2, XCircle, MessageSquare, User, Bot, TrendingUp, BarChart3, UserCog, Bell, Copy } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AdminAIAssistant } from "@/components/AdminAIAssistant";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Helper functions - defined before useMemo to avoid hoisting issues
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

  // Analytics calculations
  const analytics = useMemo(() => {
    if (claims.length === 0) return null;

    // Claims per day for the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      const count = claims.filter(c => 
        startOfDay(new Date(c.created_at)).getTime() === date.getTime()
      ).length;
      return {
        date: format(date, 'MMM dd'),
        claims: count
      };
    });

    // Status distribution
    const statusCounts = claims.reduce((acc, claim) => {
      const status = claim.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: getStatusLabel(status),
      value: count as number
    }));

    // Coverage rate
    const coveredCount = claims.filter(c => c.is_covered === true).length;
    const notCoveredCount = claims.filter(c => c.is_covered === false).length;
    const coverageData = [
      { name: 'Covered', value: coveredCount },
      { name: 'Not Covered', value: notCoveredCount },
      { name: 'Pending', value: claims.length - coveredCount - notCoveredCount }
    ].filter(d => d.value > 0);

    // Average resolution time (for completed claims)
    const completedClaims = claims.filter(c => c.status === 'completed' || c.status === 'notification_sent');
    const avgResolutionMinutes = completedClaims.length > 0
      ? completedClaims.reduce((sum, claim) => {
          const created = new Date(claim.created_at).getTime();
          const updated = new Date(claim.updated_at).getTime();
          return sum + (updated - created) / (1000 * 60);
        }, 0) / completedClaims.length
      : 0;

    return {
      claimsPerDay: last7Days,
      statusDistribution: statusData,
      coverageDistribution: coverageData,
      avgResolutionMinutes: Math.round(avgResolutionMinutes),
      totalClaims: claims.length,
      activeClaims: claims.filter(c => c.status !== 'completed').length,
      completedClaims: claims.filter(c => c.status === 'completed').length,
      coverageRate: claims.length > 0 ? Math.round((coveredCount / claims.length) * 100) : 0
    };
  }, [claims]);

  const fetchClaims = async () => {
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClaims(data);
    }
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchNotifications();
    
    // Subscribe to real-time updates
    const claimsChannel = supabase
      .channel('claims-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims' },
        () => fetchClaims()
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, []);

  const filteredClaims = claims.filter((claim) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return claim.status !== "completed";
    if (activeFilter === "completed") return claim.status === "completed";
    return true;
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage all claims</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={showAnalytics ? "default" : "outline"} 
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        {/* Analytics Section */}
        {showAnalytics && analytics && (
          <div className="space-y-6 animate-fade-in">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Claims</div>
                    <div className="text-3xl font-bold text-primary">{analytics.totalClaims}</div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-primary/50" />
                </div>
              </Card>
              <Card className="p-6 bg-card/80 backdrop-blur border-orange-500/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Active Claims</div>
                    <div className="text-3xl font-bold text-orange-500">{analytics.activeClaims}</div>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500/50" />
                </div>
              </Card>
              <Card className="p-6 bg-card/80 backdrop-blur border-success/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Coverage Rate</div>
                    <div className="text-3xl font-bold text-success">{analytics.coverageRate}%</div>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-success/50" />
                </div>
              </Card>
              <Card className="p-6 bg-card/80 backdrop-blur border-accent/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Avg Resolution</div>
                    <div className="text-3xl font-bold text-accent">{analytics.avgResolutionMinutes}m</div>
                  </div>
                  <Clock className="w-8 h-8 text-accent/50" />
                </div>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Claims Trend */}
              <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Claims Trend (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.claimsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="claims" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Status Distribution */}
              <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Coverage Distribution */}
              <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Coverage Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.coverageDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.coverageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Resolution Time Distribution */}
              <Card className="p-6 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Completed Claims</span>
                    <span className="text-2xl font-bold text-success">{analytics.completedClaims}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Average Resolution Time</span>
                    <span className="text-2xl font-bold text-primary">{analytics.avgResolutionMinutes} min</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Coverage Success Rate</span>
                    <span className="text-2xl font-bold text-accent">{analytics.coverageRate}%</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(claim.id);
                            toast.success("Claim ID copied to clipboard");
                          }}
                          title="Copy Claim ID"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Badge className={`${getStatusColor(claim.status)} text-white`}>
                          {getStatusLabel(claim.status)}
                        </Badge>
                      </div>
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
                        <div className={`text-sm font-semibold mb-2 ${
                          claim.is_covered ? "text-success" : "text-destructive"
                        }`}>
                          {claim.is_covered ? "✓ Coverage Confirmed" : "✗ Not Covered"}
                        </div>
                        {claim.coverage_details && (() => {
                          try {
                            const details = typeof claim.coverage_details === 'string' 
                              ? JSON.parse(claim.coverage_details) 
                              : claim.coverage_details;
                            const formatServiceName = (name: string) =>
                              name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            return (
                              <div className="space-y-2">
                                {details.services_covered?.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Covered Services</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {details.services_covered.map((service: string, idx: number) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">
                                          <CheckCircle2 className="w-3 h-3" />
                                          {formatServiceName(service)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {details.services_not_covered?.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not Covered</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {details.services_not_covered.map((service: string, idx: number) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs">
                                          <XCircle className="w-3 h-3" />
                                          {formatServiceName(service)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {details.explanation && (
                                  <p className="text-xs text-muted-foreground mt-1">{details.explanation}</p>
                                )}
                              </div>
                            );
                          } catch {
                            return <div className="text-xs mt-1">{claim.coverage_details}</div>;
                          }
                        })()}
                      </div>
                    )}

                    {claim.arranged_services && claim.arranged_services.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs text-muted-foreground font-semibold mb-2">Arranged Services</div>
                        {claim.arranged_services.map((service: any, idx: number) => {
                          const serviceColors = {
                            tow_truck: "bg-orange-500/10 border border-orange-500/30",
                            taxi: "bg-blue-500/10 border border-blue-500/30",
                            rental_car: "bg-purple-500/10 border border-purple-500/30",
                            repair_truck: "bg-green-500/10 border border-green-500/30"
                          };
                          
                          const serviceBadgeColors = {
                            tow_truck: "bg-orange-500 text-white",
                            taxi: "bg-blue-500 text-white",
                            rental_car: "bg-purple-500 text-white",
                            repair_truck: "bg-green-500 text-white"
                          };
                          
                          const serviceLabels = {
                            tow_truck: "Tow Truck",
                            taxi: "Transportation",
                            rental_car: "Rental Car",
                            repair_truck: "Repair Service"
                          };
                          
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${serviceColors[service.service_type as keyof typeof serviceColors] || 'bg-muted/50 border border-border'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={`${serviceBadgeColors[service.service_type as keyof typeof serviceBadgeColors] || 'bg-primary text-primary-foreground'} text-xs`}>
                                  {serviceLabels[service.service_type as keyof typeof serviceLabels] || service.service_type}
                                </Badge>
                                {service.estimated_arrival && (
                                  <span className="text-xs font-semibold">
                                    ETA: {service.estimated_arrival} min
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium">{service.provider_name}</div>
                              {service.provider_phone && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {service.provider_phone}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {notifications.filter(n => n.claim_id === claim.id).length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs text-muted-foreground font-semibold mb-2">Notifications Sent</div>
                        {notifications.filter(n => n.claim_id === claim.id).map((notification) => {
                          const typeColors = {
                            sms: "bg-blue-500/10 border border-blue-500/30",
                            email: "bg-purple-500/10 border border-purple-500/30",
                          };
                          
                          const typeBadgeColors = {
                            sms: "bg-blue-500 text-white",
                            email: "bg-purple-500 text-white",
                          };
                          
                          const statusColors = {
                            pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                            sent: "bg-green-500/10 text-green-700 dark:text-green-400",
                            failed: "bg-red-500/10 text-red-700 dark:text-red-400",
                          };
                          
                          return (
                            <div
                              key={notification.id}
                              className={`p-3 rounded-lg ${typeColors[notification.type as keyof typeof typeColors] || 'bg-muted/50 border border-border'}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <Badge className={`${typeBadgeColors[notification.type as keyof typeof typeBadgeColors] || 'bg-primary text-primary-foreground'} text-xs`}>
                                  {notification.type.toUpperCase()}
                                </Badge>
                                <Badge className={`${statusColors[notification.status as keyof typeof statusColors] || 'bg-muted'} text-xs`}>
                                  {notification.status}
                                </Badge>
                              </div>
                              <div className="text-xs font-medium text-foreground mb-1">
                                To: {notification.recipient}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {notification.message}
                              </div>
                              {notification.created_at && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Conversation History Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Conversation History
                </DialogTitle>
                <DialogDescription>
                  {selectedClaim?.driver_name && `Claim for ${selectedClaim.driver_name}`}
                  {selectedClaim?.policy_number && ` - Policy: ${selectedClaim.policy_number}`}
                </DialogDescription>
              </div>
              {selectedClaim?.status !== "completed" && (
                <Button variant="destructive" size="sm">
                  <UserCog className="w-4 h-4 mr-2" />
                  Take Over
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              {/* Claim Summary */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge className={`${getStatusColor(selectedClaim.status)} text-white ml-2`}>
                      {getStatusLabel(selectedClaim.status)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {format(new Date(selectedClaim.created_at), "MMM dd, yyyy HH:mm")}
                  </div>
                  {selectedClaim.location && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Location:</span> {selectedClaim.location}
                    </div>
                  )}
                  {selectedClaim.is_covered !== null && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Coverage:</span>{" "}
                      <span className={selectedClaim.is_covered ? "text-success" : "text-destructive"}>
                        {selectedClaim.is_covered ? "✓ Covered" : "✗ Not Covered"}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Conversation Messages */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Chat Transcript
                </h4>
                <div className="h-[400px] overflow-y-auto pr-4 border border-border rounded-lg p-4 bg-muted/20">
                  {selectedClaim.conversation_history && 
                   Array.isArray(selectedClaim.conversation_history) && 
                   selectedClaim.conversation_history.length > 0 ? (
                    <div className="space-y-3">
                      {selectedClaim.conversation_history.map((message: any, idx: number) => {
                        const isAssistant = message.role === "assistant";
                        return (
                          <div
                            key={idx}
                            className={`flex gap-3 ${
                              isAssistant ? "justify-start" : "justify-end"
                            } animate-fade-in`}
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            {isAssistant && (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div
                              className={`max-w-[80%] rounded-2xl p-4 ${
                                isAssistant
                                  ? "bg-muted text-foreground"
                                  : "bg-primary text-primary-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold opacity-70">
                                  {isAssistant ? "AI Assistant" : "Driver"}
                                </span>
                                {message.timestamp && (
                                  <span className="text-xs opacity-50">
                                    {format(new Date(message.timestamp), "HH:mm")}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {message.content}
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
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No conversation history available
                    </div>
                  )}
                </div>
              </div>

              {/* Arranged Services */}
              {selectedClaim.arranged_services && 
               selectedClaim.arranged_services.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                    Arranged Services
                  </h4>
                  <div className="space-y-3">
                    {selectedClaim.arranged_services.map((service: any, idx: number) => {
                      const serviceColors = {
                        tow_truck: "bg-orange-500/10 border-orange-500/20",
                        taxi: "bg-blue-500/10 border-blue-500/20",
                        rental_car: "bg-purple-500/10 border-purple-500/20",
                        repair_truck: "bg-green-500/10 border-green-500/20"
                      };
                      
                      const serviceBadgeColors = {
                        tow_truck: "bg-orange-500 text-white",
                        taxi: "bg-blue-500 text-white",
                        rental_car: "bg-purple-500 text-white",
                        repair_truck: "bg-green-500 text-white"
                      };
                      
                      const serviceLabels = {
                        tow_truck: "Tow Truck",
                        taxi: "Transportation",
                        rental_car: "Rental Car",
                        repair_truck: "Repair Service"
                      };
                      
                      return (
                        <Card 
                          key={idx}
                          className={`p-4 border-2 ${serviceColors[service.service_type as keyof typeof serviceColors] || 'bg-muted/50 border-border'} animate-fade-in`}
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <Badge className={serviceBadgeColors[service.service_type as keyof typeof serviceBadgeColors] || 'bg-primary text-primary-foreground'}>
                              {serviceLabels[service.service_type as keyof typeof serviceLabels] || service.service_type}
                            </Badge>
                            {service.status && (
                              <Badge variant="outline" className="text-xs">
                                {service.status}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold">{service.provider_name}</span>
                            </div>
                            
                            {service.provider_phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="w-4 h-4" />
                                <a href={`tel:${service.provider_phone}`} className="hover:text-foreground transition-colors">
                                  {service.provider_phone}
                                </a>
                              </div>
                            )}
                            
                            {service.estimated_arrival && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  ETA: {service.estimated_arrival} minutes
                                </span>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Analytics Assistant */}
      <AdminAIAssistant />
    </div>
  );
}
