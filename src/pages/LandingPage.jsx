import React, { useRef, useEffect } from "react";
import FeatureCard from "../components/FeatureCard";
import ConnectionLine from "../utils/ConnectionLine";
import useFadeInOnScroll from "../hooks/useFadeInOnScroll";
import logo from "../logo.jpg";
import "../App.css";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleTryClick = () => {
    navigate("/auth");
  };

  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);
  const card4Ref = useRef(null);
  const card5Ref = useRef(null);
  const card6Ref = useRef(null);

  const cardRefs = [card1Ref, card2Ref, card3Ref, card4Ref, card5Ref, card6Ref];
  useFadeInOnScroll(cardRefs);
  useEffect(() => {
    // Удаляем, если уже есть (защита от дублей при hot reload)
    document.querySelectorAll(".pulse-circle").forEach((el) => el.remove());

    const circle = document.createElement("div");
    circle.className = "pulse-circle";
    document.body.appendChild(circle);

    // Очистка при размонтировании
    return () => {
      circle.remove();
    };
  }, []);
  return (
    <div className="app">
      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="logo" className="logo-img" />
        </div>
        <button className="lang-button">RU</button>
      </header>

      <main className="main">
        <div className="hero">
          <h1>360° Визуализация</h1>
          <p>Создайте интерьер будущего</p>
        </div>
        <div className="features-grid">
          <FeatureCard
            ref={card1Ref}
            title="Что это?"
            subtitle="360°‑визуализация интерьеров"
          >
            Создавайте и показывайте проекты в интерактивной панораме — прямо из
            профессиональных 3D‑программ, таких как LABVASPHERE.
          </FeatureCard>

          <FeatureCard
            ref={card2Ref}
            title="Для кого?"
            subtitle="Дизайнеры, инженеры, архитекторы"
          >
            Идеально подходит тем, кто проектирует интерьеры, вентиляцию или
            кондиционирование — и хочет наглядно продемонстрировать результат
            заказчику.
          </FeatureCard>

          <FeatureCard
            ref={card3Ref}
            title="Как это работает?"
            subtitle="Просто, быстро, без перекодировки"
          >
            Загружайте 360°‑изображения напрямую или через бота. Поддержка
            высокого разрешения, управление жестами (касание, тачпад, мышь).
            Работает на Windows и macOS, а также на смартфонах и планшетах.
          </FeatureCard>

          <FeatureCard
            ref={card4Ref}
            title="Бесплатно и удобно"
            subtitle="Первая версия — без оплаты"
          >
            Полностью на русском и английском языках. Фоновая музыка через
            Яндекс.Музыку, Deezer и другие сервисы — по желанию.
          </FeatureCard>

          <FeatureCard
            ref={card5Ref}
            title="Зарабатывайте вместе с нами"
            subtitle="Партнёрская программа до 3 уровней"
          >
            1‑й уровень: 7,5%
            <br />
            2‑й уровень: 5%
            <br />
            3‑й уровень: 2,5%
            <br />
            от всех подписок ваших рефералов.
          </FeatureCard>

          <FeatureCard
            ref={card6Ref}
            title="Где скачать?"
            subtitle="Во всех магазинах приложений"
          >
            Скоро в App Store, Google Play и других платформах. Безопасная
            загрузка, прозрачные условия.
          </FeatureCard>
        </div>

        {cardRefs.slice(0, -1).map((_, i) => (
          <ConnectionLine
            key={i}
            fromRef={cardRefs[i]}
            toRef={cardRefs[i + 1]}
            fromIndex={i}
          />
        ))}
      </main>
      <footer>
        <div>
          <button className="try-button" onClick={handleTryClick}>
            Попробовать
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
