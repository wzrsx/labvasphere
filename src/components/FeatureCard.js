// src/components/FeatureCard.js
import React from "react";

const FeatureCard = React.forwardRef(({ title, subtitle, children }, ref) => (
  <div ref={ref} className="feature-card fade-in">
    {" "}
    {/* ← добавлен класс fade-in */}
    <h3>{title}</h3>
    <p className="subtitle">{subtitle}</p>
    <p className="content">{children}</p>
  </div>
));

export default FeatureCard;
