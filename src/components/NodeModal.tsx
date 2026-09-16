import { useEffect, useRef, useState } from "react";
import type { GraphNode } from "../../shared/types";
import { getNodeContent } from "../api/client";
import { useI18n } from "../hooks/useI18n";
import { CSVRenderer } from "./renderer/CSVRenderer";
import { MarkdownRenderer } from "./renderer/MarkdownRenderer";

interface NodeModalProps {
  node: GraphNode;
  onNavigate: (target: string) => void;
  onClose: () => void;
}

export function NodeModal({ node, onNavigate, onClose }: NodeModalProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setContent(null);
    bodyRef.current?.scrollTo({ top: 0 });
    getNodeContent(node.path)
      .then((value) => {
        if (active) {
          setContent(value);
        }
      })
      .catch(() => {
        if (active) {
          setContent("");
        }
      });
    return () => {
      active = false;
    };
  }, [node.path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 className="modal-title">{node.title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body" ref={bodyRef}>
          {content === null ? (
            <p className="modal-loading">{t("node.loading")}</p>
          ) : content.length === 0 ? (
            <p className="modal-empty">{t("node.empty")}</p>
          ) : node.path.toLowerCase().endsWith(".csv") ? (
            <CSVRenderer text={content} />
          ) : (
            <MarkdownRenderer text={content} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}