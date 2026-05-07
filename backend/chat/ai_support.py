import re
import random
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import os

from django.utils import timezone
from django.conf import settings
from users.models import CustomUser
from .models import Message, ChatRoom

# Import Groq
try:
    from groq import Groq as GroqClient
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    GroqClient = None

# Import Google Generative AI (kept as fallback)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

# Import our new services
try:
    from .memory_service import MemoryService
    from .rag_service import RAGService
    ENHANCED_AI_AVAILABLE = True
except ImportError:
    ENHANCED_AI_AVAILABLE = False
    MemoryService = None
    RAGService = None

logger = logging.getLogger(__name__)

# ── Groq client (primary AI) ─────────────────────────────────────────────────
groq_client = None
if GROQ_AVAILABLE:
    _groq_key = getattr(settings, 'GROQ_API_KEY', '') or os.environ.get('GROQ_API_KEY', '')
    if _groq_key:
        try:
            groq_client = GroqClient(api_key=_groq_key)
            logger.info("Groq AI client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Groq client: {e}")

# ── Gemini client (kept but no longer primary) ────────────────────────────────
gemini_model = None
_gemini_unavailable_until: float = 0.0
_GEMINI_QUOTA_BACKOFF = 3600

if not groq_client and GEMINI_AVAILABLE:
    _gkey = getattr(settings, 'GEMINI_API_KEY', '') or os.environ.get('GOOGLE_API_KEY', '')
    if _gkey:
        try:
            genai.configure(api_key=_gkey)
            gemini_model = genai.GenerativeModel(
                model_name='models/gemini-2.0-flash',
                generation_config={'temperature': 0.75, 'top_p': 0.9, 'max_output_tokens': 512},
                safety_settings=[
                    {'category': 'HARM_CATEGORY_HARASSMENT',        'threshold': 'BLOCK_ONLY_HIGH'},
                    {'category': 'HARM_CATEGORY_HATE_SPEECH',       'threshold': 'BLOCK_ONLY_HIGH'},
                    {'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold': 'BLOCK_ONLY_HIGH'},
                    {'category': 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold': 'BLOCK_ONLY_HIGH'},
                ]
            )
            logger.info("Gemini AI client initialized as fallback")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")

# Initialize services
if ENHANCED_AI_AVAILABLE:
    memory_service = MemoryService()
    rag_service = RAGService()
else:
    memory_service = None
    rag_service = None

# Crisis keywords for detection
CRISIS_KEYWORDS = {
    'high_risk': [
        'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
        'end it all', 'take my own life', 'not worth living', 'want to disappear',
        'hurt myself', 'self harm', 'cut myself', 'overdose', 'pills'
    ],
    'medium_risk': [
        'depressed', 'hopeless', 'worthless', 'alone', 'trapped', 'desperate',
        'can\'t go on', 'giving up', 'no point', 'burden', 'hate myself',
        'anxiety', 'panic', 'scared', 'terrified', 'overwhelmed'
    ],
    'low_risk': [
        'sad', 'upset', 'worried', 'stressed', 'tired', 'frustrated',
        'angry', 'confused', 'lonely', 'disappointed'
    ]
}

# Positive keywords for mood detection
POSITIVE_KEYWORDS = [
    'happy', 'good', 'great', 'wonderful', 'excited', 'joyful', 'grateful',
    'peaceful', 'calm', 'content', 'hopeful', 'optimistic', 'blessed'
]

# AI Response templates
CRISIS_RESPONSES = [
    """I'm really concerned about what you're sharing with me. Your safety is the most important thing right now. 

🆘 **IMMEDIATE HELP:**
• National Suicide Prevention Lifeline: **988**
• Crisis Text Line: **Text HOME to 741741**
• Emergency Services: **911**

Please know that you're not alone. There are people who want to help you through this difficult time. Would you be willing to reach out to one of these resources right now?""",

    """Thank you for trusting me with how you're feeling. I want you to know that what you're experiencing right now doesn't have to be permanent, and there is help available.

🌟 **YOU MATTER** - Your life has value and meaning.

**Immediate Support:**
• Call 988 for the Suicide & Crisis Lifeline
• Text "HELLO" to 741741 for Crisis Text Line
• Go to your nearest emergency room

Can you tell me if you have someone close by who could stay with you right now?""",

    """I hear that you're in a lot of pain right now, and I'm glad you reached out. That takes courage. 

**Right now, let's focus on keeping you safe:**

1. **Call 988** - They have trained counselors available 24/7
2. **Remove any means of harm** from your immediate area
3. **Reach out to a trusted friend or family member**
4. **Consider going to your nearest emergency room**

You deserve support and care. Are you somewhere safe right now?"""
]

SUPPORTIVE_RESPONSES = [
    """I hear you, and I want you to know that it's completely normal to feel this way sometimes. Mental health struggles are real, but they're also treatable.

Here are some things that might help:
• **Grounding technique**: Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste
• **Deep breathing**: Try the 4-7-8 technique (inhale 4, hold 7, exhale 8)
• **Reach out**: Connect with someone you trust

What's one small thing you could do for yourself today?""",

    """Thank you for sharing that with me. It takes strength to talk about difficult feelings.

**Remember:**
• Feelings are temporary - they will pass
• You've overcome challenges before
• Small steps count as progress
• You don't have to face this alone

**Helpful strategies:**
• Take a warm shower or bath
• Listen to calming music
• Write down your thoughts
• Take a short walk outside

Is there a coping strategy that has helped you before?""",

    """I'm here to listen and support you. What you're going through is valid, and seeking help shows real courage.

**Some gentle reminders:**
• Progress isn't always linear
• It's okay to have difficult days
• You deserve compassion, especially from yourself
• There are people who care about you

**Quick mood boosters:**
• Call or text a friend
• Watch something funny
• Do a small act of kindness
• Practice gratitude for 3 things

What would feel most helpful for you right now?"""
]

COPING_STRATEGIES = {
    'anxiety': [
        "Try the 5-4-3-2-1 grounding technique: Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.",
        "Practice box breathing: Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat.",
        "Challenge anxious thoughts: Ask yourself 'Is this thought helpful? Is it based on facts?'",
        "Try progressive muscle relaxation: Tense and release each muscle group for 5 seconds."
    ],
    'depression': [
        "Start with one small task: Make your bed, brush your teeth, or drink a glass of water.",
        "Get some sunlight: Even 10 minutes outside can help boost your mood.",
        "Reach out to one person: Send a text to someone you care about.",
        "Practice self-compassion: Treat yourself with the same kindness you'd show a friend."
    ],
    'stress': [
        "Take breaks: Even 5 minutes away from stressors can help reset your mind.",
        "Prioritize tasks: Make a list and tackle the most important items first.",
        "Practice saying no: It's okay to set boundaries to protect your mental health.",
        "Use positive self-talk: Replace 'I can't handle this' with 'I'll take this one step at a time.'"
    ],
    'anger': [
        "Count to 10 slowly before responding to frustrating situations.",
        "Try physical release: Go for a walk, do jumping jacks, or punch a pillow.",
        "Use 'I' statements: Express how you feel without blaming others.",
        "Take a timeout: Remove yourself from the situation until you feel calmer."
    ]
}

RESOURCES = {
    'crisis': [
        # India
        {'name': 'iCall (India)', 'contact': '9152987821', 'description': 'Free counselling — Mon–Sat 8am–10pm', 'country': 'IN'},
        {'name': 'Vandrevala Foundation', 'contact': '1860-2662-345', 'description': '24/7 mental health helpline India', 'country': 'IN'},
        {'name': 'AASRA', 'contact': '9820466627', 'description': '24/7 suicide prevention helpline India', 'country': 'IN'},
        {'name': 'Snehi India', 'contact': '044-24640050', 'description': 'Emotional support helpline India', 'country': 'IN'},
        {'name': 'Emergency Services India', 'contact': '112', 'description': 'All-in-one emergency number India', 'country': 'IN'},
        # International
        {'name': '988 Suicide & Crisis Lifeline (US)', 'contact': '988', 'description': '24/7 — call or text (USA)', 'country': 'US'},
        {'name': 'Crisis Text Line (US)', 'contact': 'Text HOME to 741741', 'description': '24/7 text-based crisis support (USA)', 'country': 'US'},
        {'name': 'Samaritans (UK)', 'contact': '116 123', 'description': '24/7 free support (UK/Ireland)', 'country': 'UK'},
        {'name': 'Lifeline (Australia)', 'contact': '13 11 14', 'description': '24/7 crisis support (Australia)', 'country': 'AU'},
    ],
    'support': [
        {'name': 'iCall (India)', 'contact': 'icallhelpline.org', 'description': 'Free online counselling — India'},
        {'name': 'The Live Love Laugh Foundation', 'contact': 'thelivelovelaughfoundation.org', 'description': 'Mental health awareness — India'},
        {'name': 'Vandrevala Foundation', 'contact': 'vandrevalafoundation.com', 'description': 'Free therapy & counselling — India'},
        {'name': 'NIMHANS', 'contact': '080-46110007', 'description': 'National mental health institute — Bangalore'},
        {'name': 'NAMI (US)', 'contact': 'nami.org', 'description': 'Mental health education & support — USA'},
        {'name': 'Mind (UK)', 'contact': 'mind.org.uk', 'description': 'Mental health support — UK'},
    ]
}

def detect_crisis_keywords(text: str) -> List[str]:
    """Detect crisis-related keywords in text and return matched keywords."""
    text_lower = text.lower()
    detected_keywords = []
    
    # First check if this is an informational query - these should NOT trigger crisis
    informational_patterns = [
        'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
        'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
        'techniques', 'strategies for', 'signs of', 'reasons for', 'factors',
        'what causes', 'why do', 'what is', 'define', 'difference between',
        'help me understand', 'can you explain', 'information about'
    ]
    
    # If this is an informational query, don't trigger crisis detection
    if any(pattern in text_lower for pattern in informational_patterns):
        return []
    
    # Check for high-risk keywords first
    for keyword in CRISIS_KEYWORDS['high_risk']:
        if keyword in text_lower:
            detected_keywords.append(keyword)
    
    # If no high-risk, check medium-risk keywords but with context
    if not detected_keywords:
        for keyword in CRISIS_KEYWORDS['medium_risk']:
            if keyword in text_lower:
                # Additional context check for medium-risk keywords
                # Only flag as crisis if used in first person or urgent context
                personal_indicators = ['i am', 'i feel', 'i have', 'i\'m', 'my', 'me']
                urgent_indicators = ['right now', 'currently', 'today', 'this moment', 'can\'t']
                
                if (any(indicator in text_lower for indicator in personal_indicators) or 
                    any(indicator in text_lower for indicator in urgent_indicators)):
                    detected_keywords.append(keyword)
    
    return detected_keywords

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Basic sentiment analysis of text."""
    text_lower = text.lower()
    
    # Count positive and negative indicators
    positive_count = sum(1 for word in POSITIVE_KEYWORDS if word in text_lower)
    
    negative_count = 0
    for risk_level in CRISIS_KEYWORDS.values():
        negative_count += sum(1 for word in risk_level if word in text_lower)
    
    # Determine overall sentiment
    if negative_count > positive_count:
        if any(keyword in text_lower for keyword in CRISIS_KEYWORDS['high_risk']):
            sentiment = 'crisis'
            confidence = 0.9
        elif any(keyword in text_lower for keyword in CRISIS_KEYWORDS['medium_risk']):
            sentiment = 'negative'
            confidence = 0.7
        else:
            sentiment = 'slightly_negative'
            confidence = 0.5
    elif positive_count > negative_count:
        sentiment = 'positive'
        confidence = 0.6
    else:
        sentiment = 'neutral'
        confidence = 0.4
    
    return {
        'sentiment': sentiment,
        'confidence': confidence,
        'positive_indicators': positive_count,
        'negative_indicators': negative_count
    }

def get_coping_strategy(mood_type: str = None) -> str:
    """Get a relevant coping strategy based on mood type."""
    if mood_type and mood_type in COPING_STRATEGIES:
        return random.choice(COPING_STRATEGIES[mood_type])
    
    # Return a general strategy if no specific type
    all_strategies = []
    for strategies in COPING_STRATEGIES.values():
        all_strategies.extend(strategies)
    
    return random.choice(all_strategies)

def get_ai_response(message: str, is_crisis: bool = False, user_context: Dict = None,
                   conversation_history: List[Dict] = None) -> str:
    """Public entry point — delegates to generate_gemini_response (Groq/Gemini/static)."""
    return generate_gemini_response(
        message=message,
        crisis_detected=is_crisis or bool(detect_crisis_keywords(message)),
        user_context=user_context or {},
        conversation_history=conversation_history or [],
    )


def _get_ai_response_static(message: str, is_crisis: bool = False, user_context: Dict = None) -> str:
    """Pure static fallback — no API calls. Used internally only."""
    # Last-resort minimal responses
    if is_crisis or detect_crisis_keywords(message):
        return ("What you're feeling right now sounds really heavy, and reaching out took courage. "
                "Please know you're not alone — if you're in crisis, call **iCall: 9152987821** or **Vandrevala: 1860-2662-345** (24/7, free). "
                "Are you somewhere safe right now?")

    return "I'm here with you. Tell me more about what's going on."

def get_emergency_resources() -> List[Dict]:
    """Get emergency crisis resources."""
    return RESOURCES['crisis']

def get_support_resources() -> List[Dict]:
    """Get general mental health support resources."""
    return RESOURCES['support']

def check_message_urgency(message: str) -> str:
    """Determine the urgency level of a message."""
    text_lower = message.lower()
    
    # Check for immediate danger indicators
    immediate_danger = [
        'right now', 'tonight', 'today', 'going to', 'plan to',
        'have the', 'ready to', 'can\'t wait'
    ]
    
    high_risk_present = any(keyword in text_lower for keyword in CRISIS_KEYWORDS['high_risk'])
    immediate_indicators = any(phrase in text_lower for phrase in immediate_danger)
    
    if high_risk_present and immediate_indicators:
        return 'critical'
    elif high_risk_present:
        return 'high'
    elif any(keyword in text_lower for keyword in CRISIS_KEYWORDS['medium_risk']):
        return 'medium'
    else:
        return 'low'

def generate_safety_plan_suggestions(user_context: Dict = None) -> List[str]:
    """Generate personalized safety plan suggestions."""
    suggestions = [
        "Identify your warning signs - What thoughts, feelings, or behaviors indicate you're in crisis?",
        "List your coping strategies - What has helped you feel better in the past?",
        "Identify people you can call for support - Friends, family, or professionals",
        "Remove or restrict access to lethal means during crisis periods",
        "List reasons for living - Things that give your life meaning and purpose",
        "Create a calm environment - Remove stressors when possible",
        "Practice grounding techniques - 5-4-3-2-1 method, deep breathing, etc."
    ]
    
    if user_context:
        # Customize based on user's specific context
        if user_context.get('crisis_level') == 'high':
            suggestions.insert(0, "Contact your therapist or crisis counselor immediately")
        
        recent_moods = user_context.get('recent_moods', [])
        if recent_moods and all(mood['level'] < 3 for mood in recent_moods[-3:]):
            suggestions.append("Consider asking a trusted person to check on you daily")
    
    return suggestions

def get_breathing_exercise() -> Dict[str, Any]:
    """Get a guided breathing exercise."""
    exercises = [
        {
            'name': '4-7-8 Breathing',
            'description': 'Inhale for 4 counts, hold for 7, exhale for 8',
            'steps': [
                'Find a comfortable position',
                'Exhale completely through your mouth',
                'Close your mouth and inhale through nose for 4 counts',
                'Hold your breath for 7 counts',
                'Exhale through mouth for 8 counts',
                'Repeat 3-4 times'
            ],
            'duration': '2-3 minutes'
        },
        {
            'name': 'Box Breathing',
            'description': 'Equal counts for inhale, hold, exhale, hold',
            'steps': [
                'Sit comfortably with back straight',
                'Inhale for 4 counts',
                'Hold for 4 counts',
                'Exhale for 4 counts', 
                'Hold empty for 4 counts',
                'Repeat 4-6 times'
            ],
            'duration': '2-4 minutes'
        }
    ]
    
    return random.choice(exercises)

def generate_gemini_response(message: str, user_context: Dict = None,
                           relevant_knowledge: List[Dict] = None,
                           crisis_detected: bool = False,
                           conversation_history: List[Dict] = None) -> str:
    """Generate AI response — uses Groq (primary) or Gemini (fallback)."""
    import time
    global gemini_model, _gemini_unavailable_until

    # ── Try Groq first ────────────────────────────────────────────────────────
    if groq_client:
        try:
            return _generate_groq_response(
                message=message,
                crisis_detected=crisis_detected,
                user_context=user_context or {},
                relevant_knowledge=relevant_knowledge or [],
                conversation_history=conversation_history or [],
            )
        except Exception as e:
            logger.error(f"Groq response failed, falling back: {e}")

    # ── Gemini fallback (circuit-breaker guarded) ─────────────────────────────
    if time.time() < _gemini_unavailable_until:
        return _static_fallback(message, crisis_detected, user_context)

    if not gemini_model or not GEMINI_AVAILABLE:
        return _static_fallback(message, crisis_detected, user_context)
    
    try:
        # ── Crisis path — safety first ────────────────────────────────────────
        if crisis_detected:
            crisis_keywords = detect_crisis_keywords(message)
            prompt = f"""You are MindWell, a compassionate mental health support companion. \
A user has sent a message that contains crisis indicators.

Detected concerns: {', '.join(crisis_keywords[:3]) if crisis_keywords else 'distress signals'}

Your response MUST:
1. Open with genuine empathy — acknowledge their pain without judgment
2. Affirm that they are not alone and that what they feel is real
3. Provide these crisis resources clearly:
   - iCall India: **9152987821** (free counselling, Mon–Sat 8am–10pm)
   - Vandrevala Foundation: **1860-2662-345** (24/7, free)
   - AASRA: **9820466627** (24/7 suicide prevention)
   - Emergency: **112**
4. Ask one gentle, open-ended question to keep them engaged (e.g. "Are you somewhere safe right now?")
5. Be warm, human, and direct — NOT clinical or robotic
6. Keep the response under 220 words

User message: "{message}"
"""
            response = gemini_model.generate_content(prompt)
            return response.text.strip() if response and response.text else random.choice(CRISIS_RESPONSES)

        # ── Build shared context block ────────────────────────────────────────
        context_lines = []

        if user_context:
            memories = user_context.get('recent_memories', [])[:2]
            if memories:
                summaries = [m.get('content', '')[:80] for m in memories]
                context_lines.append("Recent user context: " + " | ".join(summaries))

            strategies = user_context.get('effective_strategies', [])[:3]
            if strategies:
                context_lines.append("Strategies that have helped this user: " + ", ".join(strategies))

            tone = user_context.get('preferred_tone')
            if tone:
                context_lines.append(f"User prefers a {tone} communication style.")

        if relevant_knowledge:
            for item in relevant_knowledge[:2]:
                if item.get('source') == 'knowledge_base':
                    title = item.get('metadata', {}).get('title', 'Mental Health Info')
                    preview = item.get('content', '')[:180]
                    context_lines.append(f"[{title}]: {preview}...")

        context_block = "\n".join(f"- {line}" for line in context_lines)

        # ── Detect query type ─────────────────────────────────────────────────
        informational_patterns = [
            'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
            'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
            'techniques', 'strategies for', 'signs of', 'reasons for', 'factors',
            'what causes', 'why do', 'what is', 'define', 'difference between',
            'help me understand', 'can you explain', 'information about'
        ]
        is_informational = any(p in message.lower() for p in informational_patterns)
        sentiment = analyze_sentiment(message)

        # ── System persona (shared by all non-crisis paths) ───────────────────
        SYSTEM_PERSONA = """You are MindWell, a warm and knowledgeable mental health support companion built into the MindWell wellness app.

Core identity:
- You are caring, non-judgmental, and always emotionally present
- You speak like a trusted friend who also happens to have mental health knowledge
- You NEVER diagnose, prescribe, or provide medical advice
- You encourage professional therapy for serious concerns
- You remember the user's context when it is provided to you
- You do NOT start responses with "I" — vary your sentence openings
- You do NOT use hollow phrases like "That's great!", "Absolutely!", "Certainly!" or "Of course!"

Formatting rules:
- Use **bold** for key terms, resource names, and action items
- Use bullet points only when listing 3+ items
- Emojis: use 0–2 per response, only when they add warmth (never for crisis topics)
- Never use headers (##) in conversational replies
"""

        # ── Informational query prompt ────────────────────────────────────────
        if is_informational:
            prompt = f"""{SYSTEM_PERSONA}

The user is asking an informational question about mental health. Your job:
- Answer the question directly, accurately, and completely
- Organise information with bullet points or numbered lists as appropriate
- Include practical, actionable advice
- Mention when professional help is recommended
- Length: 120–280 words — enough to be genuinely helpful, not so long it feels like a lecture
{f"Context about this user:{chr(10)}{context_block}" if context_block else ""}

User message: "{message}"
"""

        # ── Emotional / conversational prompt ────────────────────────────────
        else:
            mood_instruction = ""
            if sentiment['sentiment'] in ['negative', 'slightly_negative']:
                mood_instruction = "The user seems to be struggling. Lead with empathy, then gently offer one concrete coping technique relevant to what they described."
            elif sentiment['sentiment'] == 'positive':
                mood_instruction = "The user is in a positive place. Celebrate with them briefly and reinforce the habits or mindset contributing to this."
            else:
                mood_instruction = "Respond conversationally — ask a thoughtful follow-up question or offer a gentle insight based on what they shared."

            prompt = f"""{SYSTEM_PERSONA}

{mood_instruction}

Conversation guidelines:
- Validate feelings FIRST before any suggestions (1–2 sentences of empathy)
- Offer 1 specific, concrete coping strategy if relevant — not a generic list
- End with ONE open question that invites them to share more
- Length: 60–150 words — warm and focused, never padded
{f"Context about this user:{chr(10)}{context_block}" if context_block else ""}

User message: "{message}"
"""

        # ── Build Gemini multi-turn history ──────────────────────────────────
        gemini_history = []
        history = conversation_history or []
        prior = [h for h in history if not (h.get('role') == 'user' and h.get('content') == message)]
        for turn in prior[-10:]:
            role = 'user' if turn.get('role') == 'user' else 'model'
            gemini_history.append({'role': role, 'parts': [turn.get('content', '')]})

        chat = gemini_model.start_chat(history=gemini_history)
        response = chat.send_message(prompt)

        if response and response.text:
            generated_text = response.text.strip()
            if len(generated_text) < 20 or generated_text.lower().startswith("i cannot"):
                return _static_fallback(message, crisis_detected, user_context)
            return generated_text

        return _static_fallback(message, crisis_detected, user_context)

    except Exception as e:
        import time
        err_str = str(e)
        if '429' in err_str or 'quota' in err_str.lower() or 'resource_exhausted' in err_str.lower():
            _gemini_unavailable_until = time.time() + _GEMINI_QUOTA_BACKOFF
            logger.warning(f"Gemini quota exceeded — using static fallback for {_GEMINI_QUOTA_BACKOFF // 60} min.")
        else:
            logger.error(f"Gemini AI response generation failed: {e}")
        return _static_fallback(message, crisis_detected, user_context)


def _static_fallback(message: str, is_crisis: bool, user_context: Dict) -> str:
    """Pure static responses — no API calls, no recursion."""
    if is_crisis or detect_crisis_keywords(message):
        return ("What you're feeling sounds really heavy, and reaching out took courage. "
                "You're not alone — please call **iCall: 9152987821** or **Vandrevala: 1860-2662-345** (24/7, free). "
                "Are you somewhere safe right now?")
    return random.choice(SUPPORTIVE_RESPONSES)


def _build_ai_prompt(message: str, crisis_detected: bool, user_context: Dict,
                     relevant_knowledge: list, conversation_history: list) -> tuple:
    """Build the system persona + user prompt shared by Groq and Gemini."""
    context_lines = []
    if user_context:
        memories = user_context.get('recent_memories', [])[:2]
        if memories:
            context_lines.append("Recent user context: " + " | ".join(m.get('content', '')[:80] for m in memories))
        strategies = user_context.get('effective_strategies', [])[:3]
        if strategies:
            context_lines.append("Strategies that helped this user: " + ", ".join(strategies))
        tone = user_context.get('preferred_tone')
        if tone:
            context_lines.append(f"User prefers a {tone} communication style.")
    for item in (relevant_knowledge or [])[:2]:
        if item.get('source') == 'knowledge_base':
            title = item.get('metadata', {}).get('title', 'Info')
            context_lines.append(f"[{title}]: {item.get('content','')[:180]}...")
    context_block = "\n".join(f"- {l}" for l in context_lines)

    SYSTEM_PERSONA = """You are MindWell, a warm and knowledgeable mental health support companion.

Core identity:
- Caring, non-judgmental, always emotionally present
- Speak like a trusted friend with mental health knowledge
- NEVER diagnose, prescribe, or provide medical advice
- Encourage professional therapy for serious concerns
- Do NOT start responses with "I" — vary sentence openings
- Do NOT use hollow phrases like "Absolutely!", "Certainly!", "Of course!"

Formatting:
- **bold** for key terms and action items
- Bullet points only when listing 3+ items
- 0–2 emojis per response, only for warmth (never in crisis responses)
- No headers (##) in conversational replies"""

    informational_patterns = [
        'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
        'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
        'techniques', 'strategies for', 'signs of', 'what causes', 'why do',
        'what is', 'define', 'difference between', 'help me understand', 'information about'
    ]
    is_informational = any(p in message.lower() for p in informational_patterns)
    sentiment = analyze_sentiment(message)

    if crisis_detected:
        user_prompt = f"""{SYSTEM_PERSONA}

A user has sent a message with crisis indicators. Your response MUST:
1. Open with genuine empathy
2. Affirm they are not alone
3. Provide resources: iCall **9152987821**, Vandrevala **1860-2662-345** (24/7), Emergency **112**
4. Ask one gentle open-ended question
5. Under 220 words, warm and direct

User message: "{message}"
"""
    elif is_informational:
        user_prompt = f"""{SYSTEM_PERSONA}

Answer this mental health question directly and completely.
- Use bullets/numbers as appropriate
- Include practical actionable advice
- Mention professional help when relevant
- Length: 120–280 words
{f"User context:{chr(10)}{context_block}" if context_block else ""}

User message: "{message}"
"""
    else:
        if sentiment['sentiment'] in ('negative', 'slightly_negative'):
            mood = "The user is struggling. Lead with empathy, then offer one concrete coping technique."
        elif sentiment['sentiment'] == 'positive':
            mood = "The user is in a positive place. Celebrate briefly and reinforce their habits."
        else:
            mood = "Respond conversationally — ask a thoughtful follow-up or offer a gentle insight."
        user_prompt = f"""{SYSTEM_PERSONA}

{mood}
- Validate feelings FIRST (1–2 sentences)
- Offer 1 specific coping strategy if relevant
- End with ONE open question
- Length: 60–150 words
{f"User context:{chr(10)}{context_block}" if context_block else ""}

User message: "{message}"
"""
    return SYSTEM_PERSONA, user_prompt


def _generate_groq_response(message: str, crisis_detected: bool, user_context: Dict,
                            relevant_knowledge: list, conversation_history: list) -> str:
    """Call Groq API with llama-3.3-70b-versatile."""
    system_persona, _ = _build_ai_prompt(
        message, crisis_detected, user_context, relevant_knowledge, conversation_history
    )

    # Build the system instruction (persona + task for this turn)
    if crisis_detected:
        task = ("A user has sent a message with crisis indicators. "
                "Open with genuine empathy, affirm they are not alone, provide crisis resources "
                "(iCall: 9152987821, Vandrevala: 1860-2662-345, Emergency: 112), "
                "ask one gentle open-ended question. Under 220 words.")
    else:
        sentiment = analyze_sentiment(message)
        informational_patterns = [
            'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
            'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
            'techniques', 'strategies for', 'signs of', 'what causes', 'why do',
            'what is', 'define', 'difference between', 'help me understand', 'information about'
        ]
        if any(p in message.lower() for p in informational_patterns):
            task = "Answer the mental health question directly and helpfully. 120–280 words. Use bullets if listing 3+ items."
        elif sentiment['sentiment'] in ('negative', 'slightly_negative'):
            task = "The user is struggling. Lead with empathy, then offer one concrete coping technique. 60–150 words."
        elif sentiment['sentiment'] == 'positive':
            task = "The user is in a positive place. Celebrate briefly and reinforce their habits. 60–150 words."
        else:
            task = "Respond conversationally — ask a thoughtful follow-up or offer a gentle insight. 60–150 words."

    system_message = f"{system_persona}\n\nFor this response: {task}"

    # Build conversation history (prior turns only)
    messages = [{'role': 'system', 'content': system_message}]
    for turn in (conversation_history or [])[-10:]:
        if turn.get('role') == 'user' and turn.get('content') == message:
            continue  # skip current turn — added below
        role = 'user' if turn.get('role') == 'user' else 'assistant'
        messages.append({'role': role, 'content': turn.get('content', '')})

    # Add the actual user message cleanly
    messages.append({'role': 'user', 'content': message})

    completion = groq_client.chat.completions.create(
        model='llama-3.3-70b-versatile',
        messages=messages,
        temperature=0.75,
        max_tokens=512,
    )
    text = completion.choices[0].message.content.strip()
    if len(text) < 20 or text.lower().startswith('i cannot'):
        return _static_fallback(message, crisis_detected, user_context)
    return text

# Enhanced AI functions with memory and RAG

def get_enhanced_ai_response(message: str, user: CustomUser = None,
                           room: ChatRoom = None, message_obj: Message = None,
                           conversation_history: List[Dict] = None) -> Dict[str, Any]:
    """
    Get enhanced AI response using memory, RAG, and personalization.
    """
    crisis_detected = bool(detect_crisis_keywords(message))

    if not ENHANCED_AI_AVAILABLE:
        return {
            'response': generate_gemini_response(
                message, crisis_detected=crisis_detected,
                conversation_history=conversation_history or []
            ),
            'memory_used': [], 'knowledge_used': [],
            'crisis_detected': crisis_detected, 'personalized': False
        }
    
    try:
        # Use RAG service to generate contextual response
        rag_result = rag_service.generate_contextual_response(
            user_query=message,
            user=user,
            context={
                'room_id': room.id if room else None,
                'message_id': message_obj.id if message_obj else None
            }
        )
        
        response = rag_result['response']
        crisis_detected = rag_result['crisis_detected']
        urgency_level = rag_result['urgency_level']
        
        # Store important information in user memory if user is provided
        if user and memory_service:
            _store_interaction_memory(user, message, response, message_obj, crisis_detected)
        
        # Update conversation memory if room is provided
        if user and room and memory_service:
            _update_conversation_context(user, room, message, response)
        
        # Learn from this interaction (only if we have a Message object)
        if user and memory_service and message_obj:
            memory_service.learn_from_interaction(user, message_obj, response)
        
        return {
            'response': response,
            'memory_used': rag_result['context'].get('relevant_knowledge', []),
            'knowledge_used': rag_result['knowledge_used'],
            'crisis_detected': crisis_detected,
            'urgency_level': urgency_level,
            'personalized': True,
            'context': rag_result['context']
        }
        
    except Exception as e:
        logger.error(f"Enhanced AI response failed: {e}")
        # Fallback to basic response
        return {
            'response': get_ai_response(message),
            'memory_used': [],
            'knowledge_used': [],
            'crisis_detected': detect_crisis_keywords(message) != [],
            'personalized': False,
            'error': str(e)
        }

def _store_interaction_memory(user: CustomUser, message: str, response: str, 
                            message_obj: Message = None, crisis_detected: bool = False):
    """Store relevant information from this interaction in user memory"""
    try:
        # Detect and store various types of memories
        
        # Store crisis-related memories with high importance
        if crisis_detected:
            crisis_keywords = detect_crisis_keywords(message)
            memory_service.store_user_memory(
                user=user,
                content=f"User expressed crisis indicators: {', '.join(crisis_keywords[:3])}. Context: {message[:100]}...",
                memory_type='trigger',
                importance='critical',
                source_message=message_obj,
                context={
                    'crisis_keywords': crisis_keywords,
                    'full_message': message,
                    'response_provided': response[:100] + "..." if len(response) > 100 else response
                }
            )
        
        # Store mood and emotional information
        sentiment = analyze_sentiment(message)
        if sentiment['confidence'] > 0.6:
            memory_service.store_user_memory(
                user=user,
                content=f"User mood: {sentiment['sentiment']} (confidence: {sentiment['confidence']:.2f})",
                memory_type='mood_pattern',
                importance='medium' if sentiment['sentiment'] != 'crisis' else 'high',
                source_message=message_obj,
                context={
                    'sentiment_analysis': sentiment,
                    'timestamp': timezone.now().isoformat()
                }
            )
        
        # Store mentioned coping strategies or preferences
        coping_indicators = ['helps', 'works for me', 'tried', 'prefer', 'like', 'effective']
        if any(indicator in message.lower() for indicator in coping_indicators):
            memory_service.store_user_memory(
                user=user,
                content=f"User mentioned preferences/experiences: {message}",
                memory_type='preference',
                importance='medium',
                source_message=message_obj,
                context={
                    'category': 'coping_strategy',
                    'full_context': message
                }
            )
        
        # Store personal information shared by user
        personal_indicators = ['my', 'i am', 'i have', 'i feel', 'i think', 'i believe']
        if any(indicator in message.lower() for indicator in personal_indicators):
            # Don't store if it's too personal or sensitive
            sensitive_topics = ['address', 'phone', 'password', 'social security']
            if not any(topic in message.lower() for topic in sensitive_topics):
                memory_service.store_user_memory(
                    user=user,
                    content=f"Personal context: {message}",
                    memory_type='personal_info',
                    importance='low',
                    source_message=message_obj,
                    context={
                        'category': 'self_disclosed',
                        'timestamp': timezone.now().isoformat()
                    }
                )
        
    except Exception as e:
        logger.error(f"Failed to store interaction memory: {e}")

def _update_conversation_context(user: CustomUser, room: ChatRoom, message: str, response: str):
    """Update conversation-level memory and context"""
    try:
        # Analyze message for key topics
        key_topics = _extract_topics(message)
        
        # Analyze emotional state
        sentiment = analyze_sentiment(message)
        emotional_state = {
            'current_mood': sentiment['sentiment'],
            'confidence': sentiment['confidence'],
            'timestamp': timezone.now().isoformat()
        }
        
        # Extract mentioned concerns
        concerns = _extract_concerns(message)
        
        # Update conversation memory
        memory_service.update_conversation_memory(
            user=user,
            room=room,
            summary=f"User discussed: {', '.join(key_topics[:3])}. Mood: {sentiment['sentiment']}",
            key_topics=key_topics,
            emotional_state=emotional_state,
            concerns=concerns
        )
        
    except Exception as e:
        logger.error(f"Failed to update conversation context: {e}")

def _extract_topics(message: str) -> List[str]:
    """Extract key topics from a message"""
    topics = []
    
    # Mental health topic keywords
    topic_keywords = {
        'anxiety': ['anxiety', 'anxious', 'worried', 'panic', 'nervous'],
        'depression': ['depression', 'depressed', 'sad', 'hopeless', 'down'],
        'stress': ['stress', 'stressed', 'pressure', 'overwhelmed'],
        'sleep': ['sleep', 'insomnia', 'tired', 'exhausted', 'rest'],
        'work': ['work', 'job', 'career', 'boss', 'colleague'],
        'relationships': ['relationship', 'partner', 'family', 'friend', 'love'],
        'therapy': ['therapy', 'therapist', 'counseling', 'treatment'],
        'medication': ['medication', 'pills', 'medicine', 'antidepressant'],
        'self_care': ['self care', 'exercise', 'meditation', 'mindfulness'],
        'crisis': ['suicide', 'self harm', 'crisis', 'emergency']
    }
    
    message_lower = message.lower()
    for topic, keywords in topic_keywords.items():
        if any(keyword in message_lower for keyword in keywords):
            topics.append(topic)
    
    return topics

def _extract_concerns(message: str) -> List[str]:
    """Extract specific concerns mentioned in the message"""
    concerns = []
    
    concern_patterns = [
        r"worried about (.+?)(?:\.|$|,)",
        r"concerned about (.+?)(?:\.|$|,)", 
        r"afraid of (.+?)(?:\.|$|,)",
        r"scared of (.+?)(?:\.|$|,)",
        r"can't handle (.+?)(?:\.|$|,)",
        r"struggling with (.+?)(?:\.|$|,)"
    ]
    
    for pattern in concern_patterns:
        matches = re.findall(pattern, message, re.IGNORECASE)
        concerns.extend([match.strip() for match in matches])
    
    return concerns[:5]  # Limit to 5 concerns

def get_personalized_response(user: CustomUser, message: str) -> str:
    """Get a response personalized for the specific user"""
    if not ENHANCED_AI_AVAILABLE or not memory_service:
        return get_ai_response(message)
    
    try:
        # Get user's personalization profile
        profile = memory_service.get_personalization_profile(user)
        
        # Get relevant memories
        relevant_memories = memory_service.retrieve_relevant_memories(
            user=user,
            query=message,
            limit=3
        )
        
        # Build user context
        user_context = {
            'effective_strategies': profile.effective_strategies,
            'trigger_patterns': profile.trigger_patterns,
            'preferred_tone': profile.preferred_tone,
            'recent_memories': [
                {
                    'content': memory.content,
                    'type': memory.memory_type,
                    'importance': memory.importance
                }
                for memory in relevant_memories
            ]
        }
        
        # Generate response using enhanced context
        enhanced_result = get_enhanced_ai_response(message, user=user)
        return enhanced_result['response']
        
    except Exception as e:
        logger.error(f"Failed to get personalized response: {e}")
        return get_ai_response(message, user_context=None)

def initialize_ai_services():
    """Initialize the AI services (call this on startup)"""
    global memory_service, rag_service
    
    if ENHANCED_AI_AVAILABLE:
        try:
            # Initialize knowledge base
            if rag_service:
                rag_service.initialize_knowledge_base()
                logger.info("RAG service initialized successfully")
            
            # Cleanup expired memories
            if memory_service:
                memory_service.cleanup_expired_memories()
                logger.info("Memory service cleanup completed")
                
        except Exception as e:
            logger.error(f"Failed to initialize AI services: {e}")
    else:
        logger.warning("Enhanced AI services not available - using basic responses")

def get_user_memory_summary(user: CustomUser) -> Dict[str, Any]:
    """Get a summary of user's memory and interaction patterns"""
    if not ENHANCED_AI_AVAILABLE or not memory_service:
        return {}
    
    try:
        return memory_service.get_memory_stats(user)
    except Exception as e:
        logger.error(f"Failed to get memory summary: {e}")
        return {}

def add_knowledge_feedback(user: CustomUser, knowledge_title: str, was_helpful: bool):
    """Add user feedback about knowledge effectiveness"""
    if not ENHANCED_AI_AVAILABLE or not rag_service:
        return
    
    try:
        rag_service.add_user_feedback(knowledge_title, was_helpful)
        logger.info(f"Added feedback for knowledge: {knowledge_title} - helpful: {was_helpful}")
    except Exception as e:
        logger.error(f"Failed to add knowledge feedback: {e}")
