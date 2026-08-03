"use client";

import { useMemo } from "react";
import { Player } from "@remotion/player";
import type { CreativeSpec } from "@/features/core/creative-spec";
import DeterministicCreativeComposition from "@/components/core/remotion/DeterministicCreativeComposition";

export default function CreativeSpecPreviewPlayer({ spec }: { spec: CreativeSpec }) {
  const compositionSize = useMemo(
    () => ({ width: spec.width, height: spec.height }),
    [spec.width, spec.height],
  );

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
      <Player
        component={DeterministicCreativeComposition}
        inputProps={{ spec }}
        durationInFrames={spec.durationFrames}
        fps={spec.fps}
        compositionWidth={compositionSize.width}
        compositionHeight={compositionSize.height}
        controls
        autoPlay={false}
        loop
        style={{ width: "100%", aspectRatio: "9 / 16" }}
      />
    </div>
  );
}
