import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CreativeSpec, CreativeTimelineItem } from "@/features/core/creative-spec";

function animationMultiplier(frame: number, duration: number, animation: CreativeTimelineItem["animationIn"], direction: "in" | "out"): number {
  const window = Math.max(6, Math.floor(duration * 0.12));
  if (!animation || animation === "NONE") return 1;

  if (direction === "in") {
    if (frame > window) return 1;
    switch (animation) {
      case "FADE":
        return interpolate(frame, [0, window], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      case "ZOOM":
      case "POP":
        return interpolate(frame, [0, window], [0.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      case "SLIDE":
        return interpolate(frame, [0, window], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      default:
        return interpolate(frame, [0, window], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
  }

  const outStart = Math.max(0, duration - window);
  if (frame < outStart) return 1;
  const localFrame = frame - outStart;
  switch (animation) {
    case "FADE":
      return interpolate(localFrame, [0, window], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    case "ZOOM":
      return interpolate(localFrame, [0, window], [1, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    case "SLIDE":
      return interpolate(localFrame, [0, window], [1, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    default:
      return interpolate(localFrame, [0, window], [1, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
}

function textByAnimation(text: string, frame: number, duration: number, animation: CreativeTimelineItem["animationIn"]): string {
  if (!text) return "";
  if (animation === "TYPEWRITER") {
    const chars = Math.max(1, Math.floor(interpolate(frame, [0, Math.max(10, duration * 0.4)], [1, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })));
    return text.slice(0, chars);
  }
  if (animation === "WORD_BY_WORD" || animation === "KARAOKE_HIGHLIGHT") {
    const words = text.split(/\s+/).filter(Boolean);
    const shown = Math.max(1, Math.floor(interpolate(frame, [0, Math.max(10, duration * 0.45)], [1, words.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })));
    return words.slice(0, shown).join(" ");
  }
  return text;
}

function renderTextItem(item: CreativeTimelineItem, frame: number) {
  const inMult = animationMultiplier(frame, item.durationFrames, item.animationIn, "in");
  const outMult = animationMultiplier(frame, item.durationFrames, item.animationOut, "out");
  const opacity = Math.max(0, Math.min(1, item.opacity * inMult * outMult));
  const textValue = textByAnimation(item.text || "", frame, item.durationFrames, item.animationIn);
  const style = item.style || {};

  return (
    <div
      style={{
        position: "absolute",
        left: `${item.position.x}%`,
        top: `${item.position.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        opacity,
        zIndex: item.zIndex,
        fontFamily: style.fontFamily || "ui-sans-serif",
        fontSize: style.fontSize || 44,
        fontWeight: style.fontWeight || 800,
        color: style.color || "#ffffff",
        textAlign: style.alignment || "center",
        textShadow: style.shadow || "0 8px 22px rgba(0,0,0,0.45)",
        WebkitTextStroke: style.stroke || "1px rgba(15,23,42,0.5)",
        background: style.background || "transparent",
        padding: style.background ? "10px 14px" : "0",
        borderRadius: style.background ? 10 : 0,
        maxWidth: "80%",
        whiteSpace: "pre-wrap",
      }}
    >
      {textValue}
    </div>
  );
}

function renderVisualItem(item: CreativeTimelineItem, frame: number) {
  const inMult = animationMultiplier(frame, item.durationFrames, item.animationIn, "in");
  const outMult = animationMultiplier(frame, item.durationFrames, item.animationOut, "out");
  const opacity = Math.max(0, Math.min(1, item.opacity * inMult * outMult));

  return (
    <div
      style={{
        position: "absolute",
        left: `${item.position.x}%`,
        top: `${item.position.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        opacity,
        zIndex: item.zIndex,
        width: item.trackType === "PRODUCT" ? "42%" : "100%",
        height: item.trackType === "PRODUCT" ? "auto" : "100%",
        display: "grid",
        placeItems: "center",
      }}
    >
      {item.src ? (
        item.trackType === "VIDEO" ? (
          <video src={item.src} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
        ) : (
          <img src={item.src} alt={item.text || item.trackType} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
        )
      ) : (
        <div style={{ border: "1px dashed rgba(255,255,255,0.5)", borderRadius: 12, padding: 12, color: "white", fontSize: 18, background: "rgba(15,23,42,0.35)" }}>
          {item.trackType}
        </div>
      )}
    </div>
  );
}

export default function DeterministicCreativeComposition({ spec }: { spec: CreativeSpec }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        width,
        height,
        background: "linear-gradient(180deg, #0f172a 0%, #111827 50%, #1e293b 100%)",
        overflow: "hidden",
      }}
    >
      {spec.timelineItems
        .filter((item) => !item.muted)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((item) => (
          <Sequence key={item.id} from={item.startFrame} durationInFrames={item.durationFrames}>
            {item.trackType === "TEXT" || item.trackType === "CAPTION"
              ? renderTextItem(item, frame - item.startFrame)
              : renderVisualItem(item, frame - item.startFrame)}
          </Sequence>
        ))}
    </AbsoluteFill>
  );
}
