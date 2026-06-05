"use client";

import { useState } from "react";
import { ServiceCard } from "./ServiceCard";

type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  price_cents: number;
  duration_minutes: number;
  images: string[];
};

interface ServiceListProps {
  services: Service[];
}

export function ServiceList({ services }: ServiceListProps) {
  const [activeTab, setActiveTab] = useState<"todos" | "spa" | "barberia">("todos");

  const filteredServices = services.filter((service) => {
    if (activeTab === "todos") return true;
    return service.type === activeTab;
  });

  const barberiaServices = filteredServices.filter((s) => s.type === "barberia");
  const spaServices = filteredServices.filter((s) => s.type === "spa");

  return (
    <div>
      {/* Tabs Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          marginBottom: 50,
          flexWrap: "wrap",
        }}
      >
        {(["todos", "barberia", "spa"] as const).map((tab) => {
          const isActive = activeTab === tab;
          let label = "Todos";
          let iconSrc = "";
          
          if (tab === "barberia") {
            label = "Barbería";
            iconSrc = "/LogoBarberia.svg";
          } else if (tab === "spa") {
            label = "Spa y Bienestar";
            iconSrc = "/LogoSpa.svg";
          }

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "0.875rem",
                borderRadius: "var(--radius-full)",
                padding: "10px 28px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                boxShadow: isActive ? "var(--shadow-gold)" : "none",
                transform: isActive ? "scale(1.05)" : "scale(1)",
                transition: "all var(--transition-normal)",
              }}
            >
              {iconSrc && (
                <img
                  src={iconSrc}
                  alt={label}
                  style={{
                    height: 16,
                    width: "auto",
                    filter: isActive ? "brightness(0)" : "none",
                    transition: "filter var(--transition-fast)",
                  }}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Services List Section */}
      <div>
        {/* Barbería Section */}
        {barberiaServices.length > 0 && (
          <div style={{ marginBottom: 64 }} className="animate-fadeIn">
            <h2
              className="heading-lg text-gold"
              style={{
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              <img
                src="/LogoBarberia.svg"
                alt="Logo Barbería"
                style={{ height: 32, width: "auto" }}
              />
              Barbería
            </h2>
            <div className="grid grid-3">
              {barberiaServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Spa Section */}
        {spaServices.length > 0 && (
          <div style={{ marginBottom: 64 }} className="animate-fadeIn">
            <h2
              className="heading-lg text-gold"
              style={{
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontFamily: "'Playfair Display', serif",
              }}
            >
              <img
                src="/LogoSpa.svg"
                alt="Logo Spa"
                style={{ height: 32, width: "auto" }}
              />
              Spa y Bienestar
            </h2>
            <div className="grid grid-3">
              {spaServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredServices.length === 0 && (
          <div
            className="card card-gold animate-fadeIn"
            style={{
              textAlign: "center",
              padding: "80px 20px",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            <p style={{ fontSize: "1.125rem", color: "var(--color-text-muted)", marginBottom: 16 }}>
              No se encontraron servicios en esta categoría en este momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
