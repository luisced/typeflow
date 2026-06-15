import type { Metadata } from "next";
import ErrorState from "@/components/ErrorState";

export const metadata: Metadata = {
  title: "Page not found — TypeFlow",
  description: "The page you requested does not exist.",
};

export default function NotFound() {
  return (
    <ErrorState
      status="404"
      title="Page not found"
      description="That route doesn't exist. Head back to the typing test and keep your streak going."
    />
  );
}
