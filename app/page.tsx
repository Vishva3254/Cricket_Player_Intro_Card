'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  MapPin, 
  Settings2, 
  Upload, 
  ChevronRight, 
  ChevronLeft,
  CircleDot,
  Dna,
  Trophy,
  History,
  Download
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from "@google/genai";

// --- Custom Icons for Cricket ---
const BatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M14.5 2l7.5 7.5c.3.3.3.8 0 1.1l-10 10c-.3.3-.8.3-1.1 0l-5-5c-.3-.3-.3-.8 0-1.1L12.5 4.5 14.5 2z" />
    <path d="M4 17l-2 5 5-2L4 17z" />
    <path d="M8.5 11l4.5 4.5" />
  </svg>
);

const BallIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" />
    <path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" />
    <path d="M2 12h20" />
  </svg>
);

// --- Types ---
interface PlayerData {
  name: string;
  handedness: string;
  role: string;
  hometown: string;
  photo: string | null;
}

const INITIAL_DATA: PlayerData = {
  name: '',
  handedness: '',
  role: '',
  hometown: '',
  photo: null,
};

export default function PlayerCardGenerator() {
  const [data, setData] = useState<PlayerData>(INITIAL_DATA);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');

  const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

  useEffect(() => {
    const timeoutId = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const generateMasterCard = async () => {
    if (!isFormComplete) return;
    setIsGenerating(true);
    setStep('preview');

    try {
      const templateBase64 = await getBase64FromUrl('/card.png');
      const userPhotoBase64 = data.photo?.split(',')[1];

      if (!userPhotoBase64) throw new Error('Photo required');

      const prompt = `You are a professional graphic designer. 
      I am providing a professional cricket player card template image which consists of a FRONT side (left) and a BACK side (right).
      Please generate a new 16:9 image that is exactly based on this template, but update EVERY text field on both sides to match the following data:

      PLAYER DATA:
      - Name: ${data.name}
      - Handedness: ${data.handedness}
      - Role: ${data.role}
      - Hometown: ${data.hometown}

      SPECIFIC INSTRUCTIONS:
      1. PHOTO: Replace the person's photo in the frame on the LEFT card with the provided player photo.
      2. LEFT CARD NAME: Update the large text to "${data.name}". (Large gold style for last name, white for first name).
      3. LEFT CARD TOP CORNER: Update the label in the top-left gold tab to "${data.role}".
      4. LEFT CARD BOTTOM: Update the text in the bottom bar to show "${data.handedness} ${data.role}" and the hometown to "${data.hometown}".
      5. RIGHT CARD (BACK): In the "PLAYER DETAILS" list on the right, update the text fields for "NAME", "HANDEDNESS", "ROLE", and "HOMETOWN" to match the player data exactly that are Name: "${data.name}", Handedness: "${data.handedness}", Role: "${data.role}", Hometown: "${data.hometown}", respectively.
      6. QUALITY: Maintain all professional textures, gold accents, and deep navy blue colors from the template. The final result must be a clean, high-resolution 16:9 image.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: templateBase64, mimeType: 'image/png' } },
            { inlineData: { data: userPhotoBase64, mimeType: 'image/png' } },
            { text: prompt }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            setGeneratedImageUrl(`data:image/png;base64,${base64Data}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('AI Generation failed:', error);
      // Fallback to HTML design if AI fails
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCard = useCallback(() => {
    if (!generatedImageUrl) return;
    setIsDownloading(true);
    
    try {
      const link = document.createElement('a');
      link.download = `${data.name.replace(/\s+/g, '_')}_cricket_card.png`;
      link.href = generatedImageUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [data.name, generatedImageUrl]);

  const isFormComplete = data.name && data.handedness && data.role && data.hometown && data.photo;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans p-4 md:p-8 flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-8 border-bottom bg-[#041E32] text-[#BFA15E] border-b border-white/10">
              <h1 className="text-3xl font-black italic tracking-tighter flex items-center gap-3 uppercase">
                <Trophy className="w-8 h-8" />
                Player Card AI
              </h1>
              <p className="text-white/60 text-sm mt-2 font-medium tracking-wide">Enter player details to generate the professional 16:9 card</p>
            </div>

            <div className="p-8 grid md:grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Player Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={data.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-[#041E32] placeholder:text-slate-300 uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Handedness *</label>
                <select 
                  name="handedness" 
                  value={data.handedness}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-[#041E32] appearance-none cursor-pointer"
                >
                  <option value="">SELECT</option>
                  <option value="RIGHT HANDED">RIGHT HANDED</option>
                  <option value="LEFT HANDED">LEFT HANDED</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Player Role *</label>
                <select 
                  name="role" 
                  value={data.role}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-[#041E32] appearance-none cursor-pointer"
                >
                  <option value="">SELECT</option>
                  <option value="BATSMAN">BATSMAN</option>
                  <option value="BOWLER">BOWLER</option>
                  <option value="ALL-ROUNDER">ALL-ROUNDER</option>
                  <option value="WICKET KEEPER">WICKET KEEPER</option>
                  <option value="BATSMAN & WICKET KEEPER">BATSMAN & WICKET KEEPER</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Hometown *</label>
                <input 
                  type="text" 
                  name="hometown" 
                  value={data.hometown}
                  onChange={handleInputChange}
                  placeholder="Enter hometown"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-[#041E32] uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Player Photo *</label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full flex items-center justify-center gap-3 px-5 py-4 border-2 border-dashed rounded-2xl transition-all font-bold",
                    data.photo ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-500"
                  )}
                >
                  <Upload className="w-5 h-5" />
                  {data.photo ? "PHOTO ATTACHED" : "UPLOAD PHOTO"}
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col items-center gap-4">
               <button 
                disabled={!isFormComplete || isGenerating}
                onClick={generateMasterCard}
                className={cn(
                  "w-full py-5 rounded-2xl font-black italic tracking-widest text-lg transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3",
                  isFormComplete 
                    ? "bg-[#BFA15E] text-[#041E32] hover:bg-[#d4b06a]" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                )}
               >
                 {isGenerating ? (
                   <div className="w-6 h-6 border-2 border-[#041E32] border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <>
                     GENERATE MASTER CARD
                     <ChevronRight className="w-6 h-6" />
                   </>
                 )}
               </button>
               {!isFormComplete && (
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest italic animate-pulse">
                  * All fields are compulsory to generate card
                </p>
               )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-8 w-full max-w-7xl"
          >
            <div className="flex items-center justify-between w-full px-4">
              <button 
                onClick={() => setStep('form')}
                className="flex items-center gap-2 text-slate-500 font-bold hover:text-[#041E32] transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200"
              >
                <ChevronLeft className="w-5 h-5" />
                EDIT FIELDS
              </button>

              <div className="bg-white px-6 py-2 rounded-full shadow-md border border-slate-200 flex items-center gap-3">
                 <Trophy className="w-4 h-4 text-[#BFA15E]" />
                 <span className="text-xs font-black text-[#041E32] tracking-widest uppercase italic">Master 16:9 Generation</span>
              </div>

              <div className="w-32" /> {/* Spacer */}
            </div>

            {/* --- The Result Display --- */}
            <div className="w-full max-w-full overflow-hidden flex flex-col items-center justify-center bg-white p-8 rounded-[48px] shadow-2xl border border-slate-100">
              <div 
                className="relative bg-slate-900 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex items-center justify-center"
                style={{ 
                  width: '1080px',
                  height: '608px',
                  background: 'linear-gradient(135deg, #020b14 0%, #041e32 100%)',
                }}
              >
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 border-4 border-[#BFA15E] border-t-transparent rounded-full animate-spin" />
                    <div className="text-center space-y-2">
                       <h3 className="text-[#BFA15E] text-2xl font-black italic tracking-widest animate-pulse">AI GENERATING...</h3>
                       <p className="text-white/40 text-sm font-medium tracking-widest uppercase">Analyzing Template • Composing Details • Rendering Results</p>
                    </div>
                  </div>
                ) : generatedImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={generatedImageUrl} alt="Generated Card" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-8 p-12">
                     <div className="flex items-center gap-12">
                        <CardFront data={data} />
                        <CardBack data={data} />
                     </div>
                     <span className="text-white/30 text-xs font-bold uppercase tracking-[0.4em]">Draft Preview (Generating Final...)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <button 
                  disabled={isDownloading}
                  onClick={downloadCard}
                  className="w-full bg-[#041E32] text-[#BFA15E] py-5 rounded-2xl font-black italic tracking-widest text-xl transition-all shadow-2xl hover:bg-[#06243d] flex items-center justify-center gap-3 active:scale-95"
                >
                  {isDownloading ? (
                    <div className="w-6 h-6 border-2 border-[#BFA15E] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-7 h-7" />
                      DOWNLOAD HIGH-RES (16:9)
                    </>
                  )}
                </button>
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em] text-center">
                  PRO-SERIES • CRICKET IDENTITY V1.0
                </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Card Front Side ---
function CardFront({ data }: { data: PlayerData }) {
  const firstName = data.name.split(' ')[0] || '';
  const lastName = data.name.split(' ').slice(1).join(' ') || '';

  return (
    <div
      className="relative w-[400px] h-[580px] rounded-[32px] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] border-4 border-[#122438] shrink-0"
      style={{
        background: '#041E32',
      }}
    >
      {/* Background Grunge Texture */}
      <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none" 
        style={{ 
          backgroundImage: `url("https://www.transparenttextures.com/patterns/black-linen.png")`,
        }} 
      />
      
      {/* Brush Stroke Effect (Top Right and Left) */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-20">
         <div className="absolute top-[-10%] right-[-10%] w-[120%] h-[120%] bg-gradient-to-bl from-white/20 to-transparent transform rotate-12 blur-3xl" />
      </div>

      {/* Top Left Role Tab */}
      <div className="absolute top-0 left-0 z-50">
        <div className="relative">
          {/* Gold Tab Shape */}
          <div className="bg-[#BFA15E] px-8 py-3 pr-10" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)' }}>
            <span className="text-[14px] font-black italic tracking-widest text-[#041E32]">{data.role}</span>
          </div>
          {/* Icon below tab */}
          <div className="px-6 py-2">
             <div className="w-10 h-10 rounded-full border-2 border-[#BFA15E] flex items-center justify-center text-[#BFA15E]">
                <BallIcon />
             </div>
          </div>
        </div>
      </div>

      {/* Main Photo Frame (Octagonal) */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[92%] h-[68%] z-10">
        {/* Outer Gold Border */}
        <div className="relative w-full h-full p-2 bg-[#BFA15E]" 
          style={{
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
          }}
        >
          {/* Inner Photo Frame */}
          <div className="w-full h-full bg-[#041E32] relative overflow-hidden"
            style={{
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
            }}
          >
            {data.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={data.photo} 
                alt="Player Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/10 p-12 text-center">
                <User className="w-32 h-32 mb-4" />
                <p className="text-xl font-bold uppercase tracking-[0.2em]">NO IMAGE</p>
              </div>
            )}
            
            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#041E32]/80 via-transparent to-transparent" />
          </div>
        </div>
      </div>

      {/* Name Display */}
      <div className="absolute bottom-[18%] left-10 right-10 z-20">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col items-start"
        >
          <div className="bg-[#041E32] pl-3 pr-8 py-0.5 border-t-2 border-r-2 border-[#BFA15E]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
            <h2 className="text-[28px] font-black italic tracking-tighter text-white uppercase leading-tight">
              {firstName}
            </h2>
          </div>
          <h1 
            className="text-[100px] font-black italic tracking-tight leading-[0.65] -mt-1 drop-shadow-[0_8px_8px_rgba(0,0,0,0.8)]"
            style={{
              color: '#BFA15E',
              backgroundImage: 'linear-gradient(to bottom, #F5E6AB 0%, #BFA15E 50%, #8A6D3B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {lastName}
          </h1>

          {/* Decorative Gold Line with star */}
          <div className="w-full flex items-center gap-2 mt-4 ml-2">
            <div className="h-[2px] w-full bg-gradient-to-r from-white to-transparent" />
            <div className="text-[#BFA15E] text-2xl flex items-center gap-2">
              <span>★</span>
              <div className="h-[2px] w-24 bg-gradient-to-l from-white to-transparent" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Information Tab */}
      <div className="absolute bottom-4 left-4 right-4 z-30">
        <div className="relative h-[68px] w-full bg-gradient-to-r from-[#BFA15E] to-[#9A7B4F] rounded-lg overflow-hidden flex items-stretch shadow-2xl border-b-2 border-black/20">
           {/* Left Silhouette Overlay */}
           <div className="w-20 h-full bg-[#041E32] flex items-center justify-center relative overflow-hidden">
             {/* Player Silhouette Placeholder */}
             <div className="absolute inset-0 flex items-end justify-center">
                <svg viewBox="0 0 24 24" className="w-14 h-14 text-[#BFA15E] translate-y-2 opacity-80" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
             </div>
             <div className="absolute right-0 top-0 h-full w-[1px] bg-white/10" />
           </div>

           {/* Style Details */}
           <div className="flex-1 px-4 flex flex-col justify-center border-l border-[#041E32]/30 bg-white/10">
              <span className="text-[9px] font-black text-[#041E32] tracking-widest leading-none mb-1 opacity-60">RIGHT HANDED</span>
              <span className="text-[15px] font-black text-[#041E32] uppercase truncate tracking-tighter leading-none">
                {data.role}
              </span>
           </div>

           {/* Location */}
           <div className="flex-1 px-4 flex flex-col justify-center relative bg-white/5 border-l border-[#041E32]/20">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#041E32]" />
                <span className="text-[15px] font-black text-[#041E32] uppercase truncate tracking-tighter leading-none">
                  {data.hometown}
                </span>
              </div>
           </div>
        </div>
      </div>

    </div>
  );
}

// --- Card Back Side ---
function CardBack({ data }: { data: PlayerData }) {
  return (
    <div
      className="relative w-[400px] h-[580px] rounded-[32px] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] border-4 border-[#122438] px-10 py-12 flex flex-col shrink-0"
      style={{
        background: '#FFFFFF',
      }}
    >
      {/* Background Dots Pattern */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" 
        style={{ 
          backgroundImage: `radial-gradient(#122438 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} 
      />

      {/* Header Section */}
      <div className="relative text-center mb-12">
        <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn("text-[#BFA15E] drop-shadow-sm", i === 2 ? "scale-150" : "scale-100")}>★</div>
            ))}
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <div className="h-1 flex-1 bg-gradient-to-r from-transparent to-[#BFA15E]" />
          <h2 className="text-[20px] font-black tracking-widest text-[#041E32] uppercase flex items-center gap-2">
            <span className="text-[#BFA15E]">=</span>
            PLAYER DETAILS
            <span className="text-[#BFA15E]">=</span>
          </h2>
          <div className="h-1 flex-1 bg-gradient-to-l from-transparent to-[#BFA15E]" />
        </div>

        {/* Decorative Polygonal Header Shape */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[110%] h-24 bg-[#041E32] -z-10" 
             style={{ clipPath: 'polygon(15% 0, 85% 0, 100% 100%, 0 100%)' }}>
          <div className="absolute inset-0 m-1 bg-white" style={{ clipPath: 'polygon(15% 0, 85% 0, 100% 100%, 0 100%)' }} />
          <div className="absolute inset-0 m-2 bg-slate-50 shadow-inner" style={{ clipPath: 'polygon(15% 0, 85% 0, 100% 100%, 0 100%)' }} />
        </div>
      </div>

      {/* Details List */}
      <div className="flex-1 space-y-10">
         <DetailRow icon={<User className="w-6 h-6"/>} label="NAME" value={data.name} />
         <DetailRow icon={<BatIcon />} label="HANDEDNESS" value={data.handedness} />
         <DetailRow icon={<BallIcon />} label="ROLE" value={data.role} />
         <DetailRow icon={<MapPin className="w-6 h-6"/>} label="HOMETOWN" value={data.hometown} />
      </div>

      {/* Bottom Crest Section */}
      <div className="mt-auto flex flex-col items-center relative">
         <div className="relative w-28 h-32 flex flex-col items-center justify-center">
            {/* Shield Base */}
            <div className="absolute inset-0 bg-[#041E32]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }}>
              <div className="absolute inset-0 m-1 bg-[#BFA15E]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }}>
                <div className="absolute inset-0 m-1 bg-[#041E32]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
              </div>
            </div>
            
            {/* Shield Content */}
            <div className="relative z-10 flex flex-col items-center -translate-y-2">
               <div className="text-[#BFA15E] mb-1 scale-75">★</div>
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#041E32] shadow-inner mb-2 border-2 border-[#BFA15E]">
                  <BallIcon />
               </div>
            </div>

            {/* Laurels */}
            <div className="absolute bottom-4 -left-6 -right-6 flex justify-between">
               <div className="text-2xl text-[#041E32] drop-shadow-sm transform rotate-45">🌿</div>
               <div className="text-2xl text-[#041E32] drop-shadow-sm transform -rotate-45 scale-x-[-1]">🌿</div>
            </div>
         </div>
         
         <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#BFA15E] to-transparent mt-2" />
         <div className="w-[80%] h-[1px] bg-gradient-to-r from-transparent via-[#BFA15E] to-transparent mt-1 opacity-40" />
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex items-center gap-6 group relative"
    >
      <div className="w-14 h-14 rounded-full bg-[#041E32] flex items-center justify-center text-white border-2 border-[#BFA15E] shadow-lg group-hover:rotate-12 transition-transform relative z-10">
        {icon}
      </div>
      
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-3">
          <div className="w-[2px] h-8 bg-[#BFA15E]" />
          <div>
            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase block -mb-1">{label}</span>
            <span className="text-2xl font-black text-[#041E32] tracking-tight truncate uppercase leading-none">{value || '---'}</span>
          </div>
        </div>
        
        {/* Horizontal Underline with Gold Caps */}
        <div className="mt-1 relative h-2">
           <div className="absolute bottom-0 left-0 w-full h-[1px] bg-slate-200" />
           <div className="absolute bottom-0 left-0 h-[2px] bg-[#BFA15E] w-1/2 group-hover:w-full transition-all duration-700" />
           
           {/* Decorative Caps on the right */}
           <div className="absolute bottom-0 right-0 flex gap-0.5">
              <div className="w-2 h-4 border-r-2 border-b-2 border-[#BFA15E] -skew-x-12" />
              <div className="w-2 h-4 border-r-2 border-b-2 border-[#BFA15E] -skew-x-12 opacity-60" />
           </div>
        </div>
      </div>
    </motion.div>
  );
}
