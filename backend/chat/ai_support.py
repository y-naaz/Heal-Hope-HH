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

# Import Google Generative AI
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

# Initialize Gemini AI client
gemini_model = None
if GEMINI_AVAILABLE and hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY:
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        logger.info("Gemini AI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini AI client: {e}")
        gemini_model = None

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
        {'name': 'National Suicide Prevention Lifeline', 'contact': '988', 'description': '24/7 crisis support'},
        {'name': 'Crisis Text Line', 'contact': 'Text HOME to 741741', 'description': 'Text-based crisis support'},
        {'name': 'SAMHSA National Helpline', 'contact': '1-800-662-4357', 'description': 'Mental health and substance abuse'},
        {'name': 'Emergency Services', 'contact': '911', 'description': 'Immediate emergency assistance'}
    ],
    'support': [
        {'name': 'Psychology Today', 'contact': 'psychologytoday.com', 'description': 'Find therapists in your area'},
        {'name': 'BetterHelp', 'contact': 'betterhelp.com', 'description': 'Online therapy platform'},
        {'name': 'NAMI', 'contact': 'nami.org', 'description': 'National Alliance on Mental Illness'},
        {'name': 'Mental Health America', 'contact': 'mhanational.org', 'description': 'Mental health resources and screening'}
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

def get_ai_response(message: str, is_crisis: bool = False, user_context: Dict = None) -> str:
    """Generate AI response based on message content and context."""
    try:
        # Analyze the message
        sentiment_analysis = analyze_sentiment(message)
        crisis_keywords = detect_crisis_keywords(message)
        
        # Determine response type
        if is_crisis or sentiment_analysis['sentiment'] == 'crisis' or crisis_keywords:
            # Crisis response
            response = random.choice(CRISIS_RESPONSES)
            
            # Add specific resources if keywords detected
            if crisis_keywords:
                response += f"\n\n*I noticed you mentioned: {', '.join(crisis_keywords[:3])}. These feelings are serious, and I want to make sure you get the help you deserve.*"
            
            return response
        
        elif sentiment_analysis['sentiment'] in ['negative', 'slightly_negative']:
            # Supportive response for negative sentiment
            response = random.choice(SUPPORTIVE_RESPONSES)
            
            # Add specific coping strategies based on detected issues
            if 'anxious' in message.lower() or 'anxiety' in message.lower():
                strategy = get_coping_strategy('anxiety')
                response += f"\n\n**For anxiety specifically:** {strategy}"
            elif 'depressed' in message.lower() or 'depression' in message.lower():
                strategy = get_coping_strategy('depression')
                response += f"\n\n**For depression specifically:** {strategy}"
            elif 'stressed' in message.lower() or 'stress' in message.lower():
                strategy = get_coping_strategy('stress')
                response += f"\n\n**For stress specifically:** {strategy}"
            elif 'angry' in message.lower() or 'anger' in message.lower():
                strategy = get_coping_strategy('anger')
                response += f"\n\n**For anger specifically:** {strategy}"
            
            return response
        
        elif sentiment_analysis['sentiment'] == 'positive':
            # Positive reinforcement
            responses = [
                "I'm so glad to hear you're feeling better! It's wonderful when we can recognize and appreciate the good moments. 😊",
                "That's fantastic! Celebrating positive moments is really important for our mental health. What's contributing to these good feelings?",
                "I love hearing positive updates! These moments remind us that feelings do change and that there's hope even in difficult times."
            ]
            return random.choice(responses)
        
        else:
            # Neutral/general response
            responses = [
                "Thank you for sharing that with me. How are you feeling overall today?",
                "I'm here to listen. Is there anything specific you'd like to talk about or any way I can support you?",
                "It sounds like you have a lot on your mind. Would you like to explore any of these feelings together?"
            ]
            
            response = random.choice(responses)
            
            # Add context-based suggestions if available
            if user_context:
                if user_context.get('crisis_level') in ['medium', 'high']:
                    response += "\n\nI see from your profile that you've been going through a challenging time. Remember that support is always available."
                
                recent_moods = user_context.get('recent_moods', [])
                if recent_moods:
                    avg_mood = sum(mood['level'] for mood in recent_moods) / len(recent_moods)
                    if avg_mood < 3:
                        response += "\n\nI noticed your mood has been lower recently. Would you like to talk about what's been affecting you?"
            
            return response
    
    except Exception as e:
        logger.error(f"Error generating AI response: {str(e)}")
        return "I'm here to listen and support you. How can I help you today?"

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
                           crisis_detected: bool = False) -> str:
    """Generate AI response using Google Gemini"""
    global gemini_model
    
    if not gemini_model or not GEMINI_AVAILABLE:
        # Fallback to template response
        return get_ai_response(message, crisis_detected, user_context)
    
    try:
        # Handle crisis situations with priority
        if crisis_detected:
            crisis_keywords = detect_crisis_keywords(message)
            prompt = f"""You are a compassionate mental health support AI. The user has expressed concerning content that suggests they may be in crisis.

CRITICAL: This user has mentioned: {', '.join(crisis_keywords[:3])}

Please provide an immediate, caring response that:
1. Acknowledges their pain with empathy
2. Provides immediate crisis resources (988 Suicide Prevention Lifeline, Crisis Text Line: Text HOME to 741741, Emergency: 911)
3. Encourages them to seek immediate help
4. Does NOT provide therapy or attempt to solve their problems
5. Keeps the response under 300 words

User message: "{message}"

Remember: Safety first, provide resources, encourage professional help."""

            response = gemini_model.generate_content(prompt)
            return response.text if response and response.text else random.choice(CRISIS_RESPONSES)
        
        # Detect if user is asking for specific information/lists
        informational_keywords = [
            'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
            'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
            'techniques', 'strategies for', 'signs of', 'reasons for', 'factors',
            'what causes', 'why do', 'what is', 'define', 'difference between'
        ]
        
        is_informational_query = any(keyword in message.lower() for keyword in informational_keywords)
        
        # Build context for non-crisis responses
        context_parts = []
        
        if user_context:
            if user_context.get('recent_memories'):
                memories = user_context['recent_memories'][:2]  # Limit to recent memories
                context_parts.append(f"User's recent context: {', '.join([m['content'][:50] + '...' for m in memories])}")
            
            if user_context.get('effective_strategies'):
                strategies = user_context['effective_strategies'][:3]
                context_parts.append(f"Strategies that have helped this user before: {', '.join(strategies)}")
            
            if user_context.get('preferred_tone'):
                context_parts.append(f"User prefers {user_context['preferred_tone']} communication style")
        
        # Add relevant knowledge
        knowledge_context = []
        if relevant_knowledge:
            for knowledge in relevant_knowledge[:2]:  # Use top 2 knowledge items
                if knowledge.get('source') == 'knowledge_base':
                    title = knowledge.get('metadata', {}).get('title', 'Mental Health Information')
                    content_preview = knowledge.get('content', '')[:200] + '...'
                    knowledge_context.append(f"{title}: {content_preview}")
        
        # Construct the main prompt based on query type
        if is_informational_query:
            # For informational queries, prioritize comprehensive answers
            prompt_parts = [
                "You are Hope, a knowledgeable mental health support AI assistant.",
                "",
                "The user is asking for specific information. Your role:",
                "- Provide accurate, comprehensive, and well-organized information",
                "- Answer the question directly and completely",
                "- Use bullet points or numbered lists when appropriate",
                "- Include practical examples and actionable advice",
                "- Maintain a helpful and professional tone",
                "- You may provide longer responses (up to 300 words) for informational content",
                "",
                "Guidelines:",
                "- Answer the specific question asked",
                "- Provide factual, evidence-based information",
                "- Organize information clearly (use lists, bullet points, or categories)",
                "- Include practical examples where relevant",
                "- Always mention when professional help is recommended",
                "- Do NOT deflect to emotional support when specific information is requested",
                ""
            ]
        else:
            # For emotional support, keep responses concise and supportive
            prompt_parts = [
                "You are Hope, a compassionate mental health support AI assistant.",
                "",
                "Your role:",
                "- Provide emotional support and validation",
                "- Share evidence-based coping strategies",
                "- Encourage professional help when appropriate",
                "- Maintain a warm, empathetic, and non-judgmental tone",
                "",
                "Guidelines:",
                "- You are NOT a therapist and cannot provide therapy or medical advice",
                "- Always prioritize user safety",
                "- Encourage professional help for serious mental health concerns",
                "- Keep responses between 50-80 words (2-3 sentences maximum)",
                "- Use supportive emojis sparingly and appropriately",
                "- Be concise but warm and empathetic",
                ""
            ]
        
        if context_parts:
            prompt_parts.extend([
                "User context:",
                *[f"- {context}" for context in context_parts],
                ""
            ])
        
        if knowledge_context:
            prompt_parts.extend([
                "Relevant mental health information:",
                *[f"- {knowledge}" for knowledge in knowledge_context],
                ""
            ])
        
        # Add specific instructions based on query type
        if is_informational_query:
            prompt_parts.append("The user is asking for specific information. Please provide a comprehensive, well-organized answer that directly addresses their question.")
        else:
            # Analyze sentiment for appropriate response tone
            sentiment = analyze_sentiment(message)
            if sentiment['sentiment'] in ['negative', 'slightly_negative']:
                prompt_parts.append("The user seems to be struggling. Please provide gentle support and practical coping strategies.")
            elif sentiment['sentiment'] == 'positive':
                prompt_parts.append("The user seems to be in a better mood. Reinforce their positive feelings while remaining supportive.")
            else:
                prompt_parts.append("Provide supportive guidance based on what the user has shared.")
        
        prompt_parts.extend([
            "",
            f'User message: "{message}"',
            "",
            "Please respond appropriately based on the type of question asked."
        ])
        
        prompt = "\n".join(prompt_parts)
        
        # Generate response with Gemini
        response = gemini_model.generate_content(prompt)
        
        if response and response.text:
            generated_text = response.text.strip()
            
            # Safety check - if response seems inappropriate, use fallback
            if len(generated_text) < 20 or 'I cannot' in generated_text:
                return get_ai_response(message, crisis_detected, user_context)
            
            return generated_text
        else:
            # Fallback if no response generated
            return get_ai_response(message, crisis_detected, user_context)
    
    except Exception as e:
        logger.error(f"Gemini AI response generation failed: {e}")
        # Fallback to template response
        return get_ai_response(message, crisis_detected, user_context)

# Enhanced AI functions with memory and RAG

def get_enhanced_ai_response(message: str, user: CustomUser = None, 
                           room: ChatRoom = None, message_obj: Message = None) -> Dict[str, Any]:
    """
    Get enhanced AI response using memory, RAG, and personalization.
    This is the main function for generating intelligent responses.
    """
    if not ENHANCED_AI_AVAILABLE:
        # Fallback to basic response
        return {
            'response': get_ai_response(message),
            'memory_used': [],
            'knowledge_used': [],
            'crisis_detected': detect_crisis_keywords(message) != [],
            'personalized': False
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
