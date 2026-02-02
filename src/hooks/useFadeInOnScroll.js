// src/hooks/useFadeInOnScroll.js
import { useEffect, useRef } from "react";

const useFadeInOnScroll = (refs) => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Появление: убираем класс hidden → запускается transition
            entry.target.classList.remove("hidden");
          } else {
            // Исчезновение: добавляем класс hidden
            entry.target.classList.add("hidden");
          }
        });
      },
      {
        threshold: 0.1, // срабатывает, когда 10% элемента видно
        rootMargin: "0px 0px -50px 0px", // можно настроить чувствительность
      }
    );

    // Инициализация: все элементы скрыты
    refs.forEach((ref) => {
      if (ref?.current) {
        ref.current.classList.add("hidden");
        observer.observe(ref.current);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref?.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, [refs]);
};

export default useFadeInOnScroll;
