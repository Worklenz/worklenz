"use client";

import { useEffect, useRef } from "react";
import { subscribeToProjectEvents, type WorklenzEvent } from "./events";

export function useProjectEvents(
  projectId: string,
  onEvent: (event: WorklenzEvent) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const unsubscribe = subscribeToProjectEvents(projectId, (event) => {
      onEventRef.current(event);
    });

    return unsubscribe;
  }, [projectId]);
}
