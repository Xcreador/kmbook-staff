"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LibroMLogo, LockIcon, MailIcon } from "@/components/Icons";
import { Button } from "@/components/Button";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Email o contraseña incorrectos.");
        } else {
          setErrorMessage(getHumanErrorMessage(error));
        }
        setLoading(false);
        return;
      }

      // Redirigir al inicio para resolver membresías reales de la organización
      router.push("/");
      router.refresh();
    } catch (err) {
      setErrorMessage(getHumanErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.logoHeader}>
          <LibroMLogo size={48} />
          <h1 className={styles.title}>KMBOOK Staff</h1>
          <p className={styles.subtitle}>Tu app de trabajo diario</p>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico
            </label>
            <div className={styles.inputWrapper}>
              <MailIcon size={18} color="var(--km-gray)" className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu-email@kmbook.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <div className={styles.inputWrapper}>
              <LockIcon size={18} color="var(--km-gray)" className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="accent"
            size="lg"
            fullWidth
            isLoading={loading}
          >
            Iniciar sesión
          </Button>
        </form>

        <div className={styles.footerNote}>
          <p>Accede con tu cuenta KMBOOK asignada por tu salón o negocio.</p>
        </div>
      </div>
    </div>
  );
}
