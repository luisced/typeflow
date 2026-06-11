"use client";

import { useEffect } from "react";
import "./globals.css";
import ErrorState from "@/components/ErrorState";

const themeScript = `(function(){try{var t=localStorage.getItem('typeflow.theme.v1');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function GlobalError({
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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ErrorState
          status="500"
          title="Something went wrong"
          description="A critical error occurred. Try again or return to the typing test."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
