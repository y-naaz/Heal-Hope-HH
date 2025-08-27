import re
import random
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

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
    
    # Check for high-risk keywords first
    for keyword in CRISIS_KEYWORDS['high_risk']:
        if keyword in text_lower:
            detected_keywords.append(keyword)
    
    # If no high-risk, check medium-risk
    if not detected_keywords:
        for keyword in CRISIS_KEYWORDS['medium_risk']:
            if keyword in text_lower:
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
