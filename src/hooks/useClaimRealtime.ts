import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Claim = Tables<"claims">;

export function useClaimRealtime(claimId: string | null) {
  const [claimData, setClaimData] = useState<Claim | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch claim data from database
  const fetchClaim = useCallback(async () => {
    if (!claimId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .eq("id", claimId)
        .single();

      if (error) {
        console.error("Error fetching claim:", error);
        return;
      }

      console.log("Fetched claim data:", data);
      setClaimData(data);
    } catch (error) {
      console.error("Error in fetchClaim:", error);
    } finally {
      setIsLoading(false);
    }
  }, [claimId]);

  // Fetch notifications for the claim
  const fetchNotifications = useCallback(async () => {
    if (!claimId) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error("Error in fetchNotifications:", error);
    }
  }, [claimId]);

  // Subscribe to real-time updates for the claim
  useEffect(() => {
    if (!claimId) return;

    // Initial fetch
    fetchClaim();
    fetchNotifications();

    // Subscribe to claim updates
    const claimChannel = supabase
      .channel(`claim-${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "claims",
          filter: `id=eq.${claimId}`,
        },
        (payload) => {
          console.log("Claim updated via realtime:", payload.new);
          setClaimData(payload.new as Claim);
        }
      )
      .subscribe();

    // Subscribe to notification updates for this claim
    const notificationChannel = supabase
      .channel(`notifications-${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `claim_id=eq.${claimId}`,
        },
        () => {
          console.log("Notification change detected, refetching...");
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      console.log("Unsubscribing from claim channels");
      supabase.removeChannel(claimChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [claimId, fetchClaim, fetchNotifications]);

  return {
    claimData,
    notifications,
    isLoading,
    refetchClaim: fetchClaim,
    refetchNotifications: fetchNotifications,
  };
}
