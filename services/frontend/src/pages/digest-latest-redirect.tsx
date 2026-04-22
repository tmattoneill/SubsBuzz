import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function DigestLatestRedirect() {
  const [, setLocation] = useLocation();

  const { data: latestDigest, status } = useQuery<any>({
    queryKey: ["/api/digest/latest"],
    select: (d: any) => d?.data ?? d,
    retry: false,
  });

  useEffect(() => {
    if (status === "pending") return;
    const date = latestDigest?.date;
    if (date) {
      setLocation(`/digest/${date.split("T")[0]}`, { replace: true });
    } else {
      setLocation("/history", { replace: true });
    }
  }, [status, latestDigest, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
