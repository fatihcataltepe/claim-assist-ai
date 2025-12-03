import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Truck, Bell, Phone, Loader2, FileText } from "lucide-react";
import ClaimDetails from "@/components/ClaimDetails";
import { cn } from "@/lib/utils";

interface ClaimSidebarProps {
  claimData: any;
  notifications: any[];
}

export default function ClaimSidebar({ claimData, notifications }: ClaimSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasServices = claimData?.arranged_services && Array.isArray(claimData.arranged_services) && claimData.arranged_services.length > 0;
  const hasNotifications = notifications.length > 0;
  const hasContent = claimData || hasServices || hasNotifications;

  if (!hasContent) return null;

  return (
    <div className={cn(
      "relative transition-all duration-300 ease-in-out",
      isCollapsed ? "w-12" : "w-[400px] min-w-[400px]"
    )}>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-4 top-4 z-10 h-8 w-8 rounded-full border-primary/20 bg-card shadow-md"
      >
        {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {isCollapsed ? (
        <div className="flex flex-col items-center gap-4 pt-16">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center" title="Claim Details">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          {hasServices && (
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center" title="Services">
              <Truck className="w-4 h-4 text-success" />
            </div>
          )}
          {hasNotifications && (
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center" title="Notifications">
              <Bell className="w-4 h-4 text-blue-500" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-2">
          {/* Claim Details */}
          <ClaimDetails claimData={claimData} />

          {/* Services Panel */}
          {hasServices && (
            <Card className="p-4 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Arranged Services</h3>
                </div>

                <div className="space-y-3">
                  {(claimData.arranged_services as any[]).map((service: any, index: number) => (
                    <div key={index} className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize text-sm">
                            {service.service_type?.replace('_', ' ') || 'Service'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            service.status === 'dispatched'
                              ? 'bg-success/20 text-success'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {service.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <Truck className="w-3 h-3 text-primary" />
                            <span>{service.provider_name}</span>
                          </div>

                          {service.provider_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-primary" />
                              <a href={`tel:${service.provider_phone}`} className="text-primary hover:underline">
                                {service.provider_phone}
                              </a>
                            </div>
                          )}

                          {service.estimated_arrival && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-3 h-3 text-primary" />
                              <span>ETA: {service.estimated_arrival} min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Notifications Panel */}
          {hasNotifications && (
            <Card className="p-4 bg-card/80 backdrop-blur border-primary/20 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Notifications</h3>
                </div>

                <div className="space-y-3">
                  {notifications.map((notification: any, index: number) => (
                    <div key={index} className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              notification.type === 'sms'
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>
                              {notification.type.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
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

                        <p className="text-xs text-muted-foreground">
                          To: <span className="font-medium text-foreground">{notification.recipient}</span>
                        </p>

                        <p className="text-xs text-foreground bg-muted/50 p-2 rounded">
                          {notification.message}
                        </p>

                        {notification.error_message && (
                          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/30">
                            Error: {notification.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
