"use client";

import { useEffect, useState } from "react";

export default function Home() {
  useEffect(() => {
    window.location.href = "/rank";
  }, []);
  return <div></div>;
}
