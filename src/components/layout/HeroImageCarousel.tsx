"use client";

import { useState, useEffect } from "react";

const IMAGES = [
  {
    src: "/barber-hero.webp",
    alt: "Barbería Acicalados",
  },
  {
    src: "/fondo2.webp",
    alt: "Spa Acicalados",
  },
  {
    src: "/fondo3.webp",
    alt: "Spa Acicalados",
  },
  {
    src: "/fondo4.webp",
    alt: "Spa Acicalados",
  },
  {
    src: "/fondo5.webp",
    alt: "Spa Acicalados",
  },
  {
    src: "/fondo6.webp",
    alt: "Spa Acicalados",
  },
];

export function HeroImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;

    // Cambia automáticamente cada 5 segundos si el usuario no tiene el mouse encima
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % IMAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % IMAGES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + IMAGES.length) % IMAGES.length);
  };

  return (
    <div
      className="hero-image-wrapper"
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Resplandor decorativo de fondo */}
      <div className="hero-image-glow" />

      {/* Contenedor con máscara (viewport) para el desplazamiento horizontal */}
      <div
        style={{
          width: "100%",
          overflow: "hidden",
          position: "relative",
          padding: "24px 0", // Margen interno para evitar recortar sombras y animaciones de flotado
        }}
      >
        {/* Track/Carril que se desliza lateralmente */}
        <div
          style={{
            display: "flex",
            width: `${IMAGES.length * 100}%`,
            transform: `translateX(-${currentIndex * (100 / IMAGES.length)}%)`,
            transition: "transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
            overflow: "visible",
          }}
        >
          {IMAGES.map((image, index) => (
            <div
              key={image.src}
              style={{
                width: `${100 / IMAGES.length}%`,
                flexShrink: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "visible",
              }}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="hero-image"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  transition: "transform 0.8s ease",
                  // Si no está activa, escala ligeramente hacia abajo para un efecto dinámico
                  transform: index === currentIndex ? "scale(1)" : "scale(0.95)",
                }}
              />
            </div>
          ))}
        </div>

        {/* Botones de navegación manual con efecto glassmorphic premium */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "space-between",
            padding: "0 8px",
            pointerEvents: "none",
            zIndex: 10,
            opacity: isHovered ? 1 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* Botón Anterior */}
          <button
            onClick={handlePrev}
            aria-label="Imagen anterior"
            style={{
              pointerEvents: "auto",
              background: "rgba(28, 25, 18, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(200, 164, 92, 0.3)",
              color: "#C8A45C",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#C8A45C";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "rgba(28, 25, 18, 0.85)";
              e.currentTarget.style.boxShadow = "0 0 15px rgba(200, 164, 92, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "rgba(200, 164, 92, 0.3)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(28, 25, 18, 0.65)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Botón Siguiente */}
          <button
            onClick={handleNext}
            aria-label="Siguiente imagen"
            style={{
              pointerEvents: "auto",
              background: "rgba(28, 25, 18, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(200, 164, 92, 0.3)",
              color: "#C8A45C",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#C8A45C";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "rgba(28, 25, 18, 0.85)";
              e.currentTarget.style.boxShadow = "0 0 15px rgba(200, 164, 92, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "rgba(200, 164, 92, 0.3)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "rgba(28, 25, 18, 0.65)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Indicadores de paginación (dots) */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "8px",
          zIndex: 10,
        }}
      >
        {IMAGES.map((_, index) => {
          const isActive = index === currentIndex;
          return (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Ir a imagen ${index + 1}`}
              style={{
                width: isActive ? "24px" : "8px",
                height: "8px",
                borderRadius: "4px",
                border: "none",
                background: isActive ? "#C8A45C" : "rgba(200, 164, 92, 0.25)",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
