#!/usr/bin/env python
"""Test script to debug memory system functionality"""

import os
import sys
import django

# Setup Django environment
sys.path.append('/Users/yasmeen.naaz/Desktop/CBT/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mental_health_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from chat.models import ChatRoom, Message
from chat.memory_service import MemoryService
from chat.ai_support import get_enhanced_ai_response, _store_interaction_memory
from chat.memory_models import UserMemory, PersonalizationProfile

User = get_user_model()

def test_memory_system():
    print("🧠 Testing Memory System...")
    
    # Get or create test user
    user, created = User.objects.get_or_create(
        username='yasmeen_test',
        defaults={
            'email': 'yasmeen@test.com',
            'first_name': 'Yasmeen',
            'last_name': 'Test'
        }
    )
    print(f"✅ User: {user.username} ({'created' if created else 'existing'})")
    
    # Get or create test room
    room, created = ChatRoom.objects.get_or_create(
        name='demo',
        defaults={
            'room_type': 'ai',
            'description': 'Test demo room',
            'created_by': user
        }
    )
    print(f"✅ Room: {room.name} ({'created' if created else 'existing'})")
    
    # Initialize memory service
    memory_service = MemoryService()
    print("✅ Memory service initialized")
    
    # Test 1: Store personal information
    print("\n📝 Test 1: Storing personal information...")
    personal_message = "My name is Yasmeen and I am 23 years old. I work as software engineer at Juspay"
    
    # Create a message object
    message_obj = Message.objects.create(
        room=room,
        sender=user,
        content=personal_message
    )
    
    # Store memory manually
    memory_service.store_user_memory(
        user=user,
        content=f"User's name: Yasmeen, age: 23, occupation: software engineer at Juspay",
        memory_type='personal_info',
        importance='medium',
        source_message=message_obj,
        context={
            'category': 'basic_info',
            'extracted_info': {
                'name': 'Yasmeen',
                'age': 23,
                'occupation': 'software engineer',
                'company': 'Juspay'
            }
        }
    )
    print("✅ Personal information stored")
    
    # Test 2: Check if memory was stored
    print("\n🔍 Test 2: Checking stored memories...")
    memories = UserMemory.objects.filter(user=user)
    print(f"Total memories for user: {memories.count()}")
    for memory in memories:
        print(f"  - {memory.memory_type}: {memory.content[:50]}...")
    
    # Test 3: Test memory retrieval
    print("\n🔎 Test 3: Testing memory retrieval...")
    relevant_memories = memory_service.retrieve_relevant_memories(
        user=user,
        query="What do you know about me?",
        limit=5
    )
    print(f"Found {len(relevant_memories)} relevant memories:")
    for memory in relevant_memories:
        print(f"  - {memory.memory_type}: {memory.content}")
    
    # Test 4: Test personalization profile
    print("\n👤 Test 4: Testing personalization profile...")
    profile = memory_service.get_personalization_profile(user)
    print(f"Profile created: {profile}")
    print(f"Effective strategies: {profile.effective_strategies}")
    print(f"Trigger patterns: {profile.trigger_patterns}")
    print(f"Preferred tone: {profile.preferred_tone}")
    
    # Test 5: Test enhanced AI response with memory
    print("\n🤖 Test 5: Testing enhanced AI response...")
    query_message = "What do you know about me?"
    
    # Create message for the query
    query_msg_obj = Message.objects.create(
        room=room,
        sender=user,
        content=query_message
    )
    
    result = get_enhanced_ai_response(
        message=query_message,
        user=user,
        room=room,
        message_obj=query_msg_obj
    )
    
    print(f"Enhanced response: {result['response']}")
    print(f"Memory used: {len(result.get('memory_used', []))}")
    print(f"Personalized: {result.get('personalized', False)}")
    
    # Test 6: Test interaction storage
    print("\n💾 Test 6: Testing interaction storage...")
    test_response = "I remember you mentioned your name is Yasmeen and you work as a software engineer."
    _store_interaction_memory(user, query_message, test_response, query_msg_obj, False)
    
    # Check total memories after interaction
    total_memories = UserMemory.objects.filter(user=user).count()
    print(f"Total memories after interaction: {total_memories}")
    
    print("\n✅ Memory system test completed!")
    return user, room

def test_specific_scenario():
    """Test the specific scenario from the screenshot"""
    print("\n🎯 Testing specific scenario from screenshot...")
    
    user, created = User.objects.get_or_create(
        username='yasmeen',
        defaults={
            'email': 'yasmeen@example.com',
            'first_name': 'Yasmeen',
            'last_name': 'Naaz'
        }
    )
    
    room, created = ChatRoom.objects.get_or_create(
        name='demo',
        defaults={
            'room_type': 'ai',
            'description': 'Demo room',
            'created_by': user
        }
    )
    
    memory_service = MemoryService()
    
    # Simulate the first message
    first_message = "My name is Yasmeen and I am 23 years old . I work as software engineer at juspay"
    
    # Store this information
    memory_service.store_user_memory(
        user=user,
        content=f"User introduced themselves: Name is Yasmeen, 23 years old, works as software engineer at Juspay",
        memory_type='personal_info',
        importance='high',
        context={
            'name': 'Yasmeen',
            'age': 23,
            'occupation': 'software engineer',
            'company': 'Juspay'
        }
    )
    
    # Now test the second query
    second_message = "What do you know about me ?"
    
    # Get enhanced response
    result = get_enhanced_ai_response(
        message=second_message,
        user=user,
        room=room
    )
    
    print(f"Query: {second_message}")
    print(f"Response: {result['response']}")
    print(f"Should mention: Yasmeen, 23, software engineer, Juspay")
    
    # Check if response contains the stored information
    response_text = result['response'].lower()
    contains_name = 'yasmeen' in response_text
    contains_age = '23' in response_text
    contains_job = 'software engineer' in response_text or 'engineer' in response_text
    contains_company = 'juspay' in response_text
    
    print(f"\nResponse analysis:")
    print(f"  Contains name (Yasmeen): {contains_name}")
    print(f"  Contains age (23): {contains_age}")
    print(f"  Contains job (engineer): {contains_job}")
    print(f"  Contains company (Juspay): {contains_company}")
    
    if contains_name and (contains_age or contains_job):
        print("✅ Memory system working correctly!")
    else:
        print("❌ Memory system not working properly")
        
        # Debug: Check what memories exist
        memories = UserMemory.objects.filter(user=user)
        print(f"\nDebugging - Found {memories.count()} memories:")
        for memory in memories:
            print(f"  - {memory.memory_type}: {memory.content}")

if __name__ == "__main__":
    try:
        test_memory_system()
        test_specific_scenario()
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
