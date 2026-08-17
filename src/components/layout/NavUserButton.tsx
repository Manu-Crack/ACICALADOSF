"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface NavUserButtonProps {
  user: boolean;
  profileName?: string | null;
  isInternal: boolean;
  onSignOut: () => Promise<void>;
}

export function NavUserButton({
  user,
  profileName,
  isInternal,
  onSignOut,
}: NavUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSession, setHasSession] = useState(user);
  const [userName, setUserName] = useState<string | null>(profileName || null);
  const [isStaff, setIsStaff] = useState(isInternal);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync props to state
  useEffect(() => {
    setHasSession(user);
    if (profileName) setUserName(profileName);
    setIsStaff(isInternal);
  }, [user, profileName, isInternal]);

  // Client-side auth listener for instant sync on OAuth redirect
  useEffect(() => {
    const supabase = createClient();

    // Check user session
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setHasSession(true);
        const metaName = (authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim();
        const emailFallback = authUser.email ? authUser.email.split("@")[0] : "Administrador";
        if (!userName || userName === "Administrador") {
          setUserName(metaName || emailFallback || "Administrador");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setHasSession(true);
        const metaName = (session.user.user_metadata?.full_name || session.user.user_metadata?.name || "").trim();
        const emailFallback = session.user.email ? session.user.email.split("@")[0] : "Administrador";
        setUserName(metaName || emailFallback || "Administrador");
      } else {
        setHasSession(false);
        setUserName(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const displayName = userName || (hasSession ? "Administrador" : "Iniciar Sesión");

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      {/* User Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group inline-flex items-center justify-center h-9 sm:h-[38px] px-2 sm:px-3 py-1.5 rounded-full hover:bg-[#C8A45C]/15 text-gray-200 hover:text-[#C8A45C] transition-all duration-200 text-sm font-medium cursor-pointer shrink-0 gap-1.5 sm:gap-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Mi Cuenta"
        aria-label="Mi Cuenta"
      >
        {/* User Icon */}
        <svg
          className="w-5 h-5 sm:w-4 sm:h-4 text-gray-200 group-hover:text-[#C8A45C] transition-colors shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>

        <span className="hidden md:inline max-w-[130px] truncate leading-none select-none">
          {displayName}
        </span>

        {/* Chevron Down */}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[#C8A45C] transition-transform duration-200 shrink-0 hidden sm:block ${isOpen ? "rotate-180" : ""
            }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 sm:w-56 max-w-[calc(100vw-2rem)] bg-[#111111] border border-[#C8A45C]/35 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.85)] py-2 z-50 animate-fadeIn backdrop-blur-md">
          {hasSession ? (
            <>
              <div className="px-4 py-2.5 border-b border-[#C8A45C]/20 mb-1">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">
                  Sesión activa
                </p>
                <p className="text-sm font-semibold text-[#C8A45C] truncate mt-0.5">
                  {displayName}
                </p>
              </div>

              {isStaff && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-200 hover:text-white hover:bg-[#C8A45C]/15 transition-colors"
                >
                  <span className="text-base">👑</span>
                  <span>Panel de Control</span>
                </Link>
              )}

              <Link
                href="/mi-cuenta"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-200 hover:text-white hover:bg-[#C8A45C]/15 transition-colors"
              >
                <span className="text-base">👤</span>
                <span>Mi Perfil</span>
              </Link>


              <div className="my-1 border-t border-[#C8A45C]/20" />

              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  await onSignOut();
                }}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <span className="text-base">🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-200 hover:text-white hover:bg-[#C8A45C]/15 transition-colors"
              >
                <span className="text-base">🔑</span>
                <span>Iniciar Sesión</span>
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/15 transition-colors"
              >
                <span className="text-base">✨</span>
                <span>Crear Cuenta</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
