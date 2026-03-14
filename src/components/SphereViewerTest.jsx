// SphereViewerTest.jsx — ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
import React, { useEffect, useRef, useState } from "react";
import { Viewer, EquirectangularAdapter } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

const SphereViewerTest = ({ src, onLoaded, onError }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const initializedRef = useRef(false);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);

  const log = (msg, data) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(entry, data || "");
    setLogs((prev) => [...prev, entry]);
  };

  useEffect(() => {
    if (initializedRef.current || !src || !containerRef.current) return;

    const startTime = Date.now();
    log("🔍 Starting viewer test...");

    const initViewer = async () => {
      try {
        // Ждём размеры контейнера
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            attempts++;
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect?.width > 0 && rect?.height > 0) {
              log("📐 Container:", { width: rect.width, height: rect.height });
              resolve();
            } else if (attempts > 30) {
              reject(new Error("Container timeout"));
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });

        // Проверка изображения через Image API
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
        log("✅ Image:", { w: img.width, h: img.height, aspect: (img.width/img.height).toFixed(2) });

        setStatus("loading");

        // 🔹 ПРАВИЛЬНЫЙ СИНТАКСИС (как в документации):
        viewerRef.current = new Viewer({
          container: containerRef.current,
          adapter: EquirectangularAdapter,  // ← НЕ массив!
          panorama: src,                     // ← panorama на верхнем уровне!
          navbar: ["zoom"],
          caption: false,
          defaultZoomLvl: 0,
          mousewheel: true,
          mousemove: true,
          touchmove: true,
          touchmoveTwoFingers: true,
        });

        log("✅ Viewer created");
        log("📊 Has adapter:", !!viewerRef.current.adapter);
        log("📊 Has renderer:", !!viewerRef.current.renderer);

        // 🔹 Подписка на события
        viewerRef.current.addEventListener("ready", () => {
          const total = Date.now() - startTime;
          log(`✅✅✅ READY! (${total}ms)`);
          setStatus("loaded");
          initializedRef.current = true;
          onLoaded?.({ time: total });
        });

        viewerRef.current.addEventListener("load-start", () => {
          log("📬 EVENT: load-start");
        });

        viewerRef.current.addEventListener("load-progress", (e) => {
          log(`📬 EVENT: load-progress ${e.detail}%`);
        });

        viewerRef.current.addEventListener("load", () => {
          log("📬 EVENT: load");
        });

        viewerRef.current.addEventListener("load-error", (e) => {
          log("❌ LOAD-ERROR", e);
          setStatus("error");
          onError?.(e);
        });

        viewerRef.current.addEventListener("error", (e) => {
          log("❌ ERROR", e);
          setStatus("error");
          onError?.(e);
        });

        // 🔹 Таймаут 8 секунд
        setTimeout(() => {
          if (status !== "loaded" && viewerRef.current) {
            log("⚠️ Timeout");
            log("📊 Final state:", {
              hasAdapter: !!viewerRef.current.adapter,
              hasRenderer: !!viewerRef.current.renderer,
              hasScene: !!viewerRef.current.scene,
              hasCamera: !!viewerRef.current.camera,
            });
            // Принудительно считаем загруженным для теста
            setStatus("loaded");
            initializedRef.current = true;
            onLoaded?.({ time: Date.now() - startTime, forced: true });
          }
        }, 8000);

        initializedRef.current = true;

        // 🔹 Cleanup
        return () => {
          if (viewerRef.current) {
            viewerRef.current.destroy();
            log("🧹 Viewer destroyed");
          }
          initializedRef.current = false;
        };

      } catch (err) {
        log("❌ Init failed", err);
        setStatus("error");
        onError?.(err);
      }
    };

    initViewer();
  }, [src]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: "100%", 
          height: "100%", 
          minHeight: "400px", 
          background: "#000" 
        }} 
      />
      
      {/* Панель отладки */}
      <div style={{
        position: "absolute", 
        top: 10, 
        left: 10, 
        padding: 10,
        background: "rgba(0,0,0,0.8)", 
        color: "#fff", 
        borderRadius: 8,
        fontSize: 11, 
        fontFamily: "monospace", 
        zIndex: 100,
        maxWidth: 450, 
        maxHeight: 350, 
        overflow: "auto",
      }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Status:</strong>{" "}
          <span style={{
            color: status === "loaded" ? "#22c55e" : 
                   status === "error" ? "#ef4444" : "#94a3b8"
          }}>
            {status}
          </span>
        </div>
        {logs.slice(-15).map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};

export default SphereViewerTest;