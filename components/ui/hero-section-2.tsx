"use client";

import React from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Globe, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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
        <div className="flex w-full flex-col justify-between p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16">
          <div>
            {logo && (
              <motion.header className="mb-12" variants={itemVariants}>
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
                className="my-6 h-1 w-20 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                variants={itemVariants}
              />
              <motion.p className="mb-8 max-w-md text-base leading-relaxed text-slate-600" variants={itemVariants}>
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
            <motion.footer className="mt-12 w-full" variants={itemVariants}>
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

        {/* Kanan: gambar dengan reveal clip-path diagonal */}
        <motion.div
          className="relative min-h-[300px] w-full overflow-hidden md:min-h-full md:w-1/2 lg:w-2/5"
          initial={
            reduceMotion
              ? { clipPath: "polygon(25% 0, 100% 0, 100% 100%, 0% 100%)" }
              : { clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)" }
          }
          animate={{ clipPath: "polygon(25% 0, 100% 0, 100% 100%, 0% 100%)" }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: "circOut" }}
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
