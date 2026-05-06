'use client'

import Link from 'next/link'
import Image from 'next/image'
import { 
  Calendar, 
  Users, 
  Shield, 
  Clock, 
  Star, 
  Phone, 
  Heart,
  Award,
  CheckCircle,
  MapPin,
  Mail,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  Facebook,
  ChevronRight
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { AnnouncementBanner } from '@/components/announcements/announcement-banner'

type ServiceCard = {
  id?: string
  name: string
  tagalog: string
  image: string
  desc: string
  priceDisplay?: string | null
}

const SERVICES_FALLBACK: ServiceCard[] = [
  { name: 'Dental Consultation', tagalog: '', image: '/services/consultation.jpg', desc: 'Comprehensive dental evaluation and personalized treatment plans' },
  { name: 'Tooth Extraction', tagalog: 'Bunot', image: '/services/extraction.jpg', desc: 'Safe and gentle removal of damaged or problematic teeth' },
  { name: 'Tooth Restoration', tagalog: 'Pasta', image: '/services/restoration.jpg', desc: 'Fillings and repairs to restore teeth to their natural form' },
  { name: 'Oral Prophylaxis', tagalog: 'Linis', image: '/services/oral-prophylaxis.jpg', desc: 'Professional teeth cleaning to remove plaque and tartar buildup' },
  { name: 'Dentures', tagalog: 'Pustiso', image: '/services/dentures.jpg', desc: 'Custom-made removable replacements for missing teeth' },
  { name: 'Fixed Bridge', tagalog: '', image: '/services/fixed-bridge.jpg', desc: 'Permanent bridge to replace one or more missing teeth' },
  { name: 'Jacket Crowns', tagalog: '', image: '/services/crown.jpg', desc: 'Custom caps to restore damaged teeth and improve appearance' },
  { name: 'Veneers', tagalog: '', image: '/services/veneers.jpg', desc: 'Thin shells for a flawless, natural-looking smile' },
  { name: 'Fluoride Application', tagalog: '', image: '/services/fluoride.jpg', desc: 'Strengthen enamel and prevent cavities' },
  { name: 'Pit & Fissure Sealant', tagalog: '', image: '/services/sealant.jpg', desc: 'Protective coating to prevent decay in molars' },
  { name: 'Orthodontic Treatment', tagalog: 'Braces', image: '/services/orthodontics.jpg', desc: 'Teeth alignment and bite correction for a perfect smile' },
  { name: 'Root Canal Treatment', tagalog: '', image: '/services/root-canal.jpg', desc: 'Save infected teeth with expert endodontic treatment' },
  { name: 'Teeth Whitening', tagalog: '', image: '/services/teeth-whitening.jpg', desc: 'Brighten your smile with professional whitening treatments' },
  { name: 'Wisdom Tooth Removal', tagalog: '', image: '/services/wisdom-tooth.jpg', desc: 'Expert surgical removal of impacted wisdom teeth' },
  { name: 'X-ray', tagalog: '', image: '/services/xray.jpg', desc: 'Digital imaging for accurate diagnosis and treatment planning' },
]

type ClinicInfo = {
  name: string
  phone: string
  email: string
  address: string
  facebookUrl: string
  googleMapsUrl: string
}

const CLINIC_FALLBACK: ClinicInfo = {
  name: 'SwiftCare Dental Clinic',
  phone: '',
  email: 'swiftcaredental@gmail.com',
  address: '2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac',
  facebookUrl: 'https://www.facebook.com/swiftcaredentalclinic',
  googleMapsUrl: 'https://www.google.com/maps/search/Sicangco+Building+MacArthur+Highway+San+Rafael+Tarlac+Philippines',
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeService, setActiveService] = useState(0)
  const [services, setServices] = useState<ServiceCard[]>(SERVICES_FALLBACK)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC_FALLBACK)
  const servicesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch public clinic info (name, phone, email, address, etc.)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/settings/public')
        if (!res.ok) return
        const json = await res.json()
        const map = json?.data?.settings || json?.settings || {}
        if (cancelled) return
        setClinic((prev) => ({
          name: map.clinic_name || prev.name,
          phone: map.clinic_phone || prev.phone,
          email: map.clinic_email || prev.email,
          address: map.clinic_address || prev.address,
          facebookUrl: map.facebook_url || prev.facebookUrl,
          googleMapsUrl: map.google_maps_url || prev.googleMapsUrl,
        }))
      } catch {
        // keep fallback values
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch live services from API (public, only active + websiteVisible)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/book/services')
        if (!res.ok) return
        const json = await res.json()
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : [])
        if (cancelled || !list.length) return
        const mapped: ServiceCard[] = list.map((s: any) => {
          const svcName = s.displayName || s.name
          const fallbackMatch = SERVICES_FALLBACK.find(
            f => f.name.toLowerCase() === svcName.toLowerCase()
          )
          return {
            id: s.id,
            name: svcName,
            tagalog: s.tagalog || (fallbackMatch?.tagalog ?? ''),
            image: s.imageUrl || fallbackMatch?.image || '/services/consultation.jpg',
            desc: s.description || (fallbackMatch?.desc ?? ''),
            priceDisplay: s.priceDisplay || null,
          }
        })
        setServices(mapped)
      } catch {
        // fall back to hard-coded list on any error
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-rotate featured services
  useEffect(() => {
    const count = Math.min(6, services.length)
    if (count < 2) return
    const interval = setInterval(() => {
      setActiveService(prev => (prev + 1) % count)
    }, 4000)
    return () => clearInterval(interval)
  }, [services.length])

  const featuredServices = services.slice(0, 6)

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center min-w-0">
            <div className="relative w-32 h-10 xs:w-40 xs:h-12 sm:w-52 sm:h-16 flex-shrink-0">
              <Image src="/clinic/logo.png" alt="SwiftCare Dental Clinic" fill className="object-contain" priority />
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-gray-600 hover:text-[#2D9DA8] transition-colors text-sm font-medium">Services</a>
            <a href="#about" className="text-gray-600 hover:text-[#2D9DA8] transition-colors text-sm font-medium">About</a>
            <a href="#contact" className="text-gray-600 hover:text-[#2D9DA8] transition-colors text-sm font-medium">Contact</a>
            <Link href="/auth/signin" className="text-gray-600 hover:text-[#2D9DA8] transition-colors text-sm font-medium">Staff Login</Link>
            <Link
              href="/book"
              className="bg-[#2D9DA8] hover:bg-[#258a94] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:shadow-lg"
            >
              Book Now
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-700">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-6 py-4 space-y-3">
              <a href="#services" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-[#2D9DA8] font-medium py-2">Services</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-[#2D9DA8] font-medium py-2">About</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-[#2D9DA8] font-medium py-2">Contact</a>
              <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)} className="block text-gray-700 hover:text-[#2D9DA8] font-medium py-2">Staff Login</Link>
              <Link href="/book" className="block bg-[#2D9DA8] text-white text-center px-5 py-3 rounded-full font-semibold">Book Now</Link>
            </div>
          </div>
        )}
      </header>

      {/* Announcements */}
      <div className="pt-16 sm:pt-20 px-3 sm:px-6 max-w-7xl mx-auto">
        <AnnouncementBanner placement="homepage" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-4 sm:pt-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center min-h-[calc(100vh-4rem)] py-8 sm:py-12 lg:py-0">
            {/* Left - Text Content */}
            <div className="order-2 lg:order-1 space-y-4 sm:space-y-6 lg:space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#2D9DA8]/10 text-[#2D9DA8] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate">Your Trusted Dental Partner in Tarlac</span>
                </div>
                <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight">
                  A Healthier Smile
                  <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-[#2D9DA8] to-[#22B573] bg-clip-text text-transparent">
                    Starts Here
                  </span>
                </h1>
              </div>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
                Experience gentle, professional dental care in a warm and welcoming environment. From routine cleanings to advanced treatments — we've got your smile covered.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 bg-[#2D9DA8] hover:bg-[#258a94] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-semibold transition-all hover:shadow-xl hover:shadow-[#2D9DA8]/20 hover:-translate-y-0.5 w-full sm:w-auto"
                >
                  Book Appointment
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
                <a
                  href="#services"
                  className="inline-flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-[#2D9DA8] text-gray-700 hover:text-[#2D9DA8] px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-semibold transition-all w-full sm:w-auto"
                >
                  View Services
                </a>
              </div>
              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <Shield className="w-5 h-5 text-[#22B573]" />
                  <span className="text-sm font-medium">Licensed Dentists</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-5 h-5 text-[#22B573]" />
                  <span className="text-sm font-medium">Same-Day Appointments</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Heart className="w-5 h-5 text-[#22B573]" />
                  <span className="text-sm font-medium">Patient-First Care</span>
                </div>
              </div>
            </div>

            {/* Right - Hero Image Collage */}
            <div className="order-1 lg:order-2 relative">
              <div className="relative aspect-[4/3] lg:aspect-square max-w-lg mx-auto lg:max-w-none">
                {/* Main Image */}
                <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src="/clinic/reception-front.jpg"
                    alt="SwiftCare Dental Clinic reception area"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                {/* Floating Card - Treatment Room */}
                <div className="absolute -bottom-4 left-2 sm:-bottom-6 sm:-left-6 w-28 h-28 sm:w-40 sm:h-40 rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                  <Image
                    src="/clinic/treatment-room.jpg"
                    alt="Modern dental treatment room"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-12 sm:py-20 lg:py-28 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="text-center mb-8 sm:mb-14">
            <p className="text-[#2D9DA8] font-semibold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">Our Services</p>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
              Complete Dental Care
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-lg px-2">
              From preventive to restorative — we offer a full range of services for your entire family.
            </p>
          </div>

          {/* Featured Service Showcase */}
          {featuredServices[activeService] && (
          <div className="mb-16">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Service Image */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg bg-muted">
                <Image
                  src={featuredServices[activeService].image}
                  alt={featuredServices[activeService].name}
                  fill
                  className="object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10" />
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 drop-shadow-lg">
                  <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 break-words" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                    {featuredServices[activeService].name}
                    {featuredServices[activeService].tagalog && (
                      <span className="text-white text-sm sm:text-lg font-normal ml-1 sm:ml-2 break-words">({featuredServices[activeService].tagalog})</span>
                    )}
                  </h3>
                  <p className="text-white text-xs sm:text-sm line-clamp-2 sm:line-clamp-none" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{featuredServices[activeService].desc}</p>
                  {featuredServices[activeService].priceDisplay && (
                    <p className="text-white/95 text-xs sm:text-sm font-semibold mt-1 sm:mt-2 bg-white/15 backdrop-blur-sm inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                      {featuredServices[activeService].priceDisplay}
                    </p>
                  )}
                </div>
              </div>
              {/* Service Tabs */}
              <div className="space-y-2 sm:space-y-3">
                {featuredServices.map((service, i) => (
                  <button
                    key={service.name}
                    onClick={() => setActiveService(i)}
                    className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all duration-300 flex items-center gap-3 sm:gap-4 group ${
                      activeService === i
                        ? 'bg-[#2D9DA8] text-white shadow-lg shadow-[#2D9DA8]/20'
                        : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
                    }`}
                  >
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      activeService === i ? 'bg-white/20' : 'bg-[#2D9DA8]/10'
                    }`}>
                      <CheckCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        activeService === i ? 'text-white' : 'text-[#2D9DA8]'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base break-words">
                        {service.name}
                        {service.tagalog && (
                          <span className={`font-normal ml-1 sm:ml-1.5 text-xs sm:text-sm ${
                            activeService === i ? 'text-white' : 'text-gray-600'
                          }`}>({service.tagalog})</span>
                        )}
                      </p>
                      <p className={`text-xs sm:text-sm line-clamp-2 ${
                        activeService === i ? 'text-white/90' : 'text-gray-500'
                      }`}>{service.desc}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform ${
                      activeService === i ? 'text-white translate-x-0.5' : 'text-gray-300 group-hover:text-gray-400'
                    }`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* All Services Grid */}
          <div ref={servicesRef}>
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">All Services</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {services.map((service) => (
                <div key={service.id || service.name} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="relative aspect-[3/2] bg-muted">
                    <Image src={service.image} alt={service.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{service.name}</p>
                    {service.tagalog && (
                      <p className="text-xs text-[#2D9DA8] mt-0.5">({service.tagalog})</p>
                    )}
                    {service.priceDisplay && (
                      <p className="text-xs text-gray-500 mt-1 font-medium">{service.priceDisplay}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-6 italic">
              All prices shown are estimates. Final fees are confirmed during your consultation based on your specific needs.
            </p>
          </div>
        </div>
      </section>

      {/* About / Why Choose Us */}
      <section id="about" className="py-12 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Images */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg">
                  <Image src="/clinic/reception-1.jpg" alt="Welcoming clinic reception" fill className="object-cover" />
                </div>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg mt-8">
                  <Image src="/clinic/treatment-area.jpg" alt="Modern treatment area" fill className="object-cover" />
                </div>
              </div>
              {/* Experience Badge */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-[#2D9DA8] to-[#22B573] rounded-xl flex items-center justify-center">
                  <Award className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">Trusted</p>
                  <p className="text-sm text-gray-500">by families in Tarlac</p>
                </div>
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-6 lg:pl-4">
              <div>
                <p className="text-[#2D9DA8] font-semibold text-sm tracking-wider uppercase mb-3">Why SwiftCare</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                  Dental Care That Puts
                  <span className="block text-[#2D9DA8]">You First</span>
                </h2>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                At SwiftCare Dental Clinic, we combine modern technology with compassionate care. Our team is dedicated to making every visit comfortable and stress-free.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Users, title: 'Experienced Team', desc: 'Licensed dentists with years of clinical experience' },
                  { icon: Shield, title: 'Safe & Sterile', desc: 'Strict sterilization protocols and modern equipment' },
                  { icon: Heart, title: 'Gentle Approach', desc: 'Anxiety-free dental care for patients of all ages' },
                  { icon: Clock, title: 'Flexible Scheduling', desc: 'Easy online booking with same-day availability' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-[#2D9DA8]/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-5 h-5 text-[#2D9DA8]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-gray-50 to-[#2D9DA8]/5 rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-16 shadow-sm border border-gray-100">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Ready for a Brighter Smile?
            </h2>
            <p className="text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
              Book your appointment today and take the first step towards better dental health. Walk-ins are also welcome!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 bg-[#2D9DA8] hover:bg-[#258a94] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-semibold transition-all hover:shadow-xl hover:shadow-[#2D9DA8]/20"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                Book Appointment
              </Link>
              <a
                href={clinic.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-[#2D9DA8] text-gray-700 hover:text-[#2D9DA8] px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-semibold transition-all"
              >
                <Facebook className="w-4 h-4 sm:w-5 sm:h-5" />
                Message Us on Facebook
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-12 sm:py-20 lg:py-24 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-[#2D9DA8] font-semibold text-sm tracking-wider uppercase mb-3">Contact</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Get In Touch
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto">
              Visit us or reach out — we&apos;re happy to help with any questions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {[
              { icon: MapPin, label: 'Location', value: clinic.address, href: clinic.googleMapsUrl },
              { icon: Phone, label: 'Call Us', value: clinic.phone || 'Call for appointment', href: clinic.phone ? `tel:${clinic.phone.replace(/\s+/g, '')}` : 'tel:' },
              { icon: Mail, label: 'Email', value: clinic.email, href: clinic.email ? `mailto:${clinic.email}` : 'mailto:' },
              { icon: Facebook, label: 'Facebook', value: clinic.name, href: clinic.facebookUrl },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-center">
                <div className="w-12 h-12 bg-[#2D9DA8]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-[#2D9DA8]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{item.label}</h3>
                {item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="text-sm text-[#2D9DA8] hover:underline break-all"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-sm text-gray-600">{item.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* Map + Get Directions */}
          <div className="mt-10 max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3838.7!2d120.5972!3d15.4511!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSicangco+Building%2C+MacArthur+Hwy%2C+San+Rafael%2C+Tarlac!5e0!3m2!1sen!2sph!4v1700000000000"
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="SwiftCare Dental Clinic location"
                className="w-full"
              />
              <div className="bg-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <MapPin className="w-5 h-5 text-[#2D9DA8] shrink-0" />
                  <p className="text-sm font-medium">{clinic.address}</p>
                </div>
                <a
                  href={clinic.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinic.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#2D9DA8] hover:bg-[#258a94] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:shadow-lg shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  Get Directions
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="relative w-44 h-14 mb-4">
                <Image src="/clinic/logo.png" alt="SwiftCare Dental Clinic" fill className="object-contain brightness-0 invert" />
              </div>
              <p className="text-sm leading-relaxed">
                Premium dental care in a warm, welcoming environment.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <a href="#services" className="block text-sm hover:text-white transition-colors">Services</a>
                <a href="#about" className="block text-sm hover:text-white transition-colors">About Us</a>
                <Link href="/testimonials" className="block text-sm hover:text-white transition-colors">Patient Stories</Link>
                <Link href="/book" className="block text-sm hover:text-white transition-colors">Book Appointment</Link>
                <Link href="/auth/signin" className="block text-sm hover:text-white transition-colors">Staff Login</Link>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Clinic Hours</h4>
              <div className="space-y-2 text-sm">
                <p>Monday – Saturday: 9:00 AM – 6:00 PM</p>
                <p className="text-[#2D9DA8]">Sunday: By Appointment Only</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2025 SwiftCare Dental Clinic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
