#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append('/Users/yasmeen.naaz/Desktop/CBT/backend')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mental_health_backend.settings')
django.setup()

from chat.rag_service import RAGService
from chat.ai_support import get_enhanced_ai_response
from users.models import CustomUser

def test_informational_query():
    print("🧪 Testing informational query: 'List all the issues that cause anxiety'")
    print("=" * 70)
    
    # Initialize RAG service
    rag_service = RAGService()
    
    # Initialize knowledge base
    print("📚 Initializing knowledge base...")
    rag_service.initialize_knowledge_base()
    
    # Test query
    query = "List all the issues that cause anxiety"
    print(f"\n📝 Query: {query}")
    print("-" * 50)
    
    # Test RAG service directly
    print("\n🤖 Testing RAG service response...")
    rag_result = rag_service.generate_contextual_response(
        user_query=query,
        user=None,
        context={}
    )
    
    print(f"Response: {rag_result['response']}")
    print(f"Knowledge used: {len(rag_result['knowledge_used'])} items")
    print(f"Crisis detected: {rag_result['crisis_detected']}")
    
    # Test enhanced AI response
    print("\n🎯 Testing enhanced AI response...")
    enhanced_result = get_enhanced_ai_response(
        message=query,
        user=None,
        room=None,
        message_obj=None
    )
    
    print(f"Enhanced response: {enhanced_result['response']}")
    print(f"Personalized: {enhanced_result['personalized']}")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    test_informational_query()
