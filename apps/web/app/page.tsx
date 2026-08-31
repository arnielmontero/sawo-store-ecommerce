"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshAccessToken } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    refreshAccessToken()
      .then(() => router.replace("/orders"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return null;
}
