"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Globe, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Diagonal clip-path pada gambar cuma didesain buat panel tinggi (desktop) -
 * di layar sempit rasio panelnya jadi hampir persegi dan potongan diagonal
 * itu terlihat seperti notch janggal, bukan reveal yang elegan. Default
 * false (mode mobile: tanpa diagonal) supaya render server & first paint
 * client tetap sama - begitu mount, kalau layarnya memang lebar, langsung
 * upgrade ke mode diagonal.
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

type ContactInfo = Partial<{
  website: string;
  phone: string;
  address: string;
}>;

const CONTACT_ICON = { website: Globe, phone: Phone, address: MapPin } as const;

interface HeroSectionProps {
  className?: string;
  logo?: {
    url: string;
    alt: string;
    text?: string;
  };
  slogan?: string;
  title: React.ReactNode;
  subtitle: string;
  callToAction: {
    text: string;
    href: string;
  };
  secondaryCallToAction?: {
    text: string;
    href: string;
  };
  backgroundImage: string;
  /** Cuma field yang diisi yang ditampilkan - jangan isi field yang datanya belum diverifikasi. */
  contactInfo?: ContactInfo;
}

/**
 * Hero split-screen: konten + CTA di kiri, gambar dengan reveal clip-path
 * diagonal di kanan. Entrance stagger & clip-path reveal dimatikan kalau
 * prefers-reduced-motion aktif (motion.section langsung render final state).
 */
const HeroSection = React.forwardRef<HTMLElement, HeroSectionProps>(
  (
    { className, logo, slogan, title, subtitle, callToAction, secondaryCallToAction, backgroundImage, contactInfo },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const isDesktop = useIsDesktop();
    const diagonalReveal = isDesktop && !reduceMotion;
    const fadeReveal = !isDesktop && !reduceMotion;
    const contactEntries = (Object.keys(CONTACT_ICON) as (keyof ContactInfo)[])
      .map((key) => ({ key, value: contactInfo?.[key] }))
      .filter((entry): entry is { key: keyof ContactInfo; value: string } => Boolean(entry.value));

    const containerVariants: Variants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: reduceMotion ? { duration: 0 } : { staggerChildren: 0.15, delayChildren: 0.2 },
      },
    };

    const itemVariants: Variants = {
      hidden: reduceMotion ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" },
      },
    };

    return (
      <motion.section
        ref={ref}
        className={cn("relative flex w-full flex-col overflow-hidden bg-white text-slate-900 md:flex-row", className)}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Kiri: konten */}
        <div className="flex w-full flex-col justify-between p-6 sm:p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16">
          <div>
            {logo && (
              <motion.header className="mb-8 md:mb-12" variants={itemVariants}>
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0">
                    <Image src={logo.url} alt={logo.alt} fill sizes="36px" className="object-contain" />
                  </div>
                  <div>
                    {logo.text && <p className="text-lg font-bold text-slate-900">{logo.text}</p>}
                    {slogan && (
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-900">{slogan}</p>
                    )}
                  </div>
                </div>
              </motion.header>
            )}

            <motion.div variants={containerVariants}>
              <motion.h1
                className="text-4xl font-bold leading-tight text-balance text-slate-900 md:text-5xl"
                variants={itemVariants}
              >
                {title}
              </motion.h1>
              <motion.div
                className="my-5 h-1 w-20 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 md:my-6"
                variants={itemVariants}
              />
              <motion.p
                className="mb-6 max-w-md text-base leading-relaxed text-slate-600 md:mb-8"
                variants={itemVariants}
              >
                {subtitle}
              </motion.p>
              <motion.div className="flex flex-col gap-3 sm:flex-row" variants={itemVariants}>
                <a
                  href={callToAction.href}
                  className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-3 text-center text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500"
                >
                  {callToAction.text}
                </a>
                {secondaryCallToAction && (
                  <a
                    href={secondaryCallToAction.href}
                    className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition-all hover:scale-[1.02] hover:border-slate-300 hover:bg-slate-50"
                  >
                    {secondaryCallToAction.text}
                  </a>
                )}
              </motion.div>
            </motion.div>
          </div>

          {contactEntries.length > 0 && (
            <motion.footer className="mt-8 w-full md:mt-12" variants={itemVariants}>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-500">
                {contactEntries.map(({ key, value }) => {
                  const Icon = CONTACT_ICON[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                      <span>{value}</span>
                    </div>
                  );
                })}
              </div>
            </motion.footer>
          )}
        </div>

        {/* Kanan (desktop): panel penuh dengan reveal clip-path diagonal.
            Mobile: kartu membulat dengan rasio tetap + fade-in, potongan
            diagonal dilepas karena panelnya jadi hampir persegi (lihat
            useIsDesktop di atas). */}
        <motion.div
          className={cn(
            "relative mx-6 mb-2 aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 sm:mx-8",
            "md:mx-0 md:mb-0 md:aspect-auto md:w-1/2 md:min-h-full md:rounded-none md:border-0 md:shadow-none lg:w-2/5",
          )}
          initial={
            diagonalReveal
              ? { clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)", opacity: 1, scale: 1 }
              : {
                  clipPath: "polygon(0% 0, 100% 0, 100% 100%, 0% 100%)",
                  opacity: fadeReveal ? 0 : 1,
                  scale: fadeReveal ? 0.96 : 1,
                }
          }
          animate={{
            clipPath: diagonalReveal
              ? "polygon(25% 0, 100% 0, 100% 100%, 0% 100%)"
              : "polygon(0% 0, 100% 0, 100% 100%, 0% 100%)",
            opacity: 1,
            scale: 1,
          }}
          transition={
            diagonalReveal
              ? { duration: 1.2, ease: "circOut" }
              : fadeReveal
                ? { duration: 0.6, ease: "easeOut" }
                : { duration: 0 }
          }
        >
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </motion.div>
      </motion.section>
    );
  },
);

HeroSection.displayName = "HeroSection";

export { HeroSection };
