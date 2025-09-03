import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json

# LangChain imports (disabled due to ChromaDB compilation issues)
LANGCHAIN_AVAILABLE = False

# Simple text splitter for chunking
class SimpleTextSplitter:
    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def split_text(self, text):
        """Simple text splitter implementation"""
        chunks = []
        text_len = len(text)
        start = 0
        
        while start < text_len:
            end = start + self.chunk_size
            if end > text_len:
                end = text_len
            
            # Try to break at sentence boundary
            if end < text_len:
                sentence_end = text.rfind('.', start, end)
                if sentence_end > start + self.chunk_size // 2:
                    end = sentence_end + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - self.chunk_overlap
            if start < 0:
                start = 0
        
        return chunks

from django.conf import settings
from django.utils import timezone

from .memory_models import KnowledgeBase, UserMemory, VectorMemory
from .memory_service import MemoryService
from users.models import CustomUser

logger = logging.getLogger(__name__)

class RAGService:
    """Retrieval-Augmented Generation service for mental health knowledge"""
    
    def __init__(self):
        self.memory_service = MemoryService()
        self.text_splitter = SimpleTextSplitter(chunk_size=500, chunk_overlap=50)
    
    def initialize_knowledge_base(self):
        """Initialize the knowledge base with mental health information"""
        try:
            # Add basic mental health knowledge
            knowledge_items = self._get_default_knowledge()
            
            for item in knowledge_items:
                self._add_knowledge_item(**item)
            
            logger.info("Knowledge base initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize knowledge base: {e}")
    
    def _get_default_knowledge(self) -> List[Dict]:
        """Get default mental health knowledge items"""
        return [
            {
                'title': 'Understanding Anxiety Disorders',
                'content': '''Anxiety disorders are among the most common mental health conditions. They involve excessive fear or worry that interferes with daily activities. Common types include:

1. Generalized Anxiety Disorder (GAD): Persistent worry about various aspects of life
2. Panic Disorder: Recurring panic attacks with intense fear
3. Social Anxiety Disorder: Fear of social situations and judgment
4. Specific Phobias: Intense fear of specific objects or situations

Symptoms may include:
- Racing heart, sweating, trembling
- Difficulty concentrating
- Sleep problems
- Avoiding feared situations
- Muscle tension and fatigue

Treatment options include therapy (especially CBT), medication, and lifestyle changes like exercise and stress management.''',
                'knowledge_type': 'information',
                'topics': ['anxiety', 'disorders', 'symptoms', 'treatment'],
                'difficulty_level': 'beginner',
                'target_conditions': ['anxiety', 'generalized_anxiety', 'panic_disorder'],
                'source': 'Mental Health Professional Guidelines',
                'is_evidence_based': True,
                'effectiveness_rating': 8.5
            },
            {
                'title': 'Deep Breathing for Anxiety Relief',
                'content': '''Deep breathing is a simple but effective technique for managing anxiety:

**4-7-8 Breathing Technique:**
1. Exhale completely through your mouth
2. Close your mouth and inhale through nose for 4 counts
3. Hold your breath for 7 counts
4. Exhale through mouth for 8 counts
5. Repeat 3-4 times

**Box Breathing:**
1. Inhale for 4 counts
2. Hold for 4 counts
3. Exhale for 4 counts
4. Hold empty for 4 counts
5. Repeat 4-6 times

Benefits:
- Activates parasympathetic nervous system
- Reduces stress hormones
- Lowers heart rate and blood pressure
- Can be done anywhere, anytime

Practice regularly for best results, even when not anxious.''',
                'knowledge_type': 'technique',
                'topics': ['breathing', 'anxiety', 'coping', 'relaxation'],
                'difficulty_level': 'beginner',
                'target_conditions': ['anxiety', 'stress', 'panic'],
                'source': 'Evidence-Based Anxiety Treatment',
                'is_evidence_based': True,
                'effectiveness_rating': 9.0
            },
            {
                'title': 'Grounding Techniques for Crisis',
                'content': '''Grounding techniques help manage overwhelming emotions and anxiety:

**5-4-3-2-1 Technique:**
- 5 things you can see
- 4 things you can touch
- 3 things you can hear
- 2 things you can smell
- 1 thing you can taste

**Physical Grounding:**
- Hold an ice cube
- Splash cold water on face
- Do jumping jacks
- Progressive muscle relaxation

**Mental Grounding:**
- Count backwards from 100 by 7s
- Name animals A-Z
- Describe your surroundings in detail
- Recite a poem or song lyrics

**Emotional Grounding:**
- Say kind statements to yourself
- Think of people you care about
- Remember you are safe right now
- Use self-compassionate language

These techniques redirect focus from distressing thoughts to present moment awareness.''',
                'knowledge_type': 'technique',
                'topics': ['grounding', 'crisis', 'coping', 'mindfulness'],
                'difficulty_level': 'beginner',
                'target_conditions': ['anxiety', 'ptsd', 'panic', 'dissociation'],
                'source': 'Trauma-Informed Care Guidelines',
                'is_evidence_based': True,
                'effectiveness_rating': 8.8
            },
            {
                'title': 'Understanding Depression',
                'content': '''Depression is a mood disorder that causes persistent feelings of sadness and loss of interest. It affects how you feel, think, and behave.

**Major Symptoms:**
- Persistent sad, anxious, or empty mood
- Loss of interest in activities once enjoyed
- Significant weight loss or gain
- Sleep disturbances (insomnia or oversleeping)
- Fatigue or loss of energy
- Feelings of worthlessness or guilt
- Difficulty concentrating
- Thoughts of death or suicide

**Types of Depression:**
- Major Depressive Disorder
- Persistent Depressive Disorder (Dysthymia)
- Bipolar Disorder
- Seasonal Affective Disorder
- Postpartum Depression

**Treatment Approaches:**
- Psychotherapy (CBT, IPT, DBT)
- Medication (antidepressants)
- Lifestyle changes (exercise, diet, sleep)
- Support groups
- Light therapy (for seasonal depression)

Recovery is possible with proper treatment and support.''',
                'knowledge_type': 'information',
                'topics': ['depression', 'symptoms', 'treatment', 'types'],
                'difficulty_level': 'beginner',
                'target_conditions': ['depression', 'major_depression', 'dysthymia'],
                'source': 'American Psychological Association',
                'is_evidence_based': True,
                'effectiveness_rating': 8.7
            },
            {
                'title': 'Crisis Resources and Emergency Contacts',
                'content': '''If you're experiencing a mental health crisis, immediate help is available:

**Emergency Services:**
- Call 911 for immediate danger
- Go to nearest emergency room
- Call local crisis intervention team

**24/7 Crisis Hotlines:**
- National Suicide Prevention Lifeline: 988
- Crisis Text Line: Text HOME to 741741
- NAMI Helpline: 1-800-950-NAMI (6264)
- SAMHSA National Helpline: 1-800-662-4357

**Online Resources:**
- Crisis Chat: suicidepreventionlifeline.org
- NAMI.org for mental health information
- MentalHealth.gov for resources

**Signs You Need Immediate Help:**
- Thoughts of suicide or self-harm
- Plans to hurt yourself or others
- Severe depression with hopelessness
- Psychotic symptoms (hallucinations, delusions)
- Extreme agitation or violence

**Safety Planning:**
- Remove access to lethal means
- Contact emergency services
- Reach out to trusted friends/family
- Go to safe environment
- Use coping skills while seeking help

Remember: Crisis is temporary, help is available, and recovery is possible.''',
                'knowledge_type': 'crisis_response',
                'topics': ['crisis', 'emergency', 'suicide', 'resources', 'safety'],
                'difficulty_level': 'beginner',
                'target_conditions': ['crisis', 'suicide', 'emergency'],
                'source': 'National Crisis Prevention Guidelines',
                'is_evidence_based': True,
                'effectiveness_rating': 10.0
            },
            {
                'title': 'Mindfulness and Meditation for Mental Health',
                'content': '''Mindfulness is the practice of paying attention to the present moment without judgment.

**Benefits for Mental Health:**
- Reduces anxiety and depression symptoms
- Improves emotional regulation
- Increases self-awareness
- Reduces rumination and worry
- Improves focus and concentration

**Simple Mindfulness Exercises:**

**Mindful Breathing:**
1. Sit comfortably with eyes closed
2. Focus on your breath
3. Notice inhales and exhales
4. When mind wanders, gently return to breath
5. Start with 5 minutes, gradually increase

**Body Scan:**
1. Lie down comfortably
2. Starting with toes, notice sensations
3. Slowly move attention up through body
4. Don't try to change anything, just notice
5. Complete scan from head to toe

**Mindful Walking:**
1. Walk slowly and deliberately
2. Notice each step and foot placement
3. Pay attention to sensations of walking
4. If mind wanders, return to walking

**Daily Mindfulness:**
- Mindful eating (taste, texture, smell)
- Mindful listening (really hear sounds)
- Mindful observation (colors, shapes, details)

Regular practice increases benefits over time.''',
                'knowledge_type': 'technique',
                'topics': ['mindfulness', 'meditation', 'anxiety', 'depression', 'stress'],
                'difficulty_level': 'beginner',
                'target_conditions': ['anxiety', 'depression', 'stress', 'adhd'],
                'source': 'Mindfulness-Based Stress Reduction Research',
                'is_evidence_based': True,
                'effectiveness_rating': 8.9
            }
        ]
    
    def _add_knowledge_item(self, title: str, content: str, knowledge_type: str,
                          topics: List[str], difficulty_level: str = 'beginner',
                          target_conditions: List[str] = None, source: str = '',
                          is_evidence_based: bool = True, effectiveness_rating: float = 0.0):
        """Add a knowledge item to the database and vector store"""
        try:
            # Check if knowledge item already exists
            existing = KnowledgeBase.objects.filter(title=title).first()
            if existing:
                logger.info(f"Knowledge item '{title}' already exists, skipping")
                return existing
            
            # Create knowledge base entry
            knowledge_item = KnowledgeBase.objects.create(
                title=title,
                content=content,
                knowledge_type=knowledge_type,
                topics=topics,
                difficulty_level=difficulty_level,
                target_conditions=target_conditions or [],
                source=source,
                is_evidence_based=is_evidence_based,
                effectiveness_rating=effectiveness_rating
            )
            
            # Store in vector database for RAG
            if self.memory_service.embedding_model and self.memory_service.vector_db:
                try:
                    # Split content into chunks for better retrieval
                    if self.text_splitter:
                        chunks = self.text_splitter.split_text(content)
                    else:
                        chunks = [content]
                    
                    for i, chunk in enumerate(chunks):
                        vector_id = self.memory_service._store_vector_embedding(
                            content=chunk,
                            content_type='document',
                            content_id=f"{knowledge_item.id}_{i}",
                            metadata={
                                'title': title,
                                'knowledge_type': knowledge_type,
                                'topics': topics,
                                'difficulty_level': difficulty_level,
                                'target_conditions': target_conditions or [],
                                'effectiveness_rating': effectiveness_rating,
                                'chunk_index': i,
                                'total_chunks': len(chunks)
                            }
                        )
                        
                        if i == 0:  # Store first chunk's ID as primary reference
                            knowledge_item.vector_id = vector_id
                            knowledge_item.save()
                
                except Exception as e:
                    logger.error(f"Failed to create vector embedding for knowledge item: {e}")
            
            logger.info(f"Added knowledge item: {title}")
            return knowledge_item
            
        except Exception as e:
            logger.error(f"Failed to add knowledge item '{title}': {e}")
            return None
    
    def retrieve_relevant_knowledge(self, query: str, user: CustomUser = None,
                                  topics: List[str] = None, knowledge_types: List[str] = None,
                                  max_results: int = 3) -> List[Dict[str, Any]]:
        """Retrieve relevant knowledge for a given query"""
        try:
            results = []
            
            # Vector search in global knowledge base
            if self.memory_service.vector_db and self.memory_service.embedding_model:
                vector_results = self._search_knowledge_vectors(
                    query=query,
                    topics=topics,
                    knowledge_types=knowledge_types,
                    limit=max_results
                )
                results.extend(vector_results)
            
            # Fallback to database search
            if len(results) < max_results:
                db_results = self._search_knowledge_database(
                    query=query,
                    topics=topics,
                    knowledge_types=knowledge_types,
                    limit=max_results - len(results)
                )
                results.extend(db_results)
            
            # Add user-specific context if available
            if user:
                user_memories = self.memory_service.retrieve_relevant_memories(
                    user=user,
                    query=query,
                    limit=2
                )
                
                for memory in user_memories:
                    results.append({
                        'content': memory.content,
                        'source': 'user_memory',
                        'relevance_score': 0.9,  # High relevance for user's own context
                        'metadata': {
                            'memory_type': memory.memory_type,
                            'importance': memory.importance,
                            'created_at': memory.created_at.isoformat()
                        }
                    })
            
            # Sort by relevance score
            results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            return results[:max_results]
            
        except Exception as e:
            logger.error(f"Failed to retrieve relevant knowledge: {e}")
            return []
    
    def _search_knowledge_vectors(self, query: str, topics: List[str] = None,
                                knowledge_types: List[str] = None, limit: int = 3) -> List[Dict]:
        """Search vector database for relevant knowledge"""
        if not self.memory_service.vector_db or not self.memory_service.embedding_model:
            return []
        
        try:
            # Get query embedding
            query_embedding = self.memory_service.embedding_model.encode([query])[0].tolist()
            
            # Search in global knowledge collection
            collection_name = "global_knowledge"
            try:
                collection = self.memory_service.vector_db.get_collection(collection_name)
                
                # Build where clause for filtering
                where_clause = {"content_type": "document"}
                if knowledge_types:
                    where_clause["knowledge_type"] = {"$in": knowledge_types}
                
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where=where_clause
                )
                
                # Format results
                formatted_results = []
                if results['documents']:
                    for i, doc in enumerate(results['documents'][0]):
                        metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                        
                        # Filter by topics if specified
                        if topics:
                            doc_topics = metadata.get('topics', [])
                            if not any(topic in doc_topics for topic in topics):
                                continue
                        
                        formatted_results.append({
                            'content': doc,
                            'source': 'knowledge_base',
                            'relevance_score': 1 - results['distances'][0][i],
                            'metadata': metadata
                        })
                
                return formatted_results
                
            except Exception:
                # Collection doesn't exist yet
                return []
                
        except Exception as e:
            logger.error(f"Vector knowledge search failed: {e}")
            return []
    
    def _search_knowledge_database(self, query: str, topics: List[str] = None,
                                 knowledge_types: List[str] = None, limit: int = 3) -> List[Dict]:
        """Fallback database search for knowledge"""
        try:
            from django.db.models import Q
            
            # Build query
            db_query = Q(is_active=True)
            
            if knowledge_types:
                db_query &= Q(knowledge_type__in=knowledge_types)
            
            if topics:
                topic_query = Q()
                for topic in topics:
                    topic_query |= Q(topics__contains=topic)
                db_query &= topic_query
            
            # Simple text search
            if query:
                search_terms = query.split()[:3]  # Limit to first 3 terms
                for term in search_terms:
                    db_query &= (Q(title__icontains=term) | Q(content__icontains=term))
            
            knowledge_items = KnowledgeBase.objects.filter(db_query).order_by(
                '-effectiveness_rating', '-usage_count'
            )[:limit]
            
            results = []
            for item in knowledge_items:
                results.append({
                    'content': item.content,
                    'source': 'knowledge_base',
                    'relevance_score': item.effectiveness_rating / 10.0,
                    'metadata': {
                        'title': item.title,
                        'knowledge_type': item.knowledge_type,
                        'topics': item.topics,
                        'difficulty_level': item.difficulty_level,
                        'effectiveness_rating': item.effectiveness_rating
                    }
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Database knowledge search failed: {e}")
            return []
    
    def generate_contextual_response(self, user_query: str, user: CustomUser = None,
                                   context: Dict = None) -> Dict[str, Any]:
        """Generate a response using RAG with relevant knowledge and user context"""
        try:
            # Retrieve relevant knowledge
            relevant_knowledge = self.retrieve_relevant_knowledge(
                query=user_query,
                user=user,
                max_results=3
            )
            
            # Get user personalization profile
            user_profile = None
            if user:
                user_profile = self.memory_service.get_personalization_profile(user)
            
            # Analyze query for crisis indicators
            from .ai_support import detect_crisis_keywords, analyze_sentiment, check_message_urgency
            
            crisis_keywords = detect_crisis_keywords(user_query)
            sentiment = analyze_sentiment(user_query)
            urgency = check_message_urgency(user_query)
            
            # Build context for response generation
            response_context = {
                'user_query': user_query,
                'relevant_knowledge': relevant_knowledge,
                'crisis_detected': bool(crisis_keywords),
                'crisis_keywords': crisis_keywords,
                'sentiment': sentiment,
                'urgency_level': urgency,
                'user_profile': {
                    'preferred_tone': user_profile.preferred_tone if user_profile else 'supportive',
                    'response_length': user_profile.response_length if user_profile else 'medium',
                    'crisis_sensitivity': user_profile.crisis_sensitivity if user_profile else 'high',
                    'effective_strategies': user_profile.effective_strategies if user_profile else [],
                    'trigger_patterns': user_profile.trigger_patterns if user_profile else []
                } if user_profile else None,
                'context': context or {}
            }
            
            # Generate response using enhanced logic
            response = self._generate_enhanced_response(response_context)
            
            # Track knowledge usage
            for knowledge_item in relevant_knowledge:
                if knowledge_item['source'] == 'knowledge_base':
                    self._track_knowledge_usage(knowledge_item, user_query)
            
            return {
                'response': response,
                'context': response_context,
                'knowledge_used': relevant_knowledge,
                'crisis_detected': bool(crisis_keywords),
                'urgency_level': urgency
            }
            
        except Exception as e:
            logger.error(f"Failed to generate contextual response: {e}")
            return {
                'response': "I'm here to help you. Could you tell me more about what you're experiencing?",
                'context': {},
                'knowledge_used': [],
                'crisis_detected': False,
                'urgency_level': 'low'
            }
    
    def _generate_enhanced_response(self, context: Dict) -> str:
        """Generate enhanced response using context and knowledge with Gemini AI"""
        try:
            user_query = context['user_query']
            relevant_knowledge = context['relevant_knowledge']
            crisis_detected = context['crisis_detected']
            urgency_level = context['urgency_level']
            user_profile = context.get('user_profile', {})
            
            # Handle crisis situations first
            if crisis_detected or urgency_level in ['high', 'critical']:
                return self._generate_crisis_response(context)
            
            # Detect different types of queries
            informational_keywords = [
                'list', 'what are', 'tell me about', 'explain', 'describe', 'causes of',
                'symptoms of', 'types of', 'examples of', 'how to', 'ways to', 'methods',
                'techniques', 'strategies for', 'signs of', 'reasons for', 'factors',
                'what causes', 'why do', 'what is', 'define', 'difference between'
            ]
            
            memory_query_keywords = [
                'what do you know', 'tell me about me', 'remember about me', 
                'what do you remember', 'my information', 'about me', 'know about me'
            ]
            
            is_informational_query = any(keyword in user_query.lower() for keyword in informational_keywords)
            is_memory_query = any(keyword in user_query.lower() for keyword in memory_query_keywords)
            
            # Handle memory queries (asking about themselves)
            if is_memory_query:
                return self._generate_memory_response(user_query, relevant_knowledge, user_profile)
            
            # Handle informational queries with direct knowledge-based responses
            if is_informational_query and relevant_knowledge:
                return self._generate_informational_response(user_query, relevant_knowledge)
            
            # For emotional support or non-informational queries, use Gemini AI
            try:
                from .ai_support import generate_gemini_response
                
                gemini_response = generate_gemini_response(
                    message=user_query,
                    user_context=user_profile,
                    relevant_knowledge=relevant_knowledge,
                    crisis_detected=crisis_detected
                )
                
                # If Gemini provides a good response, use it
                if gemini_response and len(gemini_response.strip()) > 20:
                    return gemini_response
                    
            except Exception as e:
                logger.error(f"Gemini response generation failed in RAG: {e}")
            
            # Fallback to template-based response if Gemini fails
            response_parts = []
            
            # Acknowledgment based on sentiment
            sentiment = context.get('sentiment', {})
            if sentiment.get('sentiment') == 'negative':
                response_parts.append("I can hear that you're going through a difficult time right now. 💙")
            elif sentiment.get('sentiment') == 'positive':
                response_parts.append("I'm glad to hear from you! 😊")
            else:
                response_parts.append("Thank you for reaching out. I'm here to support you.")
            
            # Add relevant knowledge-based information
            if relevant_knowledge:
                knowledge_content = []
                for item in relevant_knowledge[:2]:  # Use top 2 most relevant
                    if item['source'] == 'knowledge_base':
                        # Extract key points from knowledge content
                        content = item['content']
                        if len(content) > 300:
                            # Summarize or extract key points
                            lines = content.split('\n')
                            key_lines = [line for line in lines if any(keyword in line.lower() 
                                       for keyword in ['technique', 'strategy', 'help', 'benefit', 'step'])][:3]
                            if key_lines:
                                knowledge_content.extend(key_lines)
                        else:
                            knowledge_content.append(content)
                
                if knowledge_content:
                    response_parts.append("\n\nHere are some strategies that might help:")
                    for i, content in enumerate(knowledge_content[:3], 1):
                        response_parts.append(f"\n{i}. {content.strip()}")
            
            # Add personalized suggestions based on user profile
            if user_profile and user_profile.get('effective_strategies'):
                effective_strategies = user_profile['effective_strategies']
                if effective_strategies:
                    response_parts.append(f"\n\nBased on what has worked for you before, you might try: {', '.join(effective_strategies[:2])}")
            
            # Add supportive closing
            tone = user_profile.get('preferred_tone', 'supportive') if user_profile else 'supportive'
            
            if tone == 'professional':
                response_parts.append("\n\nWould you like to explore any of these approaches further?")
            elif tone == 'casual':
                response_parts.append("\n\nWhat do you think? Does any of this resonate with you?")
            else:  # supportive
                response_parts.append("\n\nRemember, you're not alone in this. What feels most helpful to you right now?")
            
            return "".join(response_parts)
            
        except Exception as e:
            logger.error(f"Failed to generate enhanced response: {e}")
            return "I'm here to support you. Could you tell me more about what you're experiencing?"
    
    def _generate_informational_response(self, user_query: str, relevant_knowledge: List[Dict]) -> str:
        """Generate a comprehensive informational response using retrieved knowledge"""
        try:
            response_parts = []
            
            # Determine what type of information is being requested
            query_lower = user_query.lower()
            
            if any(keyword in query_lower for keyword in ['causes of anxiety', 'issues that cause anxiety', 'what causes anxiety']):
                response_parts.append("**Common Issues That Cause Anxiety:**\n")
                
                # Extract causes/triggers from knowledge base
                anxiety_causes = [
                    "**Life Events & Stressors:**",
                    "• Work-related stress and job pressure",
                    "• Financial difficulties or instability", 
                    "• Relationship problems or conflicts",
                    "• Major life changes (moving, job loss, divorce)",
                    "• Academic pressure and performance anxiety",
                    "• Health problems or medical conditions",
                    "",
                    "**Psychological Factors:**",
                    "• Perfectionism and unrealistic expectations",
                    "• Negative thought patterns and catastrophic thinking",
                    "• Past traumatic experiences or PTSD",
                    "• Low self-esteem and self-doubt",
                    "• Fear of judgment or social rejection",
                    "",
                    "**Biological & Medical Factors:**",
                    "• Genetics and family history of anxiety",
                    "• Hormonal changes (pregnancy, menopause)",
                    "• Thyroid disorders or other medical conditions",
                    "• Caffeine, alcohol, or substance use",
                    "• Medication side effects",
                    "• Sleep deprivation and fatigue",
                    "",
                    "**Environmental Triggers:**",
                    "• Stressful work or home environment",
                    "• Social media and comparison culture",
                    "• News consumption and world events",
                    "• Isolation and lack of social support",
                    "• Overstimulation and sensory overload"
                ]
                response_parts.extend(anxiety_causes)
                
            elif any(keyword in query_lower for keyword in ['symptoms of anxiety', 'signs of anxiety']):
                response_parts.append("**Common Anxiety Symptoms:**\n")
                response_parts.extend([
                    "**Physical Symptoms:**",
                    "• Racing heart or palpitations",
                    "• Sweating and trembling",
                    "• Shortness of breath or hyperventilation",
                    "• Muscle tension and headaches",
                    "• Nausea or stomach problems",
                    "• Fatigue and sleep disturbances",
                    "",
                    "**Emotional Symptoms:**",
                    "• Persistent worry and fear",
                    "• Feeling overwhelmed or out of control",
                    "• Irritability and restlessness",
                    "• Difficulty concentrating",
                    "• Avoidance of feared situations"
                ])
                
            elif any(keyword in query_lower for keyword in ['types of anxiety', 'anxiety disorders']):
                response_parts.append("**Types of Anxiety Disorders:**\n")
                response_parts.extend([
                    "• **Generalized Anxiety Disorder (GAD)** - Persistent worry about various life aspects",
                    "• **Panic Disorder** - Recurring panic attacks with intense fear",
                    "• **Social Anxiety Disorder** - Fear of social situations and judgment",
                    "• **Specific Phobias** - Intense fear of specific objects or situations",
                    "• **Agoraphobia** - Fear of being in situations where escape might be difficult",
                    "• **Separation Anxiety** - Fear of being separated from loved ones"
                ])
                
            else:
                # General anxiety information
                response_parts.append("**Understanding Anxiety:**\n")
                
            # Add relevant knowledge from database if available
            for item in relevant_knowledge[:2]:
                if item['source'] == 'knowledge_base':
                    content = item['content']
                    metadata = item.get('metadata', {})
                    title = metadata.get('title', '')
                    
                    # Extract structured information from content
                    if 'anxiety' in title.lower() and any(keyword in query_lower for keyword in ['causes', 'issues', 'what causes']):
                        # Look for causes/factors in the content
                        lines = content.split('\n')
                        for line in lines:
                            line = line.strip()
                            if any(indicator in line.lower() for indicator in ['cause', 'factor', 'trigger', 'due to', 'result from']):
                                if line and not line.startswith('#') and not line.startswith('**'):
                                    response_parts.append(f"• {line}")
            
            # Add helpful closing
            response_parts.extend([
                "\n**Remember:**",
                "• Anxiety is treatable with proper support and strategies",
                "• Professional help is available if anxiety interferes with daily life",
                "• Combining therapy, lifestyle changes, and sometimes medication can be very effective",
                "\nIf you're experiencing severe anxiety, consider speaking with a mental health professional for personalized guidance."
            ])
            
            return "\n".join(response_parts)
            
        except Exception as e:
            logger.error(f"Failed to generate informational response: {e}")
            return "I have comprehensive information about anxiety causes and symptoms. Could you be more specific about what aspect you'd like to know more about?"
    
    def _generate_memory_response(self, user_query: str, relevant_knowledge: List[Dict], user_profile: Dict = None) -> str:
        """Generate a response based on stored user memories"""
        try:
            user_memories = [item for item in relevant_knowledge if item['source'] == 'user_memory']
            
            if not user_memories:
                return "I don't have any specific information about you stored from our previous conversations. Feel free to share anything you'd like me to know about you!"
            
            response_parts = ["Based on what you've shared with me:"]
            
            # Extract different types of information
            personal_info = []
            preferences = []
            mood_patterns = []
            other_context = []
            
            for memory in user_memories:
                content = memory['content']
                memory_type = memory.get('metadata', {}).get('memory_type', 'general')
                
                if memory_type == 'personal_info':
                    personal_info.append(content)
                elif memory_type == 'preference':
                    preferences.append(content)
                elif memory_type == 'mood_pattern':
                    mood_patterns.append(content)
                else:
                    other_context.append(content)
            
            # Add personal information
            if personal_info:
                response_parts.append("\n**About You:**")
                for info in personal_info:
                    # Clean up the content to make it more natural
                    if info.startswith("Personal context:"):
                        info = info.replace("Personal context:", "").strip()
                    elif info.startswith("User's name:") or info.startswith("User introduced"):
                        # Extract key details more naturally
                        if "name:" in info and "age:" in info and "occupation:" in info:
                            # Parse structured info
                            parts = info.split(", ")
                            cleaned_parts = []
                            for part in parts:
                                if "name:" in part:
                                    name = part.split("name:")[-1].strip()
                                    cleaned_parts.append(f"Your name is {name}")
                                elif "age:" in part:
                                    age = part.split("age:")[-1].strip()
                                    cleaned_parts.append(f"you're {age} years old")
                                elif "occupation:" in part:
                                    job = part.split("occupation:")[-1].strip()
                                    cleaned_parts.append(f"you work as a {job}")
                                elif "company:" in part:
                                    company = part.split("company:")[-1].strip()
                                    cleaned_parts.append(f"at {company}")
                            
                            if cleaned_parts:
                                response_parts.append(f"• {', '.join(cleaned_parts)}")
                            else:
                                response_parts.append(f"• {info}")
                        else:
                            response_parts.append(f"• {info}")
                    else:
                        response_parts.append(f"• {info}")
            
            # Add preferences
            if preferences:
                response_parts.append("\n**Your Preferences:**")
                for pref in preferences:
                    if pref.startswith("User mentioned preferences/experiences:"):
                        pref = pref.replace("User mentioned preferences/experiences:", "").strip()
                    response_parts.append(f"• {pref}")
            
            # Add mood patterns if relevant
            if mood_patterns:
                response_parts.append("\n**Recent Mood Context:**")
                for mood in mood_patterns:
                    if mood.startswith("User mood:"):
                        mood = mood.replace("User mood:", "").strip()
                    response_parts.append(f"• {mood}")
            
            # Add other context
            if other_context:
                response_parts.append("\n**Additional Context:**")
                for context in other_context[:2]:  # Limit to avoid overwhelming
                    response_parts.append(f"• {context}")
            
            # Add supportive closing
            response_parts.append("\nIs there anything else you'd like me to know about you or anything you'd like to talk about? 😊")
            
            return "\n".join(response_parts)
            
        except Exception as e:
            logger.error(f"Failed to generate memory response: {e}")
            return "I'm having trouble accessing our conversation history right now, but I'm here to listen and support you. What would you like to talk about?"
    
    def _generate_crisis_response(self, context: Dict) -> str:
        """Generate specialized crisis response"""
        crisis_keywords = context.get('crisis_keywords', [])
        urgency_level = context.get('urgency_level', 'medium')
        
        # Import crisis responses from existing ai_support
        from .ai_support import CRISIS_RESPONSES, get_emergency_resources
        
        # Select appropriate crisis response
        if urgency_level == 'critical':
            response = CRISIS_RESPONSES[0]  # Most urgent response
        else:
            import random
            response = random.choice(CRISIS_RESPONSES)
        
        # Add specific crisis resources
        emergency_resources = get_emergency_resources()
        
        response += "\n\n**🆘 Immediate Resources:**"
        for resource in emergency_resources[:3]:
            response += f"\n• **{resource['name']}**: {resource['contact']} - {resource['description']}"
        
        return response
    
    def _track_knowledge_usage(self, knowledge_item: Dict, query: str):
        """Track usage of knowledge items for effectiveness measurement"""
        try:
            metadata = knowledge_item.get('metadata', {})
            title = metadata.get('title', '')
            
            if title:
                # Find and update the knowledge base item
                kb_item = KnowledgeBase.objects.filter(title=title).first()
                if kb_item:
                    kb_item.usage_count += 1
                    kb_item.save()
                    
        except Exception as e:
            logger.error(f"Failed to track knowledge usage: {e}")
    
    def add_user_feedback(self, knowledge_title: str, was_helpful: bool):
        """Add user feedback about knowledge effectiveness"""
        try:
            kb_item = KnowledgeBase.objects.filter(title=knowledge_title).first()
            if kb_item:
                if was_helpful:
                    kb_item.positive_feedback += 1
                else:
                    kb_item.negative_feedback += 1
                kb_item.save()
                logger.info(f"Added feedback for knowledge item: {knowledge_title}")
                
        except Exception as e:
            logger.error(f"Failed to add user feedback: {e}")
