import { useRef, useState } from "react";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — keeps the request row reasonable in Postgres

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Lets the person either upload a file (encoded as a data URL and stored in
 * the same attachmentUrl text field the backend already exposes) or paste an
 * external link. No backend changes required.
 */
export default function AttachmentField({ value, fileName, onChange }) {
  const [mode, setMode] = useState("upload");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is too large — attachments are limited to 4MB.`);
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      onChange(dataUrl, file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function clearFile() {
    onChange("", "");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="field">
      <label>Attachment</label>
      <div className="admin-tabs" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`admin-tab-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => {
            setMode("upload");
            setError("");
          }}
        >
          Upload file
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${mode === "link" ? "active" : ""}`}
          onClick={() => {
            setMode("link");
            setError("");
          }}
        >
          Link a URL
        </button>
      </div>

      {mode === "upload" ? (
        fileName ? (
          <div className="tag-list">
            <span className="tag-pill">
              📎 {fileName}
              <button type="button" onClick={clearFile} aria-label="Remove attachment">
                ×
              </button>
            </span>
          </div>
        ) : (
          <>
            <input ref={inputRef} type="file" className="input" onChange={handleFile} disabled={busy} />
            <span className="hint">{busy ? "Reading file…" : "Up to 4MB. Stored with the request."}</span>
          </>
        )
      ) : (
        <input
          className="input"
          placeholder="https://…"
          value={fileName ? "" : value}
          onChange={(e) => onChange(e.target.value, "")}
        />
      )}

      {error && <span className="hint" style={{ color: "var(--status-rejected)" }}>{error}</span>}
    </div>
  );
}
