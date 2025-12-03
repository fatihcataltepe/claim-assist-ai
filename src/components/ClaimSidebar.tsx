import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Truck, Bell, Phone, Loader2, FileText, X } from "lucide-react";
import ClaimDetails from "@/components/ClaimDetails";
import { cn } from "@/lib/utils";

interface ClaimSidebarProps {
  claimData: any;
  notifications: any[];
}

export default function ClaimSidebar({ claimData, notifications }: ClaimSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasServices = claimData?.arranged_services && Array.isArray(claimData.arranged_services) && claimData.arranged_services.length > 0;
  const hasNotifications = notifications.length > 0;
  const hasClaimDetails = claimData?.driver_name || claimData?.vehicle_make || claimData?.incident_description;

  // Count items for badge
  const itemCount = (hasClaimDetails ? 1 : 0) + (hasServices ? (claimData.arranged_services as any[]).length : 0) + notifications.length;

  return (
    <>
      {/* Toggle Button - Fixed on right edge */}
      <Button
        variant="default"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50 rounded-l-lg rounded-r-none h-auto py-3 px-2 shadow-lg transition-all duration-300",
          isOpen && "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <FileText className="w-5 h-5" />
          <span className="text-xs font-medium writing-mode-vertical">Details</span>
          {itemCount > 0 && (
            <span className="bg-primary-foreground text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
          <ChevronLeft className="w-4 h-4" />
        </div>
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-card border-l border-primary/20 shadow-2xl z-50 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Claim Information
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Panel Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-65px)] space-y-4">
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

          {/* Empty State */}
          {!hasClaimDetails && !hasServices && !hasNotifications && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Claim details will appear here as the conversation progresses.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
