from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from chat.rag_service import RAGService
from chat.memory_service import MemoryService
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Initialize the Mem0 and RAG memory system with default knowledge base'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-initialization even if knowledge base exists',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting Mem0 and RAG memory system initialization...'))
        
        try:
            # Initialize RAG service and knowledge base
            rag_service = RAGService()
            memory_service = MemoryService()
            
            # Check if knowledge base already exists
            from chat.memory_models import KnowledgeBase
            existing_count = KnowledgeBase.objects.count()
            
            if existing_count > 0 and not options['force']:
                self.stdout.write(
                    self.style.WARNING(
                        f'Knowledge base already contains {existing_count} items. '
                        'Use --force to re-initialize.'
                    )
                )
                return
            
            if options['force'] and existing_count > 0:
                self.stdout.write(
                    self.style.WARNING(f'Removing {existing_count} existing knowledge base items...')
                )
                KnowledgeBase.objects.all().delete()
            
            # Initialize knowledge base
            self.stdout.write('Initializing knowledge base with mental health information...')
            rag_service.initialize_knowledge_base()
            
            # Count the created items
            new_count = KnowledgeBase.objects.count()
            self.stdout.write(
                self.style.SUCCESS(f'Successfully initialized knowledge base with {new_count} items!')
            )
            
            # Test memory service functionality
            self.stdout.write('Testing memory service functionality...')
            
            # Test embedding model availability
            if memory_service.embedding_model:
                self.stdout.write(self.style.SUCCESS('✓ Embedding model loaded successfully'))
            else:
                self.stdout.write(self.style.WARNING('⚠ Embedding model not available - some features may be limited'))
            
            # Test Mem0 client availability
            if memory_service.mem0_client:
                self.stdout.write(self.style.SUCCESS('✓ Mem0 client initialized successfully'))
            else:
                self.stdout.write(self.style.WARNING('⚠ Mem0 client not available - check API key configuration'))
            
            # Test vector database availability
            if memory_service.vector_db:
                self.stdout.write(self.style.SUCCESS('✓ Vector database available'))
            else:
                self.stdout.write(self.style.WARNING('⚠ Vector database not available - using fallback search'))
            
            # Show knowledge base summary
            self.stdout.write('\nKnowledge Base Summary:')
            self.stdout.write('-' * 50)
            
            knowledge_types = KnowledgeBase.objects.values('knowledge_type').distinct()
            for kt in knowledge_types:
                count = KnowledgeBase.objects.filter(knowledge_type=kt['knowledge_type']).count()
                self.stdout.write(f"  {kt['knowledge_type'].title()}: {count} items")
            
            # Show configuration recommendations
            self.stdout.write('\nConfiguration Recommendations:')
            self.stdout.write('-' * 50)
            
            if not memory_service.mem0_client:
                self.stdout.write(
                    self.style.WARNING(
                        '• Add MEM0_API_KEY to your .env file for enhanced memory features'
                    )
                )
            
            if not memory_service.vector_db:
                self.stdout.write(
                    self.style.WARNING(
                        '• Vector database (ChromaDB) not available - using basic text search fallback'
                    )
                )
            
            self.stdout.write(
                self.style.SUCCESS(
                    '\n🎉 Memory system initialization completed successfully!'
                )
            )
            
            self.stdout.write(
                '\nThe chatbot now has access to:'
                '\n• Mental health knowledge base with 6+ comprehensive topics'
                '\n• User memory and personalization capabilities'
                '\n• Context-aware response generation'
                '\n• Crisis detection and specialized responses'
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize memory system: {e}")
            raise CommandError(f'Memory system initialization failed: {e}')
