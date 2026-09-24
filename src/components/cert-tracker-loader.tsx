"use client";

import dynamic from "next/dynamic";

// Client-only so the selected person can be read from localStorage on first render.
const CertTracker = dynamic(() => import("@/components/cert-tracker"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-gray-400">불러오는 중...</div>,
});

export default CertTracker;
