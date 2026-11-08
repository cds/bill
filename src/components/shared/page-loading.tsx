'use client';

import { useEffect, useState } from 'react';
import { Clock3, LoaderCircle } from 'lucide-react';

export function PageLoading() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  const progress = Math.min(90, Math.floor(elapsedMs / 100) * 10);
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  const process = progress < 30
    ? 'Preparing page'
    : progress < 70
      ? 'Loading page data'
      : 'Rendering results';

  return (
    <section
      className="flex min-h-[45vh] items-center justify-center px-4 py-12"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <LoaderCircle
            className="size-5 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">{process}</p>
            <p className="text-sm text-muted-foreground">Please wait while the page and data load.</p>
          </div>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Estimated page loading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`Estimated ${progress}%`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Estimated progress: {progress}%</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {elapsedSeconds} sec
          </span>
        </div>
      </div>
    </section>
  );
}
