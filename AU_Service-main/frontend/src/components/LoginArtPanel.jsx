import { useRef, useState } from "react";

const MAX_TILT_DEG = 16;

/**
 * The dark green art panel shown alongside every auth form (login, forgot
 * password, reset password). Centerpiece is the AU emblem: it spins slowly
 * on its own, and tilts AWAY from the cursor on hover (the edge nearest the
 * pointer dips back into the screen, like it's shying away) rather than the
 * more common "tilt toward cursor" spotlight effect.
 */
export default function LoginArtPanel({ quote }) {
  const [emblemTilt, setEmblemTilt] = useState("rotateX(0deg) rotateY(0deg) scale(1)");
  const stageRef = useRef(null);

  function handleMouseMove(e) {
    const rect = stageRef.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2); // -1..1
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2); // -1..1
    setEmblemTilt(
      `rotateX(${(dy * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(-dx * MAX_TILT_DEG).toFixed(2)}deg) scale(0.94)`
    );
  }

  function handleMouseLeave() {
    setEmblemTilt("rotateX(0deg) rotateY(0deg) scale(1)");
  }

  return (
    <div className="login-art">
      <div className="brand">
        <img src="/au-emblem.png" alt="African Union" className="brand-mark" />
        <div className="brand-title" style={{ color: "#fff", fontSize: 19 }}>
          Service Requests
        </div>
      </div>

      <div
        className="login-emblem-stage"
        ref={stageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="login-emblem-wrap" style={{ transform: emblemTilt }}>
          <img src="/au-emblem.png" alt="" aria-hidden="true" className="login-emblem" />
        </div>
      </div>

      <p className="login-art-quote">"{quote}"</p>
    </div>
  );
}
