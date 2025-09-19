"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export default function MaintenanceBanner() {
  const rawMessage = useMemo(() => process.env.NEXT_PUBLIC_MAINTAINENCE_MSG || "", []);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const message = (rawMessage || "").trim();
    const hasMessage = Boolean(message);
    setVisible(hasMessage);
  }, [rawMessage]);

  useEffect(() => {
    const banner = ref.current;
    const updateHeightVar = () => {
      const height = banner ? Math.ceil(banner.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty("--maintenance-banner-height", `${height}px`);
    };

    updateHeightVar();
    window.addEventListener("resize", updateHeightVar);
    return () => {
      window.removeEventListener("resize", updateHeightVar);
      document.documentElement.style.removeProperty("--maintenance-banner-height");
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        ref={ref}
        className="fixed top-0 w-screen z-[60]"
      >
        <div className="w-full bg-amber-500 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center text-sm font-medium">
            {rawMessage}
          </div>
        </div>
      </div>
      {/* Spacer to push the content below the fixed banner. */}
      <div aria-hidden="true" style={{ height: "var(--maintenance-banner-height, 0px)" }} />
    </>
  );
}


