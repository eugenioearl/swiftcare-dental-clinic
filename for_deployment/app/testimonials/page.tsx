'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Star, ArrowLeft, Quote } from 'lucide-react'

const TESTIMONIALS = [
  {
    name: 'Maria Santos',
    location: 'Tarlac City',
    text: 'The staff is incredibly warm and professional. My kids used to be scared of the dentist, but now they actually look forward to visits! The modern equipment and gentle approach made all the difference.',
    rating: 5,
    service: 'Pediatric Dentistry',
  },
  {
    name: 'Juan Dela Cruz',
    location: 'San Fernando, Pampanga',
    text: "Best dental experience I've ever had. The clinic is clean, modern, and the dentist took time to explain everything clearly. No rushed consultation, no upselling \u2014 just honest, quality care.",
    rating: 5,
    service: 'Root Canal Treatment',
  },
  {
    name: 'Ana Reyes',
    location: 'Tarlac City',
    text: 'Had my braces done here and the results are amazing! Very affordable compared to other clinics in Tarlac. The orthodontist was patient and answered all my questions during every visit.',
    rating: 5,
    service: 'Orthodontics',
  },
  {
    name: 'Roberto Lim',
    location: 'Capas, Tarlac',
    text: 'Went in for a teeth cleaning and was blown away by the attention to detail. The hygienist was thorough and the price was very reasonable. I will definitely be coming back for all my dental needs.',
    rating: 5,
    service: 'Dental Cleaning',
  },
  {
    name: 'Carmela Villanueva',
    location: 'Concepcion, Tarlac',
    text: 'My teeth whitening results exceeded my expectations! The team explained every step and made me feel comfortable throughout the procedure. Highly recommend SwiftCare for anyone wanting quality dental care.',
    rating: 5,
    service: 'Teeth Whitening',
  },
  {
    name: 'Marco Santiago',
    location: 'Paniqui, Tarlac',
    text: 'Needed a wisdom tooth extraction and was nervous, but the surgical team made it painless and efficient. Aftercare instructions were clear and follow-up was excellent. Truly professional service.',
    rating: 5,
    service: 'Wisdom Tooth Removal',
  },
]

export default function TestimonialsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <Image src="/clinic/logo.png" alt="SwiftCare Dental Clinic logo" fill className="object-contain" priority />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-lg text-gray-900 leading-tight">SwiftCare</p>
              <p className="text-xs text-gray-500 leading-tight">Dental Clinic</p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#2D9DA8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-[#2D9DA8] to-[#1a7a84] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-white/80 font-semibold text-sm tracking-wider uppercase mb-3">What Our Patients Say</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">Patient Stories</h1>
          <p className="text-white/90 text-lg max-w-2xl mx-auto leading-relaxed">
            Real reviews from the patients we serve. Their trust is why we keep doing what we love.
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 lg:p-7 shadow-sm border border-gray-100 hover:shadow-lg hover:border-[#2D9DA8]/30 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <Quote className="w-8 h-8 text-[#2D9DA8]/30" />
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed text-[15px]">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2D9DA8] to-[#22B573] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{t.name.split(' ').map((w) => w[0]).join('')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.location} \u2022 {t.service}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-gray-50 to-[#2D9DA8]/5 rounded-3xl p-8 lg:p-12 border border-gray-100">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Ready to Experience SwiftCare?</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              Join our growing family of happy patients. Book your appointment today.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-[#2D9DA8] hover:bg-[#258a94] text-white px-7 py-3.5 rounded-full text-base font-semibold transition-all hover:shadow-xl hover:shadow-[#2D9DA8]/20"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
