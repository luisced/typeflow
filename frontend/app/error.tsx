"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      status="500"
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. Try again or return to the typing test."
      onRetry={reset}
    />
  );
}
