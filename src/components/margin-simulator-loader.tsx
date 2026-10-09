"use client";

import dynamic from "next/dynamic";

// 가정은 localStorage, 입력값은 URL 쿼리에서 읽으므로 클라이언트에서만 렌더한다.
const MarginSimulator = dynamic(() => import("@/components/margin-simulator"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-gray-400">불러오는 중...</div>,
});

export default MarginSimulator;
