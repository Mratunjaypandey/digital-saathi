import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Home, CreditCard, Heart, BookOpen, Layers, User, Loader, LogOut, CheckCircle, XCircle, ChevronLeft, BarChart, Film, Shield, Zap, QrCode, Wifi, WifiOff, Volume2, Globe, Sun, Moon, X, Banknote, ClipboardList, Lightbulb, TrendingUp, Handshake, Briefcase, Smile, Lock, ChevronRight, Phone, Mail, Award, Flame, Clock, MessageCircle, Train, PlayCircle, ArrowRight, Cloud, Smartphone } from 'lucide-react';

// --- 0. SUPABASE CONFIGURATION ---
// ⚠️ REPLACE WITH YOUR PROJECT DETAILS
const SUPABASE_CONFIG = {
    url: "https://ngzcjpxgyhyolklmokje.supabase.co", 
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nemNqcHhneWh5b2xrbG1va2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODg4MjgsImV4cCI6MjA3OTY2NDgyOH0.K7FIGEZg4QcGUagwI_hN4_cz3I_jlCW1A5ShrRvhSG0",
    enabled: true 
};

// --- 1. UTILS & HELPERS ---

const OFFLINE_KEY = "ds_offline_";

const getLocalItem = (key) => {
  try {
    const item = localStorage.getItem(OFFLINE_KEY + key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

const setLocalItem = (key, value) => {
  try {
    localStorage.setItem(OFFLINE_KEY + key, JSON.stringify(value));
  } catch (e) {}
};

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const generateStudentId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `DS-${year}-${random}`;
};

const calculateLearningMinutes = (progress) => {
    const completedCount = Object.values(progress).filter(p => p.isCompleted).length;
    const totalAttempts = Object.values(progress).reduce((acc, curr) => acc + (curr.attempts || 0), 0);
    return (completedCount * 15) + (totalAttempts * 5);
};

// IMPROVED VIDEO URL HELPER
const getEmbedUrl = (url) => {
    if (!url) return '';
    
    try {
        // Case 1: Already an embed link
        if (url.includes('/embed/')) {
            return url;
        }

        let videoId = '';

        // Case 2: Standard URL (youtube.com/watch?v=ID)
        if (url.includes('v=')) {
            const urlParams = new URLSearchParams(url.split('?')[1]);
            videoId = urlParams.get('v');
        } 
        // Case 3: Short URL (youtu.be/ID)
        else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0];
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
        }

        // Fallback: Return original if pattern not matched (might be non-youtube)
        return url;
    } catch (e) {
        console.error("Error parsing video URL:", e);
        return url;
    }
};

// --- 2. SUPABASE API CLIENT ---

const isMockMode = () => !SUPABASE_CONFIG.enabled || SUPABASE_CONFIG.url.includes("your-project-id");

// Helper to format mobile as email for Supabase Auth
const resolveAuthEmail = (input) => {
    if (input.includes('@')) return input;
    return `${input.replace(/\D/g, '')}@digitalsaathi.local`;
};

const authApi = {
    login: async (identifier, password) => {
        if (isMockMode()) {
             return { user: { id: generateUUID() }, session: { access_token: `mock-token-${Date.now()}` } };
        }

        const email = resolveAuthEmail(identifier);
        const url = `${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=password`;
        const headers = { 'apikey': SUPABASE_CONFIG.key, 'Content-Type': 'application/json' };
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed. Please check your credentials.");
            return { user: data.user, session: data };
        } catch (e) {
            return { error: e.message };
        }
    },

    register: async (mobile, password, email) => {
        if (isMockMode()) {
            return { user: { id: generateUUID() }, session: { access_token: `mock-token-${Date.now()}` } };
        }

        const authEmail = resolveAuthEmail(mobile);
        
        const url = `${SUPABASE_CONFIG.url}/auth/v1/signup`;
        const headers = { 'apikey': SUPABASE_CONFIG.key, 'Content-Type': 'application/json' };
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    email: authEmail, 
                    password,
                    data: { real_email: email } 
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.msg || data.error_description || "Registration failed");
            
            const session = data.session || (data.access_token ? data : null);
            return { user: data.user, session }; 
        } catch (e) {
            return { error: e.message };
        }
    },

    resetPassword: async (input) => {
        if (isMockMode()) return { success: true };
        
        const email = resolveAuthEmail(input);
        const url = `${SUPABASE_CONFIG.url}/auth/v1/recover`;
        const headers = { 'apikey': SUPABASE_CONFIG.key, 'Content-Type': 'application/json' };
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.msg || "Recovery request failed");
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }
};

const supabaseRequest = async (table, method, body, queryParams = '', token = null) => {
    if (isMockMode()) return { error: 'Mock Mode' };
    if (!token || token.startsWith('mock-')) return { error: 'Local Token' };

    const headers = {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    try {
        const url = `${SUPABASE_CONFIG.url}/rest/v1/${table}${queryParams}`;
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const text = await response.text();
            return { error: text };
        }
        
        if (method === 'GET') return await response.json();
        return { error: null };
    } catch (e) {
        return { error: e.message };
    }
};

const syncProfileToSupabase = async (profile, token) => {
    const profileRow = {
        id: profile.uid,
        student_id: profile.studentId,
        full_name: profile.name,
        mobile: profile.mobile,  
        email: profile.email,    
        dob: profile.dob || null,
        state: profile.state || null,
        district: profile.district || null,
        village: profile.village || null,
        is_registered: profile.isRegistered,
        updated_at: new Date().toISOString()
    };
    await supabaseRequest('profiles', 'POST', profileRow, '?on_conflict=id', token);
};

const pushToRealSupabase = async (userId, progressData, token) => {
    const updates = Object.entries(progressData).map(([topicId, stats]) => ({
        user_id: userId,
        topic_id: topicId,
        category_id: stats.categoryId || 'general', 
        attempts: stats.attempts,
        highest_score: stats.highestScore,
        last_score: stats.lastScore || 0,
        is_completed: stats.isCompleted,
        last_attempt: stats.lastAttempt,
        updated_at: new Date().toISOString()
    }));

    if (updates.length === 0) return;

    await supabaseRequest('user_progress', 'POST', updates, '?on_conflict=user_id,topic_id', token);
};

const fetchUserData = async (userId, token) => {
    if (!token || token.startsWith('mock-')) return null;

    try {
        const profiles = await supabaseRequest('profiles', 'GET', null, `?id=eq.${userId}&select=*`, token);
        let fetchedProfile = null;
        
        if (Array.isArray(profiles) && profiles.length > 0) {
            const p = profiles[0];
            fetchedProfile = {
                uid: p.id,
                studentId: p.student_id,
                name: p.full_name,
                mobile: p.mobile, 
                email: p.email,   
                dob: p.dob,
                state: p.state,
                district: p.district,
                village: p.village,
                isRegistered: p.is_registered
            };
        }

        const progressRows = await supabaseRequest('user_progress', 'GET', null, `?user_id=eq.${userId}&select=*`, token);
        let fetchedProgress = {};
        
        if (Array.isArray(progressRows)) {
            progressRows.forEach(row => {
                fetchedProgress[row.topic_id] = {
                    attempts: row.attempts,
                    highestScore: row.highest_score,
                    lastScore: row.last_score,
                    isCompleted: row.is_completed,
                    lastAttempt: row.last_attempt,
                    categoryId: row.category_id
                };
            });
        }

        return { profile: fetchedProfile, progress: fetchedProgress };
    } catch (e) {
        return null;
    }
};

const mockSupabaseUpsertProgress = (userId, progressData, token) => {
  if (!isMockMode() && token) {
      pushToRealSupabase(userId, progressData, token);
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      setLocalItem(`progress_${userId}`, progressData);
      resolve({ data: progressData, error: null });
    }, 300); 
  });
};

// --- 3. CONTENT DATA ---
const mockLearningData = [
  { id: 'payments', name: 'Digital Payments', icon: Banknote, color: 'from-green-600 to-green-700', topics: [
      { id: 'upi_intro', name: 'UPI Setup', categoryId: 'payments', videoUrl: <iframe width="560" height="315" src="https://www.youtube.com/embed/hoWntPVrCcM?si=QJgcds1pWSyTPjkC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>, description: 'Register for UPI & link bank account.', simulation: true, quiz: [
          { question: "What is the full form of UPI?", options: ["Unified Payments Interface", "Union Pay India", "United Payment Interconnect", "Universal Pay ID"], answer: 0 },
          { question: "How many digits is a standard UPI PIN?", options: ["2 or 3", "4 or 6", "8", "10"], answer: 1 },
          { question: "Can you use UPI without internet?", options: ["No, never", "Yes, via *99# USSD", "Only on weekends", "Only for SBI"], answer: 1 },
          { question: "What should you NEVER share?", options: ["Your Name", "UPI ID", "UPI PIN", "QR Code"], answer: 2 },
          { question: "Is a bank account mandatory for UPI?", options: ["No", "Yes", "Maybe", "Only for merchants"], answer: 1 }
      ]},
      { id: 'wallet', name: 'Mobile Wallets', categoryId: 'payments', videoUrl: 'https://www.youtube.com/watch?v=8K71e3r-7fE', description: 'Using PayTM/PhonePe wallets.', simulation: false, quiz: [
          { question: "Do you need a bank account to USE wallet money?", options: ["Yes", "No", "Maybe", "Only for credit"], answer: 1 },
          { question: "Is KYC required for wallets?", options: ["Yes", "for full limits", "No, never", "Only for students", "Only for seniors"], answer: 0 },
          { question: "Can you withdraw cash from a wallet at an ATM?", options: ["Yes, always", "No, unless you have a specific card", "Only on Sundays", "Never"], answer: 1 },
          { question: "Wallet is linked to?", options: ["Email", "Mobile Number", "Home Address", "PAN only"], answer: 1 },
          { question: "If phone is lost, is wallet money safe?", options: ["No", "Yes, if app is locked/PIN protected", "Only if you call police", "Money disappears"], answer: 1 }
      ]}
  ]},
  { id: 'communication', name: 'Communication', icon: MessageCircle, color: 'from-teal-600 to-teal-700', topics: [
      { id: 'whatsapp_basic', name: 'WhatsApp Basics', categoryId: 'communication', videoUrl: 'https://www.youtube.com/watch?v=N74hQ2Z_kCg', description: 'Sending messages, photos and voice notes.', simulation: true, quiz: [
          { question: "What is needed to use WhatsApp?", options: ["Only Phone", "Internet & Phone Number", "Email only", "Aadhar Card"], answer: 1 },
          { question: "What does one grey tick mean?", options: ["Message Sent", "Message Delivered", "Message Read", "Message Failed"], answer: 0 },
          { question: "Can you unsend a message?", options: ["No", "Yes, 'Delete for Everyone'", "Only within 1 second", "Only if blocked"], answer: 1 },
          { question: "Is WhatsApp Status public?", options: ["Yes, to whole world", "No, only to contacts (privacy settings)", "Only to Google", "Only to Admin"], answer: 1 },
          { question: "What is a Group?", options: ["A single chat", "Chat with multiple people", "A paid feature", "A virus"], answer: 1 }
      ]},
      { id: 'email_basic', name: 'Email Basics', categoryId: 'communication', videoUrl: 'https://www.youtube.com/watch?v=A6P6aN4cM_U', description: 'Creating an account and sending emails.', simulation: false, quiz: [
          { question: "What symbol is mandatory in email ID?", options: ["#", "@", "&", "$"], answer: 1 },
          { question: "Where do you write the main message?", options: ["Subject Line", "Body", "To", "CC"], answer: 1 },
          { question: "What is 'Spam'?", options: ["Important Mail", "Junk/Unwanted Mail", "Sent Mail", "Drafts"], answer: 1 },
          { question: "Can you send photos via email?", options: ["No", "Yes, as attachments", "Only text allowed", "Only links"], answer: 1 },
          { question: "Password should be?", options: ["123456", "Your Name", "Strong & Secret", "Shared with everyone"], answer: 2 }
      ]}
  ]},
  { id: 'travel', name: 'Travel & Transport', icon: Train, color: 'from-blue-600 to-indigo-700', topics: [
      { id: 'train_booking', name: 'Train Booking', categoryId: 'travel', videoUrl: 'https://www.youtube.com/watch?v=483_lCg2Y1o', description: 'Creating IRCTC account and booking tickets.', simulation: true, quiz: [
          { question: "App used for Train Booking?", options: ["Uber", "IRCTC Rail Connect", "Zomato", "Netflix"], answer: 1 },
          { question: "What is PNR?", options: ["Passenger Name Record", "Personal Number Rail", "Public Network Road", "Private Name Route"], answer: 0 },
          { question: "Do you need ID proof for travelling?", options: ["No", "Yes, original ID", "Only photo", "Only ticket"], answer: 1 },
          { question: "What is Tatkal?", options: ["Free Ticket", "Emergency/Last Minute Booking", "Cancelled Ticket", "VIP Seat"], answer: 1 },
          { question: "Can you cancel a ticket online?", options: ["No, only at station", "Yes, via app/website", "Only via agent", "Never"], answer: 1 }
      ]},
      { id: 'bus_booking', name: 'Bus Booking', categoryId: 'travel', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'Using apps like RedBus to travel.', simulation: false, quiz: [
          { question: "Benefit of online bus booking?", options: ["More expensive", "Select exact seat", "Stand in line", "No confirmation"], answer: 1 },
          { question: "How receives the ticket?", options: ["Post Mail", "SMS/Email/App", "Newspaper", "Call"], answer: 1 },
          { question: "What is a 'Sleeper' bus?", options: ["Bus with beds", "Bus that is slow", "Bus for sleeping driver", "Bus with no seats"], answer: 0 },
          { question: "Can you track the bus location?", options: ["No", "Yes, mostly live tracking", "Only driver knows", "Only police knows"], answer: 1 },
          { question: "Is online payment safe?", options: ["No", "Yes, on trusted apps", "Never", "Only cash is safe"], answer: 1 }
      ]}
  ]},
  { id: 'safety', name: 'Digital Safety', icon: Lock, color: 'from-indigo-600 to-purple-700', topics: [
      { id: 'otp', name: 'OTP Security', categoryId: 'safety', videoUrl: 'https://www.youtube.com/watch?v=3aM1o-T6gX8', description: 'Never share OTPs.', simulation: false, quiz: [
          { question: "What does OTP stand for?", options: ["One Time Password", "On Time Pay", "Only The Pin", "One Time Processing"], answer: 0 },
          { question: "Should you share OTP with bank staff?", options: ["Yes", "No, Never", "If they ask politely", "Only manager"], answer: 1 },
          { question: "OTP is valid for?", options: ["Forever", "A short time (mins)", "1 Day", "1 Week"], answer: 1 },
          { question: "If you receive an unexpected OTP, you should:", options: ["Ignore it or report", "Share it on Facebook", "Call the police immediately", "Delete your account"], answer: 0 },
          { question: "Is OTP required to RECEIVE money?", options: ["Yes", "No, never enter OTP to receive", "Maybe", "Always"], answer: 1 }
      ]}
  ]},
  { id: 'govtschemes', name: 'Government Schemes', icon: Handshake, color: 'from-orange-600 to-amber-700', topics: [
      { id: 'pm_kisan', name: 'PM-KISAN', categoryId: 'govtschemes', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'Guide for farmers.', simulation: true, quiz: [
          { question: "PM-KISAN is for?", options: ["Students", "Farmers", "Doctors", "Engineers"], answer: 1 },
          { question: "Amount given per year?", options: ["Rs 6000", "Rs 10000", "Rs 2000", "Rs 500"], answer: 0 },
          { question: "Key document required?", options: ["Passport", "Driving License", "Aadhaar Card", "School ID"], answer: 2 },
          { question: "Is e-KYC mandatory?", options: ["No", "Yes", "Maybe", "Only for new users"], answer: 1 },
          { question: "Official website suffix?", options: [".com", ".org", ".gov.in", ".net"], answer: 2 }
      ]},
      { id: 'digilocker', name: 'DigiLocker', categoryId: 'govtschemes', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'Storing documents.', simulation: false, quiz: [
          { question: "Purpose of DigiLocker?", options: ["Shopping", "Storing digital documents", "Games", "Chat"], answer: 1 },
          { question: "Is DigiLocker document valid?", options: ["No", "Yes, as per IT Act", "Sometimes", "Only color print"], answer: 1 },
          { question: "Login requires?", options: ["Email", "Mobile/Aadhaar", "Pan Card", "Voter ID"], answer: 1 },
          { question: "Can you upload your own files?", options: ["No", "Yes, small files", "Only movies", "Only songs"], answer: 1 },
          { question: "Is it a private company app?", options: ["Yes", "No, Govt of India initiative", "No, US Govt", "No, Bank app"], answer: 1 }
      ]}
  ]}
];

const mockLearningDataHindi = [
    { id: 'payments', name: 'डिजिटल भुगतान', icon: Banknote, color: 'from-green-600 to-green-700', topics: [
        { id: 'upi_intro', name: 'UPI सेटअप', categoryId: 'payments', videoUrl: 'https://www.youtube.com/watch?v=m3-hO0iM6-A', description: 'UPI के लिए पंजीकरण करें और बैंक खाता लिंक करें।', simulation: true, quiz: [
            { question: "UPI का फुल फॉर्म क्या है?", options: ["यूनिफाइड पेमेंट्स इंटरफेस", "यूनियन पे इंडिया", "यूनाइटेड पेमेंट इंटरकनेक्ट", "यूनिवर्सल पे आईडी"], answer: 0 },
            { question: "मानक UPI पिन कितने अंकों का होता है?", options: ["2 या 3", "4 या 6", "8", "10"], answer: 1 },
            { question: "क्या आप बिना इंटरनेट के UPI का उपयोग कर सकते हैं?", options: ["नहीं, कभी नहीं", "हाँ, *99# यूएसएसडी के माध्यम से", "केवल सप्ताहांत पर", "केवल एसबीआई के लिए"], answer: 1 },
            { question: "आपको क्या कभी साझा नहीं करना चाहिए?", options: ["आपका नाम", "UPI आईडी", "UPI पिन", "क्यूआर कोड"], answer: 2 },
            { question: "क्या UPI के लिए बैंक खाता अनिवार्य है?", options: ["नहीं", "हाँ", "शायद", "केवल व्यापारियों के लिए"], answer: 1 }
        ]},
        { id: 'wallet', name: 'मोबाइल वॉलेट', categoryId: 'payments', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'PayTM/PhonePe वॉलेट का उपयोग करना।', simulation: false, quiz: [
            { question: "क्या वॉलेट मनी का उपयोग करने के लिए बैंक खाते की आवश्यकता है?", options: ["हाँ", "नहीं", "शायद", "केवल क्रेडिट के लिए"], answer: 1 },
            { question: "क्या वॉलेट के लिए केवाईसी आवश्यक है?", options: ["हाँ, पूर्ण सीमा के लिए", "नहीं, कभी नहीं", "केवल छात्रों के लिए", "केवल वरिष्ठ नागरिकों के लिए"], answer: 0 },
            { question: "क्या आप एटीएम से वॉलेट से नकद निकाल सकते हैं?", options: ["हाँ, हमेशा", "नहीं, जब तक कि आपके पास कोई विशिष्ट कार्ड न हो", "केवल रविवार को", "कभी नहीं"], answer: 1 },
            { question: "वॉलेट किससे जुड़ा होता है?", options: ["ईमेल", "मोबाइल नंबर", "घर का पता", "केवल पैन"], answer: 1 },
            { question: "अगर फोन खो जाता है, तो क्या वॉलेट का पैसा सुरक्षित है?", options: ["नहीं", "हाँ, अगर ऐप लॉक/पिन सुरक्षित है", "केवल अगर आप पुलिस को बुलाते हैं", "पैसा गायब हो जाता है"], answer: 1 }
        ]}
    ]},
    { id: 'communication', name: 'संचार', icon: MessageCircle, color: 'from-teal-600 to-teal-700', topics: [
        { id: 'whatsapp_basic', name: 'व्हाट्सएप मूल बातें', categoryId: 'communication', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'संदेश, फोटो और वॉयस नोट्स भेजना।', simulation: true, quiz: [
            { question: "व्हाट्सएप का उपयोग करने के लिए क्या आवश्यक है?", options: ["केवल फोन", "इंटरनेट और फोन नंबर", "केवल ईमेल", "आधार कार्ड"], answer: 1 },
            { question: "एक ग्रे टिक का क्या मतलब है?", options: ["संदेश भेजा गया", "संदेश वितरित", "संदेश पढ़ा गया", "संदेश विफल"], answer: 0 },
            { question: "क्या आप संदेश को अनसेंड कर सकते हैं?", options: ["नहीं", "हाँ, 'सभी के लिए हटाएं'", "केवल 1 सेकंड के भीतर", "केवल अगर अवरुद्ध है"], answer: 1 },
            { question: "क्या व्हाट्सएप स्टेटस सार्वजनिक है?", options: ["हाँ, पूरी दुनिया के लिए", "नहीं, केवल संपर्कों के लिए (गोपनीयता सेटिंग)", "केवल Google के लिए", "केवल व्यवस्थापक के लिए"], answer: 1 },
            { question: "ग्रुप क्या है?", options: ["एकल चैट", "कई लोगों के साथ चैट", "एक सशुल्क सुविधा", "एक वायरस"], answer: 1 }
        ]},
        { id: 'email_basic', name: 'ईमेल मूल बातें', categoryId: 'communication', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'खाता बनाना और ईमेल भेजना।', simulation: false, quiz: [
            { question: "ईमेल आईडी में कौन सा प्रतीक अनिवार्य है?", options: ["#", "@", "&", "$"], answer: 1 },
            { question: "आप मुख्य संदेश कहाँ लिखते हैं?", options: ["विषय पंक्ति", "बॉडी", "टू", "सीसी"], answer: 1 },
            { question: "स्पैम क्या है?", options: ["महत्वपूर्ण मेल", "जंक/अवांछित मेल", "भेजे गए मेल", "ड्राफ्ट"], answer: 1 },
            { question: "क्या आप ईमेल के माध्यम से फोटो भेज सकते हैं?", options: ["नहीं", "हाँ, अटैचमेंट के रूप में", "केवल टेक्स्ट की अनुमति है", "केवल लिंक"], answer: 1 },
            { question: "पासवर्ड कैसा होना चाहिए?", options: ["123456", "आपका नाम", "मजबूत और गुप्त", "सभी के साथ साझा किया गया"], answer: 2 }
        ]}
    ]},
    { id: 'travel', name: 'यात्रा और परिवहन', icon: Train, color: 'from-blue-600 to-indigo-700', topics: [
        { id: 'train_booking', name: 'ट्रेन बुकिंग (IRCTC)', categoryId: 'travel', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'IRCTC खाता बनाना और टिकट बुक करना।', simulation: true, quiz: [
            { question: "ट्रेन बुकिंग के लिए उपयोग किया जाने वाला ऐप?", options: ["Uber", "IRCTC रेल कनेक्ट", "Zomato", "Netflix"], answer: 1 },
            { question: "PNR क्या है?", options: ["यात्री नाम रिकॉर्ड", "व्यक्तिगत नंबर रेल", "पब्लिक नेटवर्क रोड", "निजी नाम मार्ग"], answer: 0 },
            { question: "क्या यात्रा के लिए आईडी प्रमाण की आवश्यकता है?", options: ["नहीं", "हाँ, मूल आईडी", "केवल फोटो", "केवल टिकट"], answer: 1 },
            { question: "तत्काल क्या है?", options: ["मुफ्त टिकट", "आपातकालीन/अंतिम समय की बुकिंग", "रद्द टिकट", "वीआईपी सीट"], answer: 1 },
            { question: "क्या आप ऑनलाइन टिकट रद्द कर सकते हैं?", options: ["नहीं, केवल स्टेशन पर", "हाँ, ऐप/वेबसाइट के माध्यम से", "केवल एजेंट के माध्यम से", "कभी नहीं"], answer: 1 }
        ]},
        { id: 'bus_booking', name: 'बस बुकिंग', categoryId: 'travel', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'RedBus जैसे ऐप्स का उपयोग करना।', simulation: false, quiz: [
            { question: "ऑनलाइन बस बुकिंग का लाभ?", options: ["अधिक महंगा", "सटीक सीट चुनें", "लाइन में खड़े रहें", "कोई पुष्टि नहीं"], answer: 1 },
            { question: "टिकट कैसे प्राप्त होता है?", options: ["पोस्ट मेल", "एसएमएस/ईमेल/ऐप", "अखबार", "कॉल"], answer: 1 },
            { question: "'स्लीपर' बस क्या है?", options: ["बिस्तरों वाली बस", "धीमी बस", "सोने वाले ड्राइवर के लिए बस", "बिना सीटों वाली बस"], answer: 0 },
            { question: "क्या आप बस की लोकेशन ट्रैक कर सकते हैं?", options: ["नहीं", "हाँ, अधिकतर लाइव ट्रैकिंग", "केवल ड्राइवर जानता है", "केवल पुलिस जानती है"], answer: 1 },
            { question: "Is online payment safe?", options: ["No", "Yes, on trusted apps", "Never", "Only cash is safe"], answer: 1 }
        ]}
    ]},
    { id: 'safety', name: 'डिजिटल सुरक्षा', icon: Lock, color: 'from-indigo-600 to-purple-700', topics: [
        { id: 'otp', name: 'ओटीपी सुरक्षा', categoryId: 'safety', videoUrl: 'https://www.youtube.com/embed/H03Nq7y65Qk', description: 'ओटीपी कभी साझा न करें।', simulation: false, quiz: [
            { question: "OTP का मतलब क्या है?", options: ["वन टाइम पासवर्ड", "ऑन टाइम पे", "ओनली द पिन", "वन टाइम प्रोसेसिंग"], answer: 0 },
            { question: "क्या आपको बैंक कर्मचारियों के साथ ओटीपी साझा करना चाहिए?", options: ["हाँ", "नहीं, कभी नहीं", "अगर वे विनम्रता से पूछें", "केवल प्रबंधक"], answer: 1 },
            { question: "OTP is valid for?", options: ["हमेशा के लिए", "कम समय (मिनट)", "1 दिन", "1 सप्ताह"], answer: 1 },
            { question: "यदि आपको कोई अप्रत्याशित ओटीपी मिलता है, तो आपको क्या करना चाहिए?", options: ["इसे अनदेखा करें या रिपोर्ट करें", "इसे फेसबुक पर साझा करें", "तुरंत पुलिस को बुलाएं", "अपना खाता हटाएं"], answer: 0 },
            { question: "क्या पैसे प्राप्त करने के लिए ओटीपी की आवश्यकता है?", options: ["हाँ", "नहीं, प्राप्त करने के लिए कभी ओटीपी दर्ज न करें", "शायद", "हमेशा"], answer: 1 }
        ]}
    ]},
    { id: 'govtschemes', name: 'सरकारी योजनाएं', icon: Handshake, color: 'from-orange-600 to-amber-700', topics: [
        { id: 'pm_kisan', name: 'पीएम-किसान', categoryId: 'govtschemes', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'किसानों के लिए गाइड।', simulation: true, quiz: [
            { question: "पीएम-किसान किसके लिए है?", options: ["छात्र", "किसान", "डॉक्टर", "इंजीनियर"], answer: 1 },
            { question: "प्रति वर्ष दी जाने वाली राशि?", options: ["6000 रुपये", "10000 रुपये", "2000 रुपये", "500 रुपये"], answer: 0 },
            { question: "मुख्य दस्तावेज की आवश्यकता?", options: ["पासपोर्ट", "ड्राइविंग लाइसेंस", "आधार कार्ड", "स्कूल आईडी"], answer: 2 },
            { question: "Is e-KYC mandatory?", options: ["No", "Yes", "Maybe", "Only for new users"], answer: 1 },
            { question: "आधिकारिक वेबसाइट प्रत्यय?", options: [".com", ".org", ".gov.in", ".net"], answer: 2 }
        ]},
        { id: 'digilocker', name: 'डिजिलॉकर', categoryId: 'govtschemes', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'दस्तावेजों को सुरक्षित रखना।', simulation: false, quiz: [
            { question: "डिजिलॉकर का उद्देश्य?", options: ["खरीदारी", "डिजिटल दस्तावेज स्टोर करना", "खेल", "चैट"], answer: 1 },
            { question: "Is DigiLocker document valid?", options: ["No", "Yes, as per IT Act", "Sometimes", "Only color print"], answer: 1 },
            { question: "Login requires?", options: ["Email", "Mobile/Aadhaar", "Pan Card", "Voter ID"], answer: 1 },
            { question: "Can you upload your own files?", options: ["No", "Yes, small files", "Only movies", "Only songs"], answer: 1 },
            { question: "Is it a private company app?", options: ["Yes", "No, Govt of India initiative", "No, US Govt", "No, Bank app"], answer: 1 }
        ]}
    ]},
    { id: 'health', name: 'स्वास्थ्य सेवाएं', icon: Heart, color: 'from-pink-600 to-red-700', topics: [
      { id: 'ayushman', name: 'आयुष्मान भारत', categoryId: 'health', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'स्वास्थ्य कार्ड पात्रता।', simulation: false, quiz: [{ question: "प्रदान करता है?", options: ["ऋण", "स्वास्थ्य बीमा", "भोजन", "यात्रा"], answer: 1 }, { question: "लक्ष्य?", options: ["अमीर", "कम आय", "बच्चे", "कोई नहीं"], answer: 1 }, { question: "कार्ड का नाम?", options: ["गोल्डन कार्ड", "सिल्वर कार्ड", "आयुष्मान कार्ड", "ग्रीन कार्ड"], answer: 2 }, { question: "क्या यह मुफ़्त है?", options: ["हाँ", "नहीं", "आंशिक रूप से", "केवल सरकारी कर्मचारियों के लिए"], answer: 0 }, { question: "कवरेज?", options: ["1 लाख", "2 लाख", "5 लाख", "10 लाख"], answer: 2 }] },
      { id: 'telemedicine', name: 'टेलीमेडिसिन', categoryId: 'health', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'ऑनलाइन डॉक्टर से परामर्श करें।', simulation: false, quiz: [{ question: "टेलीमेडिसिन क्या है?", options: ["टीवी शो", "ऑनलाइन डॉक्टर परामर्श", "दवा की दुकान", "खेल"], answer: 1 }, { question: "उपयोग किया गया ऐप?", options: ["ई-संजीवनी", "टिकटॉक", "पबजी", "लूडो"], answer: 0 }, { question: "इंटरनेट की आवश्यकता है?", options: ["हाँ", "नहीं", "शायद", "केवल जीपीएस"], answer: 0 }, { question: "प्रिस्क्रिप्शन मिल सकता है?", options: ["नहीं", "हाँ", "केवल सलाह", "केवल मौखिक"], answer: 1 }, { question: "क्या यह सुरक्षित है?", options: ["नहीं", "हाँ, सुरक्षित ऐप्स", "कभी नहीं", "केवल शहर में"], answer: 1 }] }
    ]},
    { id: 'online', name: 'ऑनलाइन सेवाएं', icon: ClipboardList, color: 'from-cyan-600 to-blue-700', topics: [
      { id: 'job_search', name: 'नौकरी खोज', categoryId: 'online', videoUrl: 'https://www.youtube.com/embed/Y08J1Q-D6vQ', description: 'ऑनलाइन नौकरियां खोजें।', simulation: false, quiz: [{ question: "पहला कदम?", options: ["यात्रा", "बायोडाटा", "बैंक", "फोन"], answer: 1 }, { question: "नौकरी के लिए भुगतान?", options: ["हाँ", "नहीं", "शायद", "छोटा शुल्क"], answer: 1 }, { question: "सबसे अच्छी साइट?", options: ["नौकरी/लिंक्डइन", "फेसबुक", "इंस्टाग्राम", "व्हाट्सएप"], answer: 0 }, { question: "साक्षात्कार मोड?", options: ["केवल ऑफ़लाइन", "ऑनलाइन/ऑफ़लाइन", "केवल टेक्स्ट", "केवल कॉल"], answer: 1 }, { question: "क्या यह मुफ़्त है?", options: ["ज्यादातर हाँ", "हमेशा भुगतान किया", "कभी नहीं", "केवल सरकार के लिए"], answer: 0 }] },
      { id: 'cert_apply', name: 'प्रमाण पत्र आवेदन', categoryId: 'online', videoUrl: 'https://www.youtube.com/embed/S_B2w2N785M', description: 'जाति/आय प्रमाण पत्र के लिए आवेदन करें।', simulation: false, quiz: [{ question: "कहाँ आवेदन करें?", options: ["पुलिस स्टेशन", "ई-जिला पोर्टल", "डाकघर", "स्कूल"], answer: 1 }, { question: "दस्तावेज़?", options: ["कोई नहीं", "आधार/राशन कार्ड", "केवल फोटो", "केवल हस्ताक्षर"], answer: 1 }, { question: "शुल्क?", options: ["उच्च", "नाममात्र/मुफ़्त", "लाखों", "सोना"], answer: 1 }, { question: "स्थिति ट्रैक करें?", options: ["नहीं", "हाँ, ऑनलाइन", "केवल जाकर", "कभी नहीं"], answer: 1 }, { question: " वैधता?", options: ["1 दिन", "भिन्न होता है (1-3 वर्ष)", "हमेशा के लिए", "1 घंटा"], answer: 1 }] }
    ]}
];

const mockStateDistrictData = {
    "Andhra Pradesh": ["Anantapur", "Chittoor", "Guntur", "Krishna", "Visakhapatnam"],
    "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia"],
    "Chhattisgarh": ["Raipur", "Bilaspur", "Durg"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
    "Haryana": ["Gurgaon", "Faridabad", "Panipat"],
    "Jharkhand": ["Ranchi", "Dhanbad", "Jamshedpur", "Bokaro"],
    "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar"],
    "Rajasthan": ["Jaipur", "Udaipur", "Jodhpur", "Kota", "Ajmer", "Bikaner"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Trichy"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Noida", "Ghaziabad"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Nainital"],
    "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri"]
};
const stateOptions = Object.keys(mockStateDistrictData).sort();

const localizedText = {
  en: {
    // UI Strings
    appTitle: "Digital Saathi", navHome: "Home", navExplore: "Explore", navProgress: "Progress", navHelp: "Support",
    welcomeTitle: "Welcome, {{name}}!", welcomeBody: "Continue your learning journey.", loading: "Loading...",
    guestRestricted: "Please login to save progress.", profileTitle: "My Profile", performanceTitle: "Performance", modules: "Modules",
    loginTitle: "Learner Login", registerTitle: "New Registration",
    mobileLabel: "Mobile Number or Email", emailLabel: "Email Address (Optional)", passwordLabel: "Password", confirmPasswordLabel: "Confirm Password",
    forgotPass: "Forgot Password?", recoverPass: "Recover Password", sendRecovery: "Send Recovery Email", backToLogin: "Back to Login",
    loginBtn: "Login Securely", registerBtn: "Register Now", switchRegister: "New here? Register", switchLogin: "Already registered? Login",
    continueGuest: "Skip & Continue as Guest",
    ruralFields: [
        {key: "name", label: "Full Name", type:'text'}, 
        {key: "dob", label: "Date of Birth", type:'date'}, 
        {key: "state", label: "State", type:'select'}, 
        {key: "district", label: "District", type:'select'}, 
        {key: "village", label: "Village Name", type:'text'}
    ],
    readAloud: "Read Aloud", langModalTitle: "Select Language", assessment: "Assessment", question: "Question", submit: "Submit Answer", next: "Next", previous: "Prev",
    moduleComplete: "Module Completed!", moduleIncomplete: "Try Again", score: "Score: {{score}}%", reAttemptQuiz: "Re-attempt Quiz", backToTopic: "Back to Topic",
    practiceSim: "Practice Simulation", startMandatoryQuiz: "Start Quiz", reAttemptAssessment: "Re-attempt Quiz", videoTutorial: "Video Tutorial", mustScore: "Score 60% to pass.",
    logout: "Logout", supportTitle: "Support Center", supportBody: "We are here to help you. Browse FAQs or contact us directly.", supportFaq: "Frequently Asked Questions",
    attempts: "Attempts", highScore: "Best Score", regStatus: "Status", reg: "Registered Learner", unreg: "Guest User",
    modulesCompleted: "Modules Completed", overallProgress: "Overall Progress", timeSpent: "Learning Time",
    supportQ1: "I cannot play the video tutorial.", supportA1: "Please check your internet connection. Videos require an active data connection.",
    supportQ2: "My quiz score is not updating.", supportA2: "Ensure you are logged in. Guest progress is not saved permanently.",
    supportQ3: "Can I use this app offline?", supportA3: "Currently, an internet connection is required to sync progress and view videos.",
    supportQ4: "Is this service free?", supportA4: "Yes, Digital Saathi is a completely free initiative for digital literacy.",
    contactUs: "Contact Us", callUs: "Call Support", emailUs: "Email Support",
    streak: "Day Streak", currentStreak: "Current Streak",
    comingSoon: "Coming Soon", comingSoonDesc: "This simulation module is currently under development. Stay tuned!",
    startLearn: "Start Learning", review: "Review",
    footerDesign: "Designed By Mratunjay Pandey", footerDev: "Developed by MG Interactive Solutions & Zeyotech.in",
    continueLearning: "Continue Learning", resume: "Resume", mins: " mins",
    cloudSync: "Cloud Sync",
    
    learningData: mockLearningData
  },
  hi: {
    appTitle: "डिजिटल साथी", navHome: "होम", navExplore: "एक्सप्लोर", navProgress: "प्रगति", navHelp: "सहायता",
    welcomeTitle: "नमस्ते, {{name}}!", welcomeBody: "अपनी सीखने की यात्रा जारी रखें।", loading: "लोड हो रहा है...",
    guestRestricted: "प्रगति सहेजने के लिए लॉगिन करें।", profileTitle: "मेरी प्रोफाइल", performanceTitle: "प्रदर्शन सारांश", modules: "मॉड्यूल",
    loginTitle: "लॉगिन करें", registerTitle: "नया पंजीकरण",
    mobileLabel: "मोबाइल नंबर या ईमेल", emailLabel: "ईमेल पता (वैकल्पिक)", passwordLabel: "पासवर्ड", confirmPasswordLabel: "पासवर्ड की पुष्टि करें",
    forgotPass: "पासवर्ड भूल गए?", recoverPass: "पासवर्ड पुनर्प्राप्त करें", sendRecovery: "रिकवरी ईमेल भेजें", backToLogin: "लॉगिन पर वापस जाएं",
    loginBtn: "लॉगिन करें", registerBtn: "रजिस्टर करें", switchRegister: "नया खाता बनाएं", switchLogin: "पहले से पंजीकृत? लॉगिन करें",
    continueGuest: "अतिथि के रूप में जारी रखें",
    ruralFields: [
        {key: "name", label: "पूरा नाम", type:'text'}, 
        {key: "dob", label: "जन्म तिथि", type:'date'}, 
        {key: "state", label: "राज्य", type:'select'}, 
        {key: "district", label: "जिला", type:'select'}, 
        {key: "village", label: "गाँव का नाम", type:'text'}
    ],
    readAloud: "सुनें", langModalTitle: "भाषा चुनें", assessment: "मूल्यांकन", question: "प्रश्न", submit: "जमा करें", next: "अगला", previous: "पिछला",
    moduleComplete: "मॉड्यूल पूरा हुआ!", moduleIncomplete: "पुनः प्रयास करें", score: "स्कोर: {{score}}%", reAttemptQuiz: "पुनः प्रयास", backToTopic: "वापस जाएं",
    practiceSim: "अभ्यास सिमुलेशन", startMandatoryQuiz: "क्विज़ शुरू करें", reAttemptAssessment: "पुनः प्रयास", वीडियो: "वीडियो ट्यूटोरियल", mustScore: "पास होने के लिए 60% लाएं।",
    logout: "लॉग आउट", supportTitle: "सहायता केंद्र", supportBody: "हम आपकी मदद के लिए यहाँ हैं। प्रश्न देखें या संपर्क करें।", supportFaq: "अक्सर पूछे जाने वाले प्रश्न",
    attempts: "प्रयास", highScore: "सर्वोत्तम स्कोर", regStatus: "स्थिति", reg: "पंजीकृत", unreg: "अतिथि",
    modulesCompleted: "पूर्ण मॉड्यूल", overallProgress: "कुल प्रगति", timeSpent: "सीखने का समय",
    supportQ1: "वीडियो नहीं चल रहा है?", supportA1: "कृपया अपना इंटरनेट कनेक्शन जांचें। वीडियो के लिए डेटा आवश्यक है।",
    supportQ2: "मेरा स्कोर अपडेट नहीं हो रहा?", supportA2: "सुनिश्चित करें कि आप लॉग इन हैं। अतिथि प्रगति सहेजी नहीं जाती है।",
    supportQ3: "क्या मैं इसे ऑफ़लाइन उपयोग कर सकता हूँ?", supportA3: "फिलहाल, प्रगति सिंक करने और वीडियो देखने के लिए इंटरनेट आवश्यक है।",
    supportQ4: "क्या यह सेवा निःशुल्क है?", supportA4: "हाँ, डिजिटल साथी डिजिटल साक्षरता के लिए पूरी तरह से मुफ्त पहल है।",
    contactUs: "संपर्क करें", callUs: "कॉल करें", emailUs: "ईमेल करें",
    streak: "दिन की स्ट्रीक", currentStreak: "वर्तमान स्ट्रीक",
    comingSoon: "जल्द आ रहा है", comingSoonDesc: "यह सिमुलेशन मॉड्यूल अभी विकास में है। बने रहें!",
    startLearn: "सीखना शुरू करें", review: "समीक्षा करें",
    footerDesign: "Designed By Mratunjay Pandey", footerDev: "Developed by MG Interactive Solutions & Zeyotech.in",
    continueLearning: "सीखना जारी रखें", resume: "फिर से शुरू करें", mins: "मिनट",
    cloudSync: "क्लाउड सिंक",
    
    learningData: mockLearningDataHindi
  }
};

// --- 4. SUB-COMPONENTS ---

const FooterCredits = ({ t }) => (
    <div className="py-8 px-4 bg-gray-100 dark:bg-gray-800 text-center border-t dark:border-gray-700 mt-12 mb-24">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.footerDesign}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t.footerDev}</p>
    </div>
);

const StatCard = ({ title, value, total, color, icon: Icon }) => (
    <div className={`p-4 rounded-xl shadow-sm text-white ${color} flex flex-col justify-between transform transition hover:scale-105`}>
        <div className="flex justify-between items-start">
            <span className="text-xs font-medium opacity-90 uppercase tracking-wide">{title}</span>
            <Icon size={20} className="opacity-80" />
        </div>
        <div className="text-2xl font-bold mt-2">
            {value} {total && <span className="text-sm font-normal opacity-80">/ {total}</span>}
        </div>
    </div>
);

const FaqItem = ({ question, answer }) => (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 font-semibold text-gray-800 dark:text-gray-100 flex items-start gap-2">
            <span className="text-indigo-600 dark:text-indigo-400">Q.</span> {question}
        </div>
        <div className="p-4 text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 text-sm leading-relaxed">
            {answer}
        </div>
    </div>
);

const CategoryCard = ({ category, learningProgress, onClick, t }) => {
    const Icon = category.icon;
    const completedCount = category.topics.filter(top => learningProgress[top.id]?.isCompleted).length;
    
    return (
        <div onClick={() => onClick(category.id)} className={`cursor-pointer relative overflow-hidden rounded-xl p-5 text-white shadow-md hover:shadow-xl transition-all bg-gradient-to-br ${category.color}`}>
            <div className="flex justify-between items-start z-10 relative">
                <div className="p-2 bg-white/20 rounded-lg"><Icon size={32} /></div>
                <div className="text-right">
                    <p className="text-xs font-medium opacity-80">{t.modules}</p>
                    <p className="text-lg font-bold">{completedCount}/{category.topics.length}</p>
                </div>
            </div>
            <h3 className="mt-4 text-xl font-bold z-10 relative tracking-tight">{category.name}</h3>
            <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full"><div className="h-full bg-white/90" style={{width: `${(completedCount/category.topics.length)*100}%`}}></div></div>
        </div>
    );
};

const AuthPage = ({ t, setUserId, setUserProfile, setToken, setPage, syncProfileToSupabase, currentLanguage, setAppLanguage, setLearningProgress }) => {
    const [mode, setMode] = useState('login'); // login, register, forgot
    const [formData, setFormData] = useState({ 
        email: '', password: '', name: '', mobile: '', dob: '', state: '', district: '', village: '' 
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showLang, setShowLang] = useState(false);
    const [message, setMessage] = useState('');

    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        // Use 'mobile' input for both mobile/email to keep UI simple
        const { user, session, error } = await authApi.login(formData.mobile, formData.password);
        
        if (error) {
            setLoading(false); setError(error);
        } else {
            const token = session.access_token;
            setToken(token);
            setUserId(user.id);
            
            // Ensure profile is loaded correctly
            // check if user data exists, if not check local storage or create default
            const data = await fetchUserData(user.id, token);
            if (data && data.profile) {
                setUserProfile(data.profile);
                if (data.progress) {
                     setLearningProgress(data.progress);
                     setLocalItem(`progress_${user.id}`, data.progress);
                }
            } else {
                 // If remote fails, fallback to local or fresh state
                 const fallbackProfile = { uid: user.id, name: formData.mobile, isRegistered: true, studentId: generateStudentId() };
                 setUserProfile(fallbackProfile);
            }
            
            setLoading(false);
            setPage('home');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        
        const studentId = generateStudentId();
        
        // Pass optional real email if provided
        const { user, session, error } = await authApi.register(formData.mobile, formData.password, formData.email);

        if (error) {
            setLoading(false); setError(error);
        } else {
            if (session) {
                const token = session.access_token;
                setToken(token);
                setUserId(user.id);

                const profileData = {
                    uid: user.id,
                    studentId,
                    name: formData.name,
                    mobile: formData.mobile,
                    email: formData.email,
                    isRegistered: true,
                    dob: formData.dob,
                    state: formData.state,
                    district: formData.district,
                    village: formData.village
                };
                
                setUserProfile(profileData);
                await syncProfileToSupabase(profileData, token);
                
                setLoading(false);
                setPage('home');
            } else {
                setLoading(false);
                setMessage("Registration successful! Please check your email to confirm.");
                setMode('login');
            }
        }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setMessage('');
        const input = formData.email || formData.mobile;
        const { success, error } = await authApi.resetPassword(input);
        setLoading(false);
        if (error) setError(error);
        else setMessage("Password recovery email sent. Check your inbox (linked to mobile).");
    };

    const handleGuest = () => {
        setUserId(`guest-${Date.now()}`);
        setUserProfile({ name: 'Guest', isRegistered: false });
        setToken(null);
        setPage('home');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 relative">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4">
                 <button onClick={() => setShowLang(!showLang)} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center gap-2 px-3 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    <Globe size={18}/> {currentLanguage.toUpperCase()}
                </button>
                {showLang && (
                    <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-xl w-32 border dark:border-gray-700">
                        <button onClick={() => {setAppLanguage('en'); setShowLang(false)}} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-800 dark:text-gray-200">English</button>
                        <button onClick={() => {setAppLanguage('hi'); setShowLang(false)}} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-800 dark:text-gray-200">हिन्दी</button>
                    </div>
                )}
            </div>

            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <div className="text-center mb-6">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Layers className="text-indigo-600 dark:text-indigo-400" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                        {mode === 'login' ? t.loginTitle : mode === 'register' ? t.registerTitle : t.recoverPass}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t.appTitle}</p>
                </div>

                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><XCircle size={16}/>{error}</div>}
                {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2"><CheckCircle size={16}/>{message}</div>}
                
                <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot} className="space-y-4">
                    
                    {/* Registration Fields */}
                    {mode === 'register' && (
                        <>
                           {t.ruralFields.map((f, i) => (
                                <div key={i}>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{f.label}</label>
                                    {f.type === 'select' ? (
                                        <select className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                            name={f.key} onChange={handleChange} disabled={f.key === 'district' && !formData.state} required>
                                            <option value="">Select {f.label}</option>
                                            {f.key === 'state' && stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                            {f.key === 'district' && formData.state && mockStateDistrictData[formData.state]?.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    ) : (
                                        <input type={f.type} name={f.key} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" onChange={handleChange} required />
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {/* Common Fields */}
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.mobileLabel}</label>
                        <input type="text" name="mobile" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" onChange={handleChange} required placeholder="Mobile or Email" />
                    </div>
                    
                    {/* Optional Email for Registration Only */}
                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.emailLabel}</label>
                            <input type="email" name="email" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" onChange={handleChange} placeholder="name@example.com" />
                        </div>
                    )}

                    {/* Password field for Login and Register */}
                    {mode !== 'forgot' && (
                        <div>
                            <div className="flex justify-between">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.passwordLabel}</label>
                                {mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="text-xs text-indigo-600 hover:underline">{t.forgotPass}</button>}
                            </div>
                            <input type="password" name="password" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" onChange={handleChange} required placeholder="••••••••" />
                        </div>
                    )}
                    
                    {/* Email field for Forgot Password */}
                    {mode === 'forgot' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">{t.emailLabel}</label>
                            <input type="email" name="email" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" onChange={handleChange} required placeholder="Enter registered email" />
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex justify-center shadow-md">
                        {loading ? <Loader className="animate-spin" /> : (mode === 'login' ? t.loginBtn : mode === 'register' ? t.registerBtn : t.sendRecovery)}
                    </button>
                </form>

                <div className="mt-6 space-y-3 border-t dark:border-gray-700 pt-4">
                    {mode === 'login' ? (
                        <button onClick={() => setMode('register')} className="w-full py-2 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition">
                            {t.switchRegister}
                        </button>
                    ) : (
                        <button onClick={() => setMode('login')} className="w-full py-2 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition">
                            {t.backToLogin || t.switchLogin}
                        </button>
                    )}
                    
                    <button onClick={handleGuest} className="w-full py-2 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                        {t.continueGuest}
                    </button>
                </div>
            </div>
        </div>
    );
};

const HomePage = ({ t, userProfile, learningProgress, learningData, selectCategory, selectTopic, goToExplore, userId, token, totalLearningTimeMinutes }) => {
    const allTopics = learningData.flatMap(c => c.topics);
    const completedCount = Object.values(learningProgress).filter(p => p.isCompleted).length;
    const progressPercent = Math.round((completedCount / allTopics.length) * 100) || 0;
    
    // Filter topics that have been started (attempts > 0) but not completed
    const inProgressTopics = allTopics.filter(topic => {
        const prog = learningProgress[topic.id];
        return prog && prog.attempts > 0 && !prog.isCompleted;
    });

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t.welcomeTitle.replace('{{name}}', userProfile.name || 'Learner')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">{t.welcomeBody}</p>
                </div>
                {userId && <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200 flex items-center gap-1"><Cloud size={12}/> {t.cloudSync}</div>}
            </header>

            <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                <StatCard title={t.modulesCompleted} value={completedCount} total={allTopics.length} color="bg-emerald-600" icon={CheckCircle} />
                <StatCard title={t.overallProgress} value={`${progressPercent}%`} color="bg-blue-600" icon={BarChart} />
                <StatCard title={t.timeSpent} value={`${totalLearningTimeMinutes}${t.mins}`} color="bg-amber-500" icon={Zap} />
            </section>

            {inProgressTopics.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t.continueLearning}</h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                        {inProgressTopics.map(topic => (
                            <div key={topic.id} className="min-w-[280px] bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 snap-start">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2 truncate">{topic.name}</h3>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full mb-4">
                                    <div className="bg-indigo-500 h-2 rounded-full" style={{width: '50%'}}></div>
                                </div>
                                <button onClick={() => selectTopic(topic.id)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 animate-pulse">
                                    <PlayCircle size={16}/> {t.resume}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t.modules}</h2>
                    <button onClick={goToExplore} className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center hover:underline text-sm">{t.navExplore} <ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {learningData.slice(0, 4).map(cat => (
                        <CategoryCard key={cat.id} category={cat} learningProgress={learningProgress} onClick={selectCategory} t={t} />
                    ))}
                </div>
            </section>
        </div>
    );
};

const ExplorePage = ({ t, learningData, learningProgress, selectCategory }) => (
    <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center"><Layers className="mr-2"/> {t.navExplore}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {learningData.map(cat => (
                <CategoryCard key={cat.id} category={cat} learningProgress={learningProgress} onClick={selectCategory} t={t} />
            ))}
        </div>
    </div>
);

const CategoryPage = ({ category, learningProgress, selectTopic, goBack, t }) => {
    if(!category) return null;
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button onClick={goBack} className="mb-6 flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"><ChevronLeft size={20} /> {t.backToCategories}</button>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{category.name}</h2>
            <div className="space-y-4">
                {category.topics.map(topic => {
                    const isDone = learningProgress[topic.id]?.isCompleted;
                    return (
                        <div key={topic.id} className={`flex justify-between items-center p-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${isDone ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{topic.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{topic.description}</p>
                            </div>
                            <button onClick={() => selectTopic(topic.id)} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${isDone ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                <PlayCircle size={16} className="inline mr-2" />
                                {isDone ? t.review : t.startLearn}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TopicPage = ({ topic, learningProgress, setPage, goBack, t }) => {
    if(!topic) return null;
    const isDone = learningProgress[topic.id]?.isCompleted;
    
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button onClick={goBack} className="mb-4 flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"><ChevronLeft size={20} /> {t.backToTopic}</button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{topic.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{topic.description}</p>
            
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6 shadow-lg">
                <iframe width="100%" height="100%" src={getEmbedUrl(topic.videoUrl)} title={topic.name} frameBorder="0" allowFullScreen />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topic.simulation && (
                    <button onClick={() => setPage('simulation')} className="p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-md flex justify-center items-center gap-2 transition">
                        <QrCode /> {t.practiceSim}
                    </button>
                )}
                <button onClick={() => setPage('quiz')} className={`p-4 text-white rounded-xl font-bold shadow-md flex justify-center items-center gap-2 transition ${isDone ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    <BookOpen /> {isDone ? t.reAttemptAssessment : t.startMandatoryQuiz}
                </button>
            </div>
        </div>
    );
};

const QuizPage = ({ topic, updateProgress, goBack, t }) => {
    const [qIdx, setQIdx] = useState(0);
    const [answers, setAnswers] = useState(new Array(topic.quiz.length).fill(null));
    const [result, setResult] = useState(null);

    const handleOption = (idx) => {
        const newAns = [...answers];
        newAns[qIdx] = idx;
        setAnswers(newAns);
    };

    const handleSubmit = () => {
        const score = Math.round((answers.reduce((acc, val, i) => acc + (val === topic.quiz[i].answer ? 1 : 0), 0) / topic.quiz.length) * 100);
        const passed = score >= 60;
        updateProgress(topic.id, score, passed, { categoryId: topic.categoryId || 'general' });
        setResult({ score, passed });
    };

    if(result) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${result.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {result.passed ? <CheckCircle size={40} /> : <XCircle size={40} />}
                </div>
                <h2 className="text-2xl font-bold mb-2 dark:text-white">{result.passed ? t.moduleComplete : t.moduleIncomplete}</h2>
                <p className="text-xl mb-6 dark:text-gray-300">{t.score.replace('{{score}}', result.score)}</p>
                <div className="flex gap-4 justify-center">
                    <button onClick={goBack} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition">{t.backToTopic}</button>
                    <button onClick={() => {setResult(null); setQIdx(0); setAnswers(new Array(topic.quiz.length).fill(null));}} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">{t.reAttemptQuiz}</button>
                </div>
            </div>
        );
    }

    const q = topic.quiz[qIdx];
    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">{t.assessment}</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">{qIdx+1} / {topic.quiz.length}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm mb-6">
                <p className="text-lg font-medium mb-6 dark:text-gray-200">{q.question}</p>
                <div className="space-y-3">
                    {q.options.map((opt, i) => (
                        <button key={i} onClick={() => handleOption(i)} className={`w-full p-4 text-left rounded-xl border transition ${answers[qIdx] === i ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-500 dark:text-indigo-300' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-300'}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex justify-between">
                <button disabled={qIdx===0} onClick={() => setQIdx(qIdx-1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800">{t.previous}</button>
                {qIdx === topic.quiz.length-1 ? (
                    <button disabled={answers.includes(null)} onClick={handleSubmit} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 transition">{t.submit}</button>
                ) : (
                    <button disabled={answers[qIdx]===null} onClick={() => setQIdx(qIdx+1)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 transition">{t.next}</button>
                )}
            </div>
        </div>
    );
};

const SimulationPage = ({ t, setPage }) => {
    return (
        <div className="p-6 max-w-md mx-auto text-center h-[80vh] flex flex-col justify-center items-center">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-6 rounded-full mb-6 animate-bounce">
                <Clock size={48} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4 dark:text-white">{t.comingSoon}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-xs">{t.comingSoonDesc}</p>
            <button onClick={() => setPage('topic')} className="w-full max-w-xs py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition">
                {t.backToTopic}
            </button>
        </div>
    );
}

const ProfilePage = ({ t, userProfile, learningProgress, handleLogout }) => {
    const totalAttempts = Object.values(learningProgress).reduce((a, b) => a + (b.attempts || 0), 0);
    const completedModules = Object.values(learningProgress).filter(p => p.isCompleted).length;
    const streak = completedModules > 0 ? Math.min(completedModules, 7) : 0; 

    return (
        <div className="p-6 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2"><User /> {t.profileTitle}</h2>
            
            {/* User Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><User size={100} /></div>
                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-lg">
                        {userProfile.name ? userProfile.name[0]?.toUpperCase() : 'G'}
                    </div>
                    <div>
                        <h3 className="font-bold text-xl dark:text-white">{userProfile.name || 'Guest'}</h3>
                        <p className="text-xs text-gray-500 font-mono mb-1">{userProfile.studentId}</p>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${userProfile.isRegistered ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {userProfile.isRegistered ? t.reg : t.unreg}
                        </span>
                    </div>
                </div>
                
                {/* Details Grid */}
                {userProfile.isRegistered && (
                    <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600 dark:text-gray-300 border-t dark:border-gray-700 pt-4">
                        <div>
                            <p className="text-xs text-gray-400">Mobile</p>
                            <p className="font-medium">{userProfile.mobile}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Email</p>
                            <p className="font-medium">{userProfile.email || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">DOB</p>
                            <p className="font-medium">{userProfile.dob || '-'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400">Location</p>
                            <p className="font-medium">{userProfile.village}, {userProfile.district}, {userProfile.state}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Streak Only */}
            <div className="mb-6">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 dark:bg-orange-800 p-2 rounded-full"><Flame className="text-orange-500" size={24} /></div>
                        <div>
                            <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{t.currentStreak}</p>
                            <p className="text-xs text-orange-600/70 dark:text-orange-400/70">Keep learning daily!</p>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{streak}</p>
                </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6">
                <h4 className="font-bold mb-4 dark:text-white flex items-center gap-2"><BarChart size={18}/> {t.performanceTitle}</h4>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1 dark:text-gray-300"><span>{t.modulesCompleted}</span> <span className="font-bold">{completedModules}</span></div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${(completedModules/10)*100}%`}}></div></div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1 dark:text-gray-300"><span>{t.attempts}</span> <span className="font-bold">{totalAttempts}</span></div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{width: `${Math.min(totalAttempts*5, 100)}%`}}></div></div>
                    </div>
                </div>
            </div>

            <button onClick={handleLogout} className="w-full p-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition flex items-center justify-center gap-2 shadow-sm">
                <LogOut size={20}/> {t.logout}
            </button>
            <FooterCredits t={t} />
        </div>
    );
};

const SupportPage = ({ t }) => (
    <div className="p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2"><Handshake className="text-indigo-500"/> {t.supportTitle}</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8">{t.supportBody}</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <a href="tel:+919876543210" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3"><Phone className="text-green-600 dark:text-green-400" size={24}/></div>
                <span className="font-bold text-gray-800 dark:text-white">{t.callUs}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">+91-98765-43210</span>
            </a>
            <a href="mailto:help@digitalsaathi.in" className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-3"><Mail className="text-blue-600 dark:text-blue-400" size={24}/></div>
                <span className="font-bold text-gray-800 dark:text-white">{t.emailUs}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">help@digitalsaathi.in</span>
            </a>
        </div>

        <h3 className="font-bold text-lg mb-4 dark:text-white">{t.supportFaq}</h3>
        <div className="space-y-4">
            <FaqItem question={t.supportQ1} answer={t.supportA1} />
            <FaqItem question={t.supportQ2} answer={t.supportA2} />
            <FaqItem question={t.supportQ3} answer={t.supportA3} />
            <FaqItem question={t.supportQ4} answer={t.supportA4} />
        </div>
        <FooterCredits t={t} />
    </div>
);

const LanguageModal = ({ isOpen, onClose, currentLanguage, setLanguage, t }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onClose()}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-4 dark:text-white">{t.langModalTitle}</h3>
                <div className="space-y-2">
                    {['en', 'hi'].map(l => (
                        <button key={l} onClick={() => { setLanguage(l); onClose(); }} className={`w-full p-3 rounded-xl text-left font-medium transition ${currentLanguage === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}>
                            {l === 'en' ? 'English' : 'हिन्दी'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- 5. MAIN APP COMPONENT ---
const App = () => {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(getLocalItem('user_id'));
    const [userProfile, setUserProfile] = useState(getLocalItem('user_profile') || { name: '', isRegistered: false });
    const [learningProgress, setLearningProgress] = useState(getLocalItem(`progress_${userId}`) || {});
    const [token, setToken] = useState(getLocalItem('session_token'));
    
    const [page, setPage] = useState(userId ? 'home' : 'auth');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState(null);
    
    const [language, setLanguage] = useState(getLocalItem('language') || 'hi');
    const [darkMode, setDarkMode] = useState(() => getLocalItem('dark_mode') ?? window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [langModalOpen, setLangModalOpen] = useState(false);

    const t = useMemo(() => localizedText[language], [language]);

    const learningData = t.learningData; 

    const totalLearningTimeMinutes = useMemo(() => calculateLearningMinutes(learningProgress), [learningProgress]);

    useEffect(() => { 
        if (userId) {
            setLocalItem('user_id', userId);
            setLocalItem('user_profile', userProfile);
            setLearningProgress(getLocalItem(`progress_${userId}`) || {}); 
        } 
    }, [userId, userProfile]);

    useEffect(() => { if(token) setLocalItem('session_token', token); }, [token]);
    useEffect(() => setLocalItem('language', language), [language]);
    useEffect(() => {
        setLocalItem('dark_mode', darkMode);
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    useEffect(() => { setIsAuthReady(true); }, []);

    // IMPORTANT: Load user profile from Firestore on app load if user is authenticated
    useEffect(() => {
        const fetchProfile = async () => {
            if (userId && token && userProfile.isRegistered) {
                const data = await fetchUserData(userId, token);
                if (data) {
                    if (data.profile) {
                        setUserProfile(data.profile);
                        setLocalItem('user_profile', data.profile);
                    }
                    if (data.progress) {
                        setLearningProgress(prev => ({ ...prev, ...data.progress }));
                        setLocalItem(`progress_${userId}`, { ...learningProgress, ...data.progress });
                    }
                }
            }
        };
        fetchProfile();
    }, [userId, token]); 

    const handleSync = useCallback(async () => {
        if (userId && token && userProfile.isRegistered) {
            await mockSupabaseUpsertProgress(userId, learningProgress, token);
        }
    }, [userId, token, userProfile, learningProgress]);

    useEffect(() => { if(navigator.onLine) handleSync(); }, [handleSync]);

    const updateProgress = async (topicId, score, isCompleted, extras = {}) => {
        // Optimistic update
        const newProgressData = {
             attempts: (learningProgress[topicId]?.attempts || 0) + 1,
             highestScore: Math.max(learningProgress[topicId]?.highestScore || 0, score),
             lastScore: score,
             isCompleted: isCompleted || learningProgress[topicId]?.isCompleted,
             lastAttempt: new Date().toISOString(),
             categoryId: extras.categoryId
        };

        setLearningProgress(prev => {
            const updated = { ...prev, [topicId]: newProgressData };
            setLocalItem(`progress_${userId}`, updated);
            return updated;
        });
        
        // Push to Firestore
        if (token && userProfile.isRegistered) {
            await pushToRealSupabase(userId, { [topicId]: newProgressData }, token);
        }
    };

    const handleLogout = async () => {
        localStorage.clear();
        setUserId(null);
        setToken(null);
        setUserProfile({name:'', isRegistered:false});
        setPage('auth');
    };

    const handleTTS = () => {
        let txt = "";
        switch (page) {
            case 'home': txt = t.welcomeBody; break;
            case 'explore': txt = `${t.navExplore}. ${learningData.length} categories available.`; break;
            case 'category': txt = selectedCategory ? `${selectedCategory.name}. ${selectedCategory.topics.length} modules.` : ""; break;
            case 'topic': txt = selectedTopic ? `${selectedTopic.name}. ${selectedTopic.description}` : ""; break;
            case 'quiz': txt = `Quiz for ${selectedTopic?.name}. Answer 5 questions.`; break;
            case 'profile': txt = `${t.profileTitle}. Name: ${userProfile.name}. Student ID: ${userProfile.studentId}.`; break;
            case 'support': txt = `${t.supportTitle}. ${t.supportBody}`; break;
            default: txt = t.appTitle;
        }
        const u = new SpeechSynthesisUtterance(txt);
        u.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        window.speechSynthesis.speak(u);
    };

    const goToExplore = () => setPage('explore');
    const selectCategory = (id) => { 
        setSelectedCategory(learningData.find(c=>c.id===id)); 
        setPage('category'); 
    };
    const selectTopic = (id) => { 
        // Find topic across all categories
        let foundTopic, foundCat;
        for(const cat of learningData) {
            const t = cat.topics.find(top => top.id === id);
            if(t) { foundTopic = t; foundCat = cat; break; }
        }
        if(foundTopic) {
            setSelectedCategory(foundCat);
            setSelectedTopic(foundTopic); 
            setPage('topic'); 
        }
    };

    if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white"><Loader className="animate-spin" /></div>;

    if (page === 'auth') return <AuthPage t={t} setUserId={setUserId} setUserProfile={setUserProfile} setToken={setToken} setPage={setPage} syncProfileToSupabase={syncProfileToSupabase} setAppLanguage={setLanguage} currentLanguage={language} setLearningProgress={setLearningProgress} />;

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 pb-20 font-sans transition-colors duration-300">
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800 px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2" onClick={() => setPage('home')}>
                    <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><Layers size={20}/></div>
                    <h1 className="font-extrabold text-lg tracking-tight text-gray-900 dark:text-white">{t.appTitle}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleTTS} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"><Volume2 size={20}/></button>
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
                    <button onClick={() => setLangModalOpen(true)} className="p-2 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold text-xs w-8 h-8 flex items-center justify-center">{language.toUpperCase()}</button>
                </div>
            </header>

            {langModalOpen && <LanguageModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} currentLanguage={language} setLanguage={setLanguage} t={t} />}

            <main className="flex-grow">
                {page === 'home' && <HomePage t={t} userProfile={userProfile} learningProgress={learningProgress} learningData={learningData} selectCategory={selectCategory} selectTopic={selectTopic} goToExplore={goToExplore} userId={userId} token={token} totalLearningTimeMinutes={totalLearningTimeMinutes} />}
                
                {page === 'explore' && <ExplorePage t={t} learningData={learningData} learningProgress={learningProgress} selectCategory={selectCategory} />}
                
                {page === 'category' && <CategoryPage t={t} category={selectedCategory} learningProgress={learningProgress} goBack={() => setPage('home')} selectTopic={selectTopic} />}
                
                {page === 'topic' && <TopicPage t={t} topic={selectedTopic} learningProgress={learningProgress} goBack={() => setPage('category')} setPage={setPage} />}
                
                {page === 'quiz' && <QuizPage t={t} topic={selectedTopic} updateProgress={updateProgress} goBack={() => setPage('topic')} />}
                
                {page === 'profile' && <ProfilePage t={t} userProfile={userProfile} learningProgress={learningProgress} handleLogout={handleLogout} />}
                
                {page === 'simulation' && <SimulationPage t={t} setPage={setPage} />}
                
                {page === 'support' && <SupportPage t={t} />}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex justify-around p-2 z-30 pb-safe">
                <button onClick={() => setPage('home')} className={`p-2 flex flex-col items-center ${page==='home' ? 'text-indigo-600' : 'text-gray-400'}`}><Home size={24}/><span className="text-[10px] font-bold mt-1">{t.navHome}</span></button>
                <button onClick={() => setPage('explore')} className={`p-2 flex flex-col items-center ${page==='explore' || page==='category' ? 'text-indigo-600' : 'text-gray-400'}`}><ClipboardList size={24}/><span className="text-[10px] font-bold mt-1">{t.navExplore}</span></button>
                <button onClick={() => setPage('support')} className={`p-2 flex flex-col items-center ${page==='support' ? 'text-indigo-600' : 'text-gray-400'}`}><Handshake size={24}/><span className="text-[10px] font-bold mt-1">{t.navHelp}</span></button>
                <button onClick={() => setPage('profile')} className={`p-2 flex flex-col items-center ${page==='profile' ? 'text-indigo-600' : 'text-gray-400'}`}><User size={24}/><span className="text-[10px] font-bold mt-1">{t.navProgress}</span></button>
            </nav>
        </div>
    );
};

export default App;