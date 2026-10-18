import {
  User,
  DocumentDetail,
  Conversation,
  Message,
  SummarizeResponse,
  CompareResponse,
  UsageSummary,
  StudioSession,
  YouTubeInspectResponse
} from '../types';

export const MOCK_USER: User = {
  id: 'usr_demo_workspace_2026',
  email: 'demo@researchpilot.ai',
  full_name: 'Dr. Sarah Lin (Research Fellow)',
  is_active: true,
  created_at: new Date().toISOString()
};

export const MOCK_DOCUMENTS: DocumentDetail[] = [
  {
    id: 'doc_vaswani_2017',
    filename: 'Attention_Is_All_You_Need.pdf',
    original_filename: 'Attention Is All You Need (Vaswani et al. 2017).pdf',
    file_size: 569420,
    mime_type: 'application/pdf',
    page_count: 15,
    status: 'completed',
    chunk_count: 36,
    error_message: null,
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:02:00Z',
    summary_markdown: 'The Transformer replaces recurrent layers with multi-head self-attention, allowing significant parallelization and state-of-the-art translation quality.'
  },
  {
    id: 'doc_fowler_2012',
    filename: 'Fault_Tolerant_Surface_Codes.pdf',
    original_filename: 'Surface codes: Towards practical large-scale quantum computation.pdf',
    file_size: 2489000,
    mime_type: 'application/pdf',
    page_count: 54,
    status: 'completed',
    chunk_count: 112,
    error_message: null,
    created_at: '2026-10-18T10:05:00Z',
    updated_at: '2026-10-18T10:08:00Z',
    summary_markdown: 'Surface codes achieve a fault-tolerance error threshold of approximately 1% using only 2D nearest-neighbor coupling between physical qubits.'
  }
];

export const MOCK_STUDIO_SESSION: StudioSession = {
  id: 'ses_interactive_preview_2026',
  user_id: 'usr_demo_workspace_2026',
  session_title: 'Attention & Fault-Tolerant Surface Codes: A Deep Synthesis',
  source_type: 'documents',
  source_metadata: {
    document_ids: ['doc_vaswani_2017', 'doc_fowler_2012'],
    document_titles: ['Attention Is All You Need', 'Fault-Tolerant Surface Codes'],
    documents: [
      { document_id: 'doc_vaswani_2017', title: 'Attention Is All You Need', page_count: 15 },
      { document_id: 'doc_fowler_2012', title: 'Fault-Tolerant Surface Codes', page_count: 54 }
    ]
  },
  podcast_style: 'two_host',
  target_duration: '5-10',
  summary_length: 'detailed',
  generate_notes: true,
  status: 'completed',
  progress: 100,
  stage: 'Podcast generation complete and ready to stream.',
  audio_storage_path: 'podcasts/demo_podcast.mp3',
  audio_duration_seconds: 480,
  summary_data: {
    overview: 'This episode explores how the Transformer architecture revolutionized modern AI by replacing recurrence with multi-head self-attention (Vaswani et al., 2017, p. 1-4), while also analyzing how topological 2D surface codes achieve fault-tolerant quantum error correction with a 1% gate error threshold (Fowler et al., 2012, p. 12).',
    main_topic: 'Comparative Analysis of Attention Mechanisms and Quantum Error Correction',
    concepts: ['Scaled Dot-Product Attention', 'Multi-Head Attention', 'Planar Surface Code', 'Fault-Tolerant Threshold'],
    findings: [
      'Scaled dot-product attention scales with O(n^2) computational sequence complexity.',
      'Surface codes require only 2D nearest-neighbor coupling to suppress logical errors.'
    ],
    examples: ['WMT 2014 English-to-German Translation', 'Planar 2D Transmon Superconducting Array'],
    conclusions: 'Both paradigms prioritize spatial parallelism and localized operational coupling over high-latency sequential routing.',
    takeaways: [
      'Dividing by sqrt(d_k) prevents vanishing gradients in high-dimensional attention.',
      'Surface code distance d exponentially suppresses logical failure rates.'
    ],
    sources: ['Attention Is All You Need (p. 1-15)', 'Fault-Tolerant Surface Codes (p. 1-54)']
  },
  podcast_script: [
    {
      speaker: 'Alex',
      role: 'Host',
      text: 'Welcome back to ResearchPilot Studio! Today, we are breaking down one of the most cited AI papers in history: "Attention Is All You Need" by Vaswani and the Google Brain team.',
      source_reference: 'Attention Is All You Need, p. 1'
    },
    {
      speaker: 'Taylor',
      role: 'Co-Host',
      text: 'Before 2017, natural language processing relied heavily on Recurrent Neural Networks and LSTMs. They processed tokens sequentially, which created a massive computational bottleneck and suffered from gradient vanishing over long sequences.',
      source_reference: 'Attention Is All You Need, p. 2'
    },
    {
      speaker: 'Alex',
      role: 'Host',
      text: 'Exactly! The Transformer threw out recurrence entirely and introduced Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V. Notice that division by square root of d_k? It prevents the softmax gradients from vanishing when vectors grow large.',
      source_reference: 'Attention Is All You Need, p. 4'
    },
    {
      speaker: 'Taylor',
      role: 'Co-Host',
      text: 'And what makes our research comparison fascinating today is looking at how error correction operates in quantum computing. In Fowler et al., they show that topological 2D surface codes achieve fault tolerance with a 1% error threshold using only nearest-neighbor physical couplings.',
      source_reference: 'Fault-Tolerant Surface Codes, p. 12'
    },
    {
      speaker: 'Alex',
      role: 'Host',
      text: 'Both systems solve scaling barriers: Transformers scale deep learning throughput via parallelism, while surface codes scale quantum coherence via geometric topological braids.',
      source_reference: 'Comparative Synthesis'
    }
  ],
  notes_data: {
    key_concepts: [
      {
        term: 'Scaled Dot-Product Attention',
        explanation: 'Divides the query-key dot product by sqrt(d_k) to prevent vanishing gradients during softmax backpropagation.'
      },
      {
        term: 'Fault-Tolerant Surface Code',
        explanation: 'A 2D lattice of physical qubits that corrects bit-flip and phase-flip errors via nearest-neighbor stabilizer measurements.'
      }
    ],
    definitions: [
      {
        term: 'Code Distance d',
        definition: 'The minimum number of physical qubit errors required to cause an undetectable logical state change.'
      }
    ],
    main_findings: [
      'Transformers achieve superior translation BLEU scores with order-of-magnitude less training time.',
      'Surface codes allow arbitrary reduction of logical error rates below the 1.0% per gate threshold.'
    ],
    formulas_or_technical_terms: [
      'Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V',
      'P_L ≈ C * (p / p_th)^((d + 1) / 2)'
    ],
    revision_points: [
      'Self-attention calculates token interactions in constant O(1) sequential operations.',
      'Surface codes run on planar chips without long-range routing wires.'
    ],
    self_test_questions: [
      {
        question: 'Why does the Transformer divide the query-key dot product by sqrt(d_k)?',
        answer: 'For large values of d_k, the dot products grow large in magnitude, pushing the softmax function into regions with extremely small gradients. Scaling by 1/sqrt(d_k) stabilizes gradient flow during training.'
      },
      {
        question: 'What is the fault-tolerance threshold of the planar 2D surface code?',
        answer: 'Approximately 1.0% per gate error rate, which is exceptionally high compared to concatenated code architectures.'
      }
    ],
    final_takeaways: [
      'Transformers enable parallel sequence computation without recurrent bottlenecks.',
      'Surface codes enable scalable fault tolerance using only nearest-neighbor couplings.'
    ]
  },
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const MOCK_CONVERSATION: Conversation = {
  id: 'conv_interactive_demo',
  title: 'Self-Attention Mechanism & Scaling',
  selected_document_ids: ['doc_vaswani_2017'],
  message_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  messages: [
    {
      id: 'msg_1',
      conversation_id: 'conv_interactive_demo',
      role: 'user',
      content: 'How does the Scaled Dot-Product Attention formula work in the Transformer, and why is scaling necessary?',
      citations: [],
      created_at: new Date(Date.now() - 60000).toISOString()
    },
    {
      id: 'msg_2',
      conversation_id: 'conv_interactive_demo',
      role: 'assistant',
      content: 'According to **Attention Is All You Need** (Vaswani et al., 2017, p. 4), the Scaled Dot-Product Attention is defined mathematically as:\n\n$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\n### Why Scaling by $\\sqrt{d_k}$ Is Necessary:\n1. **Variance Suppression**: When the vector dimensionality $d_k$ is large, the dot products between query $Q$ and key $K$ grow large in magnitude (variance scales with $d_k$).\n2. **Gradient Vanishing Prevention**: Unscaled large values push the subsequent $\\text{softmax}$ function into regions where the gradient is vanishingly small, causing backpropagation to stall.\n3. **Empirical Advantage**: While additive and dot-product attention perform similarly for small $d_k$, scaled dot-product attention is substantially faster and more space-efficient in practice because it can be implemented with highly optimized matrix multiplication code.',
      citations: [
        {
          id: 'cit_1',
          chunk_id: 'chk_v2',
          document_id: 'doc_vaswani_2017',
          document_title: 'Attention Is All You Need',
          page_number: 4,
          excerpt: 'We compute the attention function on a set of queries simultaneously, packed together into a matrix Q. The keys and values are also packed into matrices K and V. We compute the matrix of outputs as: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V.',
          relevance_score: 0.96,
          is_exact_quote: true
        }
      ],
      created_at: new Date().toISOString()
    }
  ]
};

export const MOCK_SUMMARIZE_RESPONSE: SummarizeResponse = {
  document_id: 'doc_vaswani_2017',
  document_title: 'Attention Is All You Need',
  sections: {
    executive_summary: {
      title: 'Executive Summary',
      content: 'The Transformer is the first sequence transduction model based entirely on self-attention, replacing recurrent layers such as LSTM and GRU.',
      page_references: [1, 2],
      is_reported: true
    },
    architecture: {
      title: 'Model Architecture',
      content: 'Follows an encoder-decoder structure using stacked self-attention and point-wise fully connected feed-forward networks.',
      page_references: [2, 3, 4],
      is_reported: true
    }
  },
  markdown_content: '## Executive Summary\nThe Transformer is the first sequence transduction model based entirely on self-attention.\n\n## Architecture\nUtilizes Scaled Dot-Product Attention and Multi-Head Attention.',
  generated_at: new Date().toISOString()
};

export const MOCK_COMPARE_RESPONSE: CompareResponse = {
  document_ids: ['doc_vaswani_2017', 'doc_fowler_2012'],
  document_titles: {
    'doc_vaswani_2017': 'Attention Is All You Need',
    'doc_fowler_2012': 'Fault-Tolerant Surface Codes'
  },
  matrix: [
    {
      criterion: 'Core Architectural Paradigm',
      documents: {
        'doc_vaswani_2017': 'Multi-head self-attention without recurrence (p. 2-4)',
        'doc_fowler_2012': 'Topological 2D planar array with nearest-neighbor syndrome measurement (p. 1-12)'
      },
      source_pages: {
        'doc_vaswani_2017': [2, 4],
        'doc_fowler_2012': [1, 12]
      }
    },
    {
      criterion: 'Theoretical Thresholds & Scaling',
      documents: {
        'doc_vaswani_2017': 'Scales with O(n^2) sequence complexity and O(1) sequential operations (p. 6)',
        'doc_fowler_2012': '1.0% physical gate error threshold enables arbitrary logical error reduction (p. 12)'
      },
      source_pages: {
        'doc_vaswani_2017': [6],
        'doc_fowler_2012': [12]
      }
    }
  ],
  synthesis_markdown: '### Synthesis\nBoth works tackle fundamental scaling bottlenecks in modern computation: Vaswani et al. overcome sequential throughput limits in neural sequence learning, while Fowler et al. overcome physical decoherence in quantum circuits via 2D topological codes.'
};

export const MOCK_USAGE_SUMMARY: UsageSummary = {
  total_documents: 2,
  completed_documents: 2,
  failed_documents: 0,
  total_conversations: 1,
  total_messages: 2,
  total_notes: 1,
  total_tokens: 14200,
  total_queries: 18,
  estimated_cost_usd: 0.042,
  avg_latency_ms: 125,
  token_usage_by_model: {
    'gpt-4o-mini': 12000,
    'sentence-transformers/all-MiniLM-L6-v2': 2200
  },
  recent_activity: []
};

export const MOCK_YOUTUBE_DATA: Record<string, YouTubeInspectResponse> = {
  '3Blue1Brown': {
    video_id: 'aircAruvnKk',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
    title: 'But what is a neural network? | Chapter 1, Deep learning',
    channel_name: '3Blue1Brown',
    thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    duration_seconds: 1152,
    has_captions: true,
    transcript_snippet: 'What is a neuron? A neuron is just a thing that holds a number, specifically a number between 0 and 1. The network starts with 784 neurons corresponding to pixel intensities...',
    transcript_word_count: 2450,
    error_message: null
  },
  'Veritasium': {
    video_id: 'JhHMJCUmq28',
    url: 'https://www.youtube.com/watch?v=JhHMJCUmq28',
    title: 'How Quantum Computers Actually Work',
    channel_name: 'Veritasium',
    thumbnail_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
    duration_seconds: 1420,
    has_captions: true,
    transcript_snippet: 'In classical computing, a bit is either 0 or 1. In quantum computing, a qubit can exist in a superposition of states, allowing quantum interference to cancel wrong paths...',
    transcript_word_count: 3100,
    error_message: null
  },
  'Karpathy': {
    video_id: 'zjkBMFhNj_g',
    url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g',
    title: 'Intro to Large Language Models',
    channel_name: 'Andrej Karpathy',
    thumbnail_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80',
    duration_seconds: 3600,
    has_captions: true,
    transcript_snippet: 'Large Language Models are essentially two files: a parameters file and a run file. In pre-training, we compress hundreds of billions of web tokens into neural weights...',
    transcript_word_count: 7800,
    error_message: null
  },
  'MIT': {
    video_id: '7sB052Pz0s8',
    url: 'https://www.youtube.com/watch?v=7sB052Pz0s8',
    title: 'MIT 6.S191: Introduction to Deep Learning',
    channel_name: 'Alexander Amini (MIT)',
    thumbnail_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    duration_seconds: 2840,
    has_captions: true,
    transcript_snippet: 'Welcome to MIT 6.S191, the official introductory course on deep learning methods and applications. We cover perceptrons, backpropagation, and transformer attention...',
    transcript_word_count: 5900,
    error_message: null
  }
};
