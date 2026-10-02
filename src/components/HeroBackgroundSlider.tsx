'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export interface SlideItem {
  image: string;
  title: string;
  tag: string;
}

const DEFAULT_SLIDES: SlideItem[] = [
  {
    image: '/images/hero/hero-slide-1.jpg',
    title: 'Modern Campus Architecture',
    tag: 'Next-Gen Infrastructure',
  },
  {
    image: '/images/hero/hero-slide-2.jpg',
    title: 'Interactive Digital Classrooms',
    tag: 'Smart Learning Environment',
  },
  {
    image: '/images/hero/hero-slide-3.jpg',
    title: 'Collaborative Study Commons',
    tag: 'Rich Resource Center',
  },
  {
    image: '/images/hero/hero-slide-4.jpg',
    title: 'Vibrant Student Community',
    tag: 'Connected School Life',
  },
];

interface HeroBackgroundSliderProps {
  slides?: SlideItem[];
  autoPlayInterval?: number;
  children: React.ReactNode;
}

export default function HeroBackgroundSlider({
  slides = DEFAULT_SLIDES,
  autoPlayInterval = 5500,
  children,
}: HeroBackgroundSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Autoplay timer
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [nextSlide, autoPlayInterval, isPaused]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (diff > 50) {
      // Swiped left -> next
      nextSlide();
    } else if (diff < -50) {
      // Swiped right -> prev
      prevSlide();
    }
    setTouchStartX(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  };

  return (
    <section
      className="relative overflow-hidden pt-20 pb-24 text-white min-h-[700px] flex flex-col justify-between group focus:outline-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Hero Showcase"
    >
      {/* Sliding Background Track */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <div
          className="flex h-full w-full transition-transform duration-1000 ease-out will-change-transform"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide, idx) => (
            <div key={idx} className="relative min-w-full h-full flex-shrink-0">
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover object-center scale-105"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* Multi-layered Contrast Overlays for Perfect Legibility */}
        {/* 1. Base dark vignette */}
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[0.5px]" />
        {/* 2. Vertical gradient (smooth transition from top header to bottom analytics) */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/50 to-slate-950" />
        {/* 3. Radial ambient glow highlighting center content */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/15 via-transparent to-slate-950/80" />
      </div>

      {/* Main Foreground Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>

      {/* Interactive Controls & Slide Indicators */}
      <div className="relative z-20 max-w-5xl mx-auto px-4 mt-10 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Current Slide Tag Badge */}
        <div className="flex items-center gap-2 bg-slate-900/70 border border-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs text-slate-300 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="font-semibold text-white">{slides[currentIndex]?.title}</span>
          <span className="text-slate-400 hidden sm:inline">· {slides[currentIndex]?.tag}</span>
        </div>

        {/* Navigation Controls: Arrows, Dots, Play/Pause */}
        <div className="flex items-center gap-3 bg-slate-900/75 border border-white/10 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg">
          {/* Previous Button */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous slide"
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full h-2 ${
                  currentIndex === idx
                    ? 'w-6 bg-blue-500 shadow-sm shadow-blue-400/50'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next slide"
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Pause / Play Toggle */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
            className="p-1 text-slate-400 hover:text-white transition ml-1"
            title={isPaused ? "Play slideshow" : "Pause slideshow"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-blue-400" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating Side Arrow Controls for Large Screens */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Previous slide"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/40 hover:bg-slate-900/80 border border-white/15 text-white/80 hover:text-white backdrop-blur-md items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-xl"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next slide"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/40 hover:bg-slate-900/80 border border-white/15 text-white/80 hover:text-white backdrop-blur-md items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-xl"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </section>
  );
}
