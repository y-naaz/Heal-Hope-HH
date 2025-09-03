import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import uuid

# Mem0 imports
try:
    from mem0 import Memory
    MEM0_AVAILABLE = True
except ImportError:
    MEM0_AVAILABLE = False
    Memory = None

# Vector database imports (ChromaDB disabled due to compilation issues)
CHROMA_AVAILABLE = False
chromadb = None

# OpenAI and embeddings
try:
    import openai
    from sentence_transformers import SentenceTransformer
    EMBEDDING_AVAILABLE = True
except ImportError:
    EMBEDDING_AVAILABLE = False
    openai = None
    SentenceTransformer = None

from django.conf import settings
from django.utils import timezone
from django.db.models import Q

from .memory_models import (
    UserMemory, ConversationMemory, VectorMemory, 
    KnowledgeBase, MemoryInteraction, PersonalizationProfile
)
from .models import Message, ChatRoom
from users.models import CustomUser

logger = logging.getLogger(__name__)

class MemoryService:
    """Enhanced memory service integrating Mem0, vector databases, and personalization"""
    
    def __init__(self):
        self.mem0_client = None
        self.vector_db = None
        self.embedding_model = None
        
        # Initialize Mem0 if available
        if MEM0_AVAILABLE and hasattr(settings, 'MEM0_API_KEY'):
            try:
                self.mem0_client = Memory(api_key=settings.MEM0_API_KEY)
                logger.info("Mem0 client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Mem0: {e}")
        
        # Initialize vector database
        self._init_vector_db()
        
        # Initialize embedding model
        self._init_embedding_model()
    
    def _init_vector_db(self):
        """Initialize vector database (ChromaDB)"""
        if not CHROMA_AVAILABLE:
            logger.warning("ChromaDB not available")
            return
        
        try:
            vector_db_path = getattr(settings, 'VECTOR_DB_PATH', './vector_db')
            self.vector_db = chromadb.PersistentClient(path=vector_db_path)
            logger.info("Vector database initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize vector database: {e}")
    
    def _init_embedding_model(self):
        """Initialize embedding model"""
        if not EMBEDDING_AVAILABLE:
            logger.warning("Embedding model not available")
            return
        
        try:
            # Use a lightweight model for fast embeddings
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
    
    def store_user_memory(self, user: CustomUser, content: str, memory_type: str, 
                         context: Dict = None, importance: str = 'medium',
                         source_message: Message = None) -> UserMemory:
        """Store a new user memory with vector embedding"""
        try:
            # Create database record
            memory = UserMemory.objects.create(
                user=user,
                content=content,
                memory_type=memory_type,
                context=context or {},
                importance=importance,
                source_message=source_message,
                session_id=self._get_session_id(user)
            )
            
            # Store in Mem0 if available
            if self.mem0_client:
                try:
                    mem0_data = {
                        "messages": [{"role": "user", "content": content}],
                        "user_id": str(user.id),
                        "metadata": {
                            "memory_type": memory_type,
                            "importance": importance,
                            "context": context or {},
                            "db_id": memory.id
                        }
                    }
                    mem0_result = self.mem0_client.add(**mem0_data)
                    memory.embedding_id = str(mem0_result.get('id', ''))
                except Exception as e:
                    logger.error(f"Failed to store in Mem0: {e}")
            
            # Store vector embedding
            if self.embedding_model and self.vector_db:
                try:
                    embedding_id = self._store_vector_embedding(
                        content=content,
                        content_type='memory',
                        content_id=str(memory.id),
                        user=user,
                        metadata={
                            'memory_type': memory_type,
                            'importance': importance,
                            'created_at': memory.created_at.isoformat()
                        }
                    )
                    if not memory.embedding_id:
                        memory.embedding_id = embedding_id
                except Exception as e:
                    logger.error(f"Failed to store vector embedding: {e}")
            
            memory.save()
            logger.info(f"Stored memory for user {user.id}: {content[:50]}...")
            return memory
            
        except Exception as e:
            logger.error(f"Failed to store user memory: {e}")
            raise
    
    def retrieve_relevant_memories(self, user: CustomUser, query: str, 
                                 memory_types: List[str] = None, 
                                 limit: int = 5) -> List[UserMemory]:
        """Retrieve relevant memories using vector similarity"""
        try:
            relevant_memories = []
            
            # Try vector search first
            if self.vector_db and self.embedding_model:
                vector_results = self._search_vector_memories(
                    query=query,
                    user=user,
                    content_type='memory',
                    limit=limit
                )
                
                # Convert vector results to UserMemory objects
                for result in vector_results:
                    try:
                        memory_id = result.get('metadata', {}).get('content_id')
                        if memory_id:
                            memory = UserMemory.objects.get(id=memory_id, user=user, is_active=True)
                            memory.increment_access()
                            relevant_memories.append(memory)
                    except UserMemory.DoesNotExist:
                        continue
            
            # Fallback to database search if vector search didn't find enough
            if len(relevant_memories) < limit:
                db_query = Q(user=user, is_active=True)
                if memory_types:
                    db_query &= Q(memory_type__in=memory_types)
                
                # Improved semantic search for common queries
                query_lower = query.lower()
                if any(phrase in query_lower for phrase in [
                    'what do you know', 'tell me about me', 'remember about me', 
                    'what do you remember', 'my information', 'about me'
                ]):
                    # For "what do you know about me" type queries, return recent personal info
                    db_query &= Q(memory_type__in=['personal_info', 'preference', 'mood_pattern'])
                elif any(keyword in query_lower for keyword in [
                    'anxiety', 'depression', 'stress', 'sad', 'happy', 'mood'
                ]):
                    # For mood/mental health queries, prioritize relevant memories
                    db_query &= Q(memory_type__in=['mood_pattern', 'trigger', 'preference'])
                else:
                    # General search across content for any keywords
                    search_terms = [term for term in query.split() if len(term) > 2]
                    if search_terms:
                        content_query = Q()
                        for term in search_terms[:3]:  # Use first 3 meaningful terms
                            content_query |= Q(content__icontains=term)
                        db_query &= content_query
                
                db_memories = UserMemory.objects.filter(db_query).exclude(
                    id__in=[m.id for m in relevant_memories]
                ).order_by('-importance', '-created_at')[:limit - len(relevant_memories)]
                
                relevant_memories.extend(db_memories)
            
            # Sort by importance and access count
            relevant_memories.sort(
                key=lambda x: (
                    {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}[x.importance],
                    x.access_count
                ),
                reverse=True
            )
            
            return relevant_memories[:limit]
            
        except Exception as e:
            logger.error(f"Failed to retrieve relevant memories: {e}")
            return []
    
    def _search_vector_memories(self, query: str, user: CustomUser, 
                              content_type: str = None, limit: int = 5) -> List[Dict]:
        """Search vector database for similar content"""
        if not self.vector_db or not self.embedding_model:
            return []
        
        try:
            # Get query embedding
            query_embedding = self.embedding_model.encode([query])[0].tolist()
            
            # Search in user-specific collection
            collection_name = f"user_{user.id}_memories"
            try:
                collection = self.vector_db.get_collection(collection_name)
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where={"content_type": content_type} if content_type else None
                )
                
                # Format results
                formatted_results = []
                if results['documents']:
                    for i, doc in enumerate(results['documents'][0]):
                        formatted_results.append({
                            'content': doc,
                            'score': 1 - results['distances'][0][i],  # Convert distance to similarity
                            'metadata': results['metadatas'][0][i] if results['metadatas'] else {}
                        })
                
                return formatted_results
            except Exception:
                # Collection doesn't exist yet
                return []
                
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
    
    def _store_vector_embedding(self, content: str, content_type: str, content_id: str,
                              user: CustomUser = None, metadata: Dict = None) -> str:
        """Store content embedding in vector database"""
        if not self.vector_db or not self.embedding_model:
            return ""
        
        try:
            # Generate embedding
            embedding = self.embedding_model.encode([content])[0].tolist()
            
            # Determine collection name
            if user:
                collection_name = f"user_{user.id}_memories"
            else:
                collection_name = "global_knowledge"
            
            # Get or create collection
            try:
                collection = self.vector_db.get_collection(collection_name)
            except Exception:
                collection = self.vector_db.create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"}
                )
            
            # Generate unique ID
            vector_id = str(uuid.uuid4())
            
            # Prepare metadata
            vector_metadata = {
                "content_type": content_type,
                "content_id": content_id,
                "created_at": datetime.now().isoformat()
            }
            if metadata:
                vector_metadata.update(metadata)
            if user:
                vector_metadata["user_id"] = str(user.id)
            
            # Add to collection
            collection.add(
                ids=[vector_id],
                embeddings=[embedding],
                documents=[content],
                metadatas=[vector_metadata]
            )
            
            # Store reference in database
            VectorMemory.objects.create(
                content_type=content_type,
                content_id=content_id,
                content_text=content,
                vector_id=vector_id,
                collection_name=collection_name,
                user=user,
                metadata=vector_metadata
            )
            
            return vector_id
            
        except Exception as e:
            logger.error(f"Failed to store vector embedding: {e}")
            return ""
    
    def update_conversation_memory(self, user: CustomUser, room: ChatRoom, 
                                 summary: str, key_topics: List[str],
                                 emotional_state: Dict, concerns: List[str]) -> ConversationMemory:
        """Update or create conversation memory"""
        try:
            # Get or create conversation memory for current session
            conversation_memory, created = ConversationMemory.objects.get_or_create(
                user=user,
                room=room,
                end_time__isnull=True,  # Current active conversation
                defaults={
                    'summary': summary,
                    'key_topics': key_topics,
                    'emotional_state': emotional_state,
                    'mentioned_concerns': concerns,
                    'start_time': timezone.now(),
                    'message_count': 0
                }
            )
            
            if not created:
                # Update existing conversation memory
                conversation_memory.summary = summary
                conversation_memory.key_topics = list(set(conversation_memory.key_topics + key_topics))
                conversation_memory.emotional_state.update(emotional_state)
                conversation_memory.mentioned_concerns = list(
                    set(conversation_memory.mentioned_concerns + concerns)
                )
                conversation_memory.message_count += 1
                conversation_memory.save()
            
            return conversation_memory
            
        except Exception as e:
            logger.error(f"Failed to update conversation memory: {e}")
            raise
    
    def get_personalization_profile(self, user: CustomUser) -> PersonalizationProfile:
        """Get or create user's personalization profile"""
        try:
            profile, created = PersonalizationProfile.objects.get_or_create(
                user=user,
                defaults={
                    'preferred_tone': 'supportive',
                    'response_length': 'medium',
                    'crisis_sensitivity': 'high',
                    'effective_strategies': [],
                    'trigger_patterns': [],
                    'mood_patterns': {},
                    'interaction_patterns': {}
                }
            )
            
            if created:
                logger.info(f"Created personalization profile for user {user.id}")
            
            return profile
            
        except Exception as e:
            logger.error(f"Failed to get personalization profile: {e}")
            raise
    
    def learn_from_interaction(self, user: CustomUser, message: Message,
                             response: str, was_helpful: bool = None):
        """Learn from user interaction to improve personalization"""
        try:
            profile = self.get_personalization_profile(user)
            profile.interaction_count += 1
            
            # Analyze message for patterns
            message_content = message.content.lower()
            
            # Update trigger patterns if crisis indicators detected
            from .ai_support import detect_crisis_keywords
            crisis_keywords = detect_crisis_keywords(message.content)
            if crisis_keywords:
                for keyword in crisis_keywords:
                    if keyword not in profile.trigger_patterns:
                        profile.trigger_patterns.append(keyword)
            
            # Update effective strategies based on feedback
            if was_helpful is not None:
                # This would involve more sophisticated analysis
                # For now, just track the interaction
                pass
            
            # Update interaction patterns
            current_hour = timezone.now().hour
            day_of_week = timezone.now().weekday()
            
            if 'interaction_times' not in profile.interaction_patterns:
                profile.interaction_patterns['interaction_times'] = {}
            
            time_key = f"{day_of_week}_{current_hour}"
            profile.interaction_patterns['interaction_times'][time_key] = (
                profile.interaction_patterns['interaction_times'].get(time_key, 0) + 1
            )
            
            profile.save()
            
        except Exception as e:
            logger.error(f"Failed to learn from interaction: {e}")
    
    def _get_session_id(self, user: CustomUser) -> str:
        """Generate or get current session ID for user"""
        # Simple session ID based on user and current day
        today = timezone.now().date()
        return f"{user.id}_{today.isoformat()}"
    
    def cleanup_expired_memories(self):
        """Clean up expired memories"""
        try:
            expired_memories = UserMemory.objects.filter(
                expires_at__lt=timezone.now(),
                is_active=True
            )
            
            count = expired_memories.count()
            expired_memories.update(is_active=False)
            
            logger.info(f"Cleaned up {count} expired memories")
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired memories: {e}")
    
    def get_memory_stats(self, user: CustomUser) -> Dict[str, Any]:
        """Get memory statistics for a user"""
        try:
            stats = {
                'total_memories': UserMemory.objects.filter(user=user, is_active=True).count(),
                'memory_types': {},
                'recent_activity': UserMemory.objects.filter(
                    user=user, 
                    is_active=True,
                    created_at__gte=timezone.now() - timedelta(days=7)
                ).count(),
                'most_accessed': UserMemory.objects.filter(
                    user=user, 
                    is_active=True
                ).order_by('-access_count').first()
            }
            
            # Memory type breakdown
            for memory_type, _ in UserMemory.MEMORY_TYPES:
                count = UserMemory.objects.filter(
                    user=user, 
                    is_active=True, 
                    memory_type=memory_type
                ).count()
                if count > 0:
                    stats['memory_types'][memory_type] = count
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {}
