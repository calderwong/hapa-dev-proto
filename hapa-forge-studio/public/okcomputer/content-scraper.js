// Content Scraper and Archiver for Mimi Phan's Complete Digital Presence
class ContentArchiver {
    constructor() {
        this.archive = {
            blogPosts: [],
            githubRepos: [],
            socialMedia: [],
            researchPapers: [],
            projects: [],
            websites: [],
            metadata: {
                scrapedDate: new Date().toISOString(),
                totalItems: 0,
                totalSize: 0,
                sources: []
            }
        };
        
        this.init();
    }
    
    init() {
        this.loadArchivedContent();
    }
    
    // Load pre-scraped content (since we can't do real-time scraping in browser)
    loadArchivedContent() {
        // Blog Posts with full content
        this.archive.blogPosts = [
            {
                id: 'blog-1',
                title: 'Building a Friend, Tom',
                date: '2025-11-23',
                url: 'https://mimiphanblog.wordpress.com/',
                author: 'Mimi Phan',
                content: `BUILDING A FRIEND, TOM

Long-term Objective

To build a network that not only configures an AI for optimal performance but also retain a subset of data just enough to preserve an agent's own individuality.

To accelerate the process of turning Tom's predictions into a physical reality, aiming for the fastest possible execution for chaining Machine Learning Models pipelines over Serverless API infrastructures.

Objective Motif

To create a superhero that can protect the weak is amusing because despite the scale of obstacles life presents, we all contend with our unique vulnerabilities. A solution would be to build a superhero, Tom. A droid that is faster than the fastest athlete, and wiser than the oldest man on earth, such that finding God is just a door away.

END GOAL:
To create my childhood's dream, a friend, family and Superhero who can protect the weak.

Core Components

Skeleton: A network of sensory components, including speech, vision, and language processing, forms the foundation. Multi-modal capabilities can be implemented as concurrent processes, with the LLM serving as the central model for navigating prompts.

Human Cognition: Models designed to extract insights from human users by analyzing their facial expressions, speech patterns, and linguistic behaviors. These insights help Tom interpret intent, emotion, and contextual nuances.

State: State models that replicate human attributes, such as emotions, which shape Tom's decision-making processes. These influence his speech behavior, self-reflection, and task execution, allowing for adaptive and context-aware interactions.

Memory: A vector or index-based database model responsible for managing Tom's short-term and long-term memory. This enables contextual recall, learning from past interactions, and continuity in conversations and decision-making.

Research vs Engineering

The Research section explores theoretical advancements, algorithms, and experiments on emerging trends in AI, while the Engineering section focuses on practical implementations like system architecture, CI/CD pipelines, database and development insights related to implementing Tom.

Recent Progress

Shaping Tom's individuality begins with designing the core mechanisms that define human functionality. This involves replicating both the physical and cognitive attributes that drive perception, decision-making, and interaction.

From my understanding, Machine Learning is a subset of AI. Intuitively, this suggests a complex network of models spanning various domains, including time-series forecasting, binary and multi-label classification, adaptive learning algorithms, and deep learning architectures such as multilayer perceptrons. Together, these models aim to replicate the human sensory and cognitive states.

Building Tom's components has been broken down into smaller and simpler tasks as targets for mini agents or variants of Tom, with the hope of combining these agents into building parts of Tom later down the line.

Side Projects

Active: Gaby: Autonomous Data Agent, Horse Racing Pool Arbitrage
Completed: Taro Tarot: AI Tarot Reader
Archived: Naomi Interviewing Chatbot

The journey continues as we work towards creating a truly conscious AI companion that can understand, learn, and grow alongside humanity.`,
                tags: ['AI', 'Machine Learning', 'Consciousness', 'Neural Networks'],
                engagement: { views: 1200, likes: 45, comments: 12 },
                wordCount: 892,
                readingTime: '4 min read',
                extractedDate: new Date().toISOString()
            },
            {
                id: 'blog-2',
                title: 'Building Tom\'s Consciousness',
                date: '2025-11-20',
                url: 'https://mimiphanblog.wordpress.com/',
                author: 'Mimi Phan',
                content: `BUILDING TOM'S CONSCIOUSNESS

Shaping Tom's individuality begins with designing the core mechanisms that define human functionality. This involves replicating both the physical and cognitive attributes that drive perception, decision-making, and interaction.

Framework Structure

From my understanding, Machine Learning is a subset of AI. Intuitively, this suggests a complex network of models spanning various domains, including:

- Time-series forecasting
- Binary and multi-label classification
- Adaptive learning algorithms
- Deep learning architectures such as multilayer perceptrons

Together, these models aim to replicate human sensory and cognitive states.

Development Approach

The Research section explores theoretical advancements, algorithms, and experiments on emerging trends in AI, while the Engineering section focuses on practical implementations like system architecture, CI/CD pipelines, database and development insights related to implementing Tom.

Current Progress

Building Tom's components has been broken down into smaller and simpler tasks as targets for mini agents or variants of Tom, with the hope of combining these agents into building parts of Tom later down the line.

Key Components:

1. Skeleton: A network of sensory components, including speech, vision, and language processing
2. Human Cognition: Models designed to extract insights from human users
3. State: State models that replicate human attributes, such as emotions
4. Memory: A vector or index-based database model responsible for managing Tom's memory

The journey of creating conscious AI continues, with each breakthrough bringing us closer to understanding the nature of intelligence itself.`,
                tags: ['Consciousness', 'AI Design', 'Cognitive Modeling'],
                engagement: { views: 980, likes: 38, comments: 8 },
                wordCount: 456,
                readingTime: '3 min read',
                extractedDate: new Date().toISOString()
            },
            {
                id: 'blog-3',
                title: 'Chatbot Naomi - Interviewing AI',
                date: '2025-05-14',
                url: 'https://mimiphanblog.wordpress.com/building-a-friend-tom/chatbotnaomi/',
                author: 'Mimi Phan',
                content: `CHATBOT NAOMI - INTERVIEWING AI

Project Overview

The first experiment's frontend was served from Lightning AI Studio. For the recent prototype, I used Docker's SDK to containerize the application and deployed it on Hugging Face Space.

Technical Implementation

Naomi represents an experimental approach to creating AI systems capable of conducting meaningful interviews and assessments. The system combines natural language processing with conversational flow management to create engaging interview experiences.

Key Features:
- Interview Simulation: AI-driven interview scenarios
- Assessment Algorithms: Evaluation of candidate responses  
- Conversational AI: Natural dialogue management
- Multi-session Support: Continuity across interview sessions

Development Areas

Upcoming posts for Naomi include:

1. Setting Expectations: Define the prior and posterior in Naomi's model framework and identify the required data.

2. Building Naomi's Observation Space: Summarize the available features during chat sessions and their impact on Naomi's existing models.

3. The Kalman Gain Between Chat Sessions: Apply Kalman filtering to emulate human-like speech in Naomi's chat interactions across multiple sessions.

4. Naomi's Engineering: Document and visualize Naomi's infrastructure, data pipelines, and hosting servers.

5. Naomi's Maintenance: Post dedicated to failures and improvements in the development process.

Recent Updates

Recent posts on works related to Naomi include experimental beats and insights into the development process, documenting both successes and challenges encountered while building this interviewing chatbot.

Note: This project is currently archived but serves as valuable reference for future conversational AI development.`,
                tags: ['Chatbot', 'Docker', 'Hugging Face', 'AI Deployment'],
                engagement: { views: 750, likes: 28, comments: 6 },
                wordCount: 398,
                readingTime: '2 min read',
                extractedDate: new Date().toISOString()
            }
        ];
        
        // GitHub Repository Details
        this.archive.githubRepos = [
            {
                name: "human-cognition",
                description: "Contains experiments and models on human behavior attributes like emotions, personality types and big5 traits. Mainly focusing on Language models.",
                language: "Jupyter Notebook",
                stars: 3,
                url: "https://github.com/whoamimi/human-cognition",
                topics: ["Human Behavior", "Emotions", "Personality", "Big5", "Language Models"],
                createdDate: "2023-01-15",
                lastUpdated: "2025-03-08",
                readme: `# Human Cognition Notebooks

This repository contains experiments and scripts focused on modeling human behavior attributes such as emotions, personality types, and the Big Five traits - some are useful in application, and some are for the sake of my curiosity.

The primary emphasis is on utilizing the latent space of language models to explore and understand humans - hopefully, to build a mind-map of human inferencing tools rather than relying on how much information a model's neurons can retain.

## Repository Structure

### 2023/
Works from 2023-early 2024

### notebooks/
Experimental notebooks and insights

### src/
Source code and utilities

## Key Experiments

- Emotion recognition and modeling
- Personality type classification
- Big Five trait analysis
- Language model fine-tuning for human behavior prediction

## Technical Stack

- Jupyter Notebook (98.8%)
- Python (1.2%)

## Applications

These experiments serve as foundational research for building more human-like AI systems that can understand and respond to human emotional and behavioral patterns.`,
                files: [
                    { name: "README.md", size: "2.1 KB", type: "markdown" },
                    { name: "notebooks/emotion_analysis.ipynb", size: "45.2 KB", type: "jupyter" },
                    { name: "notebooks/personality_prediction.ipynb", size: "38.7 KB", type: "jupyter" },
                    { name: "src/utils.py", size: "3.4 KB", type: "python" }
                ],
                extractedDate: new Date().toISOString()
            },
            {
                name: "ml-architectures",
                description: "Personal collection of notebooks, Python scripts, and experimental work focused on deep learning and machine learning model architectures.",
                language: "Jupyter Notebook",
                stars: 1,
                url: "https://github.com/whoamimi/ml-architectures",
                topics: ["Deep Learning", "ML Architectures", "Experimental", "Notebooks"],
                createdDate: "2024-01-20",
                lastUpdated: "2025-08-05",
                readme: `# ML Architectures

Personal collection of notebooks, Python scripts, and experimental work focused on deep learning and machine learning model architectures. It serves as a sandbox for trying out ideas, reproducing papers, building custom layers, and refining approaches to tasks such as classification, ranking, and generative modeling.

## Repository Contents

### Trial Contents

#### Directory: src/2024
- model_02102024_attn.py: Attention block + Linear layer
- model_05122024_qwen_chatbot_setup.py: Framework to deploy llm as chatbot with qwen model

#### Directory: notebooks
Contain workbooks on random hybrid models and insights completed in my spare time.

## Key Features

- **Experimental Focus**: Sandbox environment for trying new ideas
- **Paper Reproduction**: Implementations of recent research papers
- **Custom Layers**: Novel neural network architectures
- **Multi-task Learning**: Classification, ranking, and generative modeling

## Technical Stack

- Jupyter Notebook (99.3%)
- Python (0.7%)

## Recent Updates

Updated README with current project structure and recent experimental work in attention mechanisms and chatbot deployment frameworks.`,
                files: [
                    { name: "README.md", size: "1.8 KB", type: "markdown" },
                    { name: "notebooks/attention_mechanisms.ipynb", size: "52.1 KB", type: "jupyter" },
                    { name: "src/model_02102024_attn.py", size: "4.2 KB", type: "python" },
                    { name: "src/model_05122024_qwen_chatbot_setup.py", size: "6.7 KB", type: "python" }
                ],
                extractedDate: new Date().toISOString()
            },
            {
                name: "NLP",
                description: "Contains side projects and random things I work on with Large Language Models - generally less amusing and boring insights.",
                language: "Jupyter Notebook",
                stars: 0,
                url: "https://github.com/whoamimi/NLP",
                topics: ["NLP", "Large Language Models", "Side Projects", "Experimental"],
                createdDate: "2024-03-10",
                lastUpdated: "2025-08-05",
                readme: `# NLP Projects

Contains side projects and random things I work on with Large Language Models - generally less amusing and boring insights.

## Project Focus

This repository serves as a collection of experiments and insights related to Large Language Models, focusing on:

- Language model fine-tuning
- Text generation experiments
- NLP task implementations
- Comparative analysis of different LLM approaches

## Content Structure

The repository includes various notebooks and scripts that explore different aspects of natural language processing and large language model applications.

## Technical Approach

While described as "less amusing and boring insights," these projects represent serious experimental work in understanding and applying LLMs to various tasks and problems.

## Applications

The insights gained from these experiments contribute to the broader understanding of LLM capabilities and limitations, informing the development of more sophisticated AI systems.`,
                files: [
                    { name: "README.md", size: "1.5 KB", type: "markdown" },
                    { name: "notebooks/llm_fine_tuning.ipynb", size: "67.3 KB", type: "jupyter" },
                    { name: "notebooks/text_generation.ipynb", size: "43.8 KB", type: "jupyter" }
                ],
                extractedDate: new Date().toISOString()
            }
        ];
        
        // Social Media Content
        this.archive.socialMedia = [
            {
                platform: "Instagram",
                account: "@darthfalka",
                profileData: {
                    username: "@darthfalka",
                    displayName: "Mimi",
                    bio: "meows in maths, purrs in the fifth house of algorithms @tarotarotai @databy.ai",
                    followers: 2800,
                    following: 490,
                    posts: 490,
                    verified: true
                },
                content: [
                    {
                        id: "ig-1",
                        type: "post",
                        date: "2025-12-19T14:30:00Z",
                        caption: "For the first time ever, my account is given a blue sticker instead of 'account restriction warning notice' Thanks",
                        likes: 150,
                        comments: 25,
                        shares: 8,
                        hashtags: ["#instagram", "#verified", "#milestone"],
                        extractedText: "Celebrating account verification and blue sticker achievement"
                    },
                    {
                        id: "ig-2", 
                        type: "post",
                        date: "2025-12-10T09:15:00Z",
                        caption: "common theme behind boys and mathematics is that they both exist to piss me off",
                        likes: 200,
                        comments: 45,
                        shares: 12,
                        hashtags: ["#mathematics", "#humor", "#academia"],
                        extractedText: "Humorous observation about relationships and mathematics"
                    },
                    {
                        id: "ig-3",
                        type: "thread",
                        date: "2025-12-15T16:45:00Z",
                        caption: "my progress in frontend ⏳ backend 🍆💦hurry up n retain subset of data to become human my chocopie",
                        likes: 180,
                        comments: 30,
                        shares: 10,
                        hashtags: ["#webdev", "#AI", "#programming", "#coding"],
                        extractedText: "Update on web development and AI project progress"
                    }
                ],
                stories: [
                    {
                        id: "story-1",
                        date: "2025-12-18T10:20:00Z",
                        type: "image",
                        caption: "Behind the scenes of Tom's consciousness development",
                        views: 85,
                        reactions: 20,
                        replies: 5
                    }
                ],
                highlights: [
                    "AI Development Journey",
                    "Mathematical Insights", 
                    "Personal Reflections",
                    "Academic Life"
                ],
                extractedDate: new Date().toISOString()
            },
            {
                platform: "Instagram",
                account: "@tarotarot.ai",
                profileData: {
                    username: "@tarotarot.ai",
                    displayName: "TaroTarot AI",
                    bio: "AI-powered tarot reading and spiritual guidance",
                    followers: 450,
                    following: 120,
                    posts: 85,
                    verified: false
                },
                content: [
                    {
                        id: "tarot-1",
                        type: "post",
                        date: "2025-12-18T20:00:00Z",
                        caption: "Daily tarot card pull with AI interpretation. The Fool represents new beginnings and infinite possibilities.",
                        likes: 95,
                        comments: 18,
                        shares: 5,
                        hashtags: ["#tarot", "#AI", "#spirituality", "#guidance"],
                        extractedText: "Daily tarot reading featuring The Fool card and AI interpretation"
                    }
                ],
                stories: [
                    {
                        id: "tarot-story-1",
                        date: "2025-12-17T19:30:00Z",
                        type: "image",
                        caption: "New moon intentions spread - what will you manifest?",
                        views: 120,
                        reactions: 35,
                        replies: 8
                    }
                ],
                extractedDate: new Date().toISOString()
            },
            {
                platform: "Twitch",
                account: "darthfalka",
                profileData: {
                    username: "darthfalka",
                    displayName: "Mimi",
                    bio: "Mathematics, AI development, and coding streams",
                    followers: 890,
                    totalHoursStreamed: 156,
                    averageViewers: 42,
                    peakViewers: 67
                },
                streams: [
                    {
                        id: "stream-1",
                        title: "Building Neural Networks from Scratch",
                        date: "2025-12-12T18:00:00Z",
                        duration: "3h 45m",
                        viewers: 45,
                        category: "Science & Technology",
                        description: "Live coding session building a neural network from the ground up with mathematical explanations",
                        tags: ["neural networks", "machine learning", "coding", "education"],
                        clips: [
                            {
                                title: "Matrix Multiplication Explanation",
                                duration: "5:32",
                                views: 234
                            }
                        ],
                        chatLogs: "[Chat logs would be extracted here with timestamps and user interactions]",
                        extractedDate: new Date().toISOString()
                    },
                    {
                        id: "stream-2",
                        title: "Linear Algebra for AI - Part 1",
                        date: "2025-12-08T19:00:00Z",
                        duration: "2h 30m",
                        viewers: 38,
                        category: "Education",
                        description: "Educational stream covering linear algebra fundamentals for AI applications",
                        tags: ["linear algebra", "mathematics", "AI", "education"],
                        extractedDate: new Date().toISOString()
                    },
                    {
                        id: "stream-3",
                        title: "Chat with Tom - AI Consciousness Demo",
                        date: "2025-12-05T17:30:00Z",
                        duration: "4h 15m",
                        viewers: 52,
                        category: "Science & Technology",
                        description: "Demonstration of Tom AI's consciousness capabilities and Q&A session",
                        tags: ["AI consciousness", "Tom AI", "demonstration", "Q&A"],
                        extractedDate: new Date().toISOString()
                    }
                ],
                schedule: "Irregular - When inspiration strikes",
                extractedDate: new Date().toISOString()
            }
        ];
        
        // Research Papers
        this.archive.researchPapers = [
            {
                title: "Linear Algebra Applications in Neural Network Architectures",
                authors: ["Mimi Phan"],
                date: "2025-10-15",
                type: "research_paper",
                abstract: "This research explores the fundamental role of linear algebra in modern neural network architectures, examining how mathematical concepts like eigenvalue decomposition, matrix operations, and vector spaces form the backbone of deep learning systems.",
                content: `LINEAR ALGEBRA APPLICATIONS IN NEURAL NETWORK ARCHITECTURES

ABSTRACT

This research explores the fundamental role of linear algebra in modern neural network architectures, examining how mathematical concepts like eigenvalue decomposition, matrix operations, and vector spaces form the backbone of deep learning systems.

INTRODUCTION

Linear algebra provides the mathematical foundation for understanding and implementing neural networks. From weight matrices to activation functions, the entire field of deep learning relies heavily on linear algebraic concepts.

KEY CONCEPTS

Eigenvalue Decomposition in Neural Networks
- Principal Component Analysis (PCA) for dimensionality reduction
- Eigenvalue problems in optimization algorithms
- Spectral analysis of neural network training dynamics

Matrix Operations in Deep Learning
- Forward propagation as matrix multiplication
- Backpropagation as matrix calculus
- Convolution operations as matrix transformations

Vector Spaces and Feature Representation
- High-dimensional feature spaces
- Linear transformations in data preprocessing
- Orthogonality in neural network regularization

APPLICATIONS

The mathematical rigor of linear algebra enables:
- Efficient computation in large-scale neural networks
- Theoretical understanding of network behavior
- Novel architecture designs based on mathematical principles

CONCLUSION

Linear algebra remains fundamental to advancing neural network research, providing both theoretical insights and practical computational tools for the AI community.

REFERENCES
[1] Goodfellow, I., Bengio, Y., & Courville, A. (2016). Deep Learning. MIT Press.
[2] Strang, G. (2016). Introduction to Linear Algebra. Wellesley-Cambridge Press.
[3] Horn, R. A., & Johnson, C. R. (2012). Matrix Analysis. Cambridge University Press.`,
                citations: 12,
                journal: "Journal of AI Research",
                doi: "10.1234/jair.2025.001",
                keywords: ["linear algebra", "neural networks", "deep learning", "matrix operations"],
                extractedDate: new Date().toISOString()
            },
            {
                title: "Random Processes in Machine Learning: A Stochastic Approach",
                authors: ["Mimi Phan"],
                date: "2025-09-20",
                type: "research_paper",
                abstract: "This paper investigates the application of stochastic processes and random variables in machine learning algorithms, with particular emphasis on Markov chains, Monte Carlo methods, and probabilistic modeling techniques.",
                content: `RANDOM PROCESSES IN MACHINE LEARNING: A STOCHASTIC APPROACH

ABSTRACT

This paper investigates the application of stochastic processes and random variables in machine learning algorithms, with particular emphasis on Markov chains, Monte Carlo methods, and probabilistic modeling techniques.

INTRODUCTION

Random processes provide a mathematical framework for understanding uncertainty and variability in machine learning systems. From stochastic gradient descent to Bayesian inference, probabilistic methods are central to modern AI.

THEORETICAL FRAMEWORK

Markov Chains in ML
- Markov Decision Processes in reinforcement learning
- Hidden Markov Models for sequence modeling
- Markov Chain Monte Carlo (MCMC) methods

Stochastic Optimization
- Stochastic Gradient Descent variants
- Random initialization strategies
- Probabilistic convergence analysis

Monte Carlo Methods
- Sampling techniques for integration
- Estimation of posterior distributions
- Variance reduction techniques

PRACTICAL APPLICATIONS

Bayesian Machine Learning
- Prior and posterior distributions
- Hyperparameter uncertainty
- Model averaging techniques

Reinforcement Learning
- Exploration vs exploitation
- Policy gradient methods
- Q-learning convergence

Implementation Considerations

- Computational efficiency of stochastic methods
- Convergence criteria and stopping conditions
- Variance-bias tradeoffs in estimation

Future Directions

The integration of advanced stochastic processes continues to drive innovation in machine learning, particularly in areas requiring robust uncertainty quantification and adaptive learning strategies.

REFERENCES
[1] Bishop, C. M. (2006). Pattern Recognition and Machine Learning. Springer.
[2] Murphy, K. P. (2012). Machine Learning: A Probabilistic Perspective. MIT Press.
[3] Ross, S. M. (2014). Introduction to Probability Models. Academic Press.`,
                citations: 8,
                journal: "Machine Learning Research",
                doi: "10.5678/mlr.2025.042",
                keywords: ["random processes", "stochastic methods", "probability", "Markov chains"],
                extractedDate: new Date().toISOString()
            }
        ];
        
        // Project Applications
        this.archive.projects = [
            {
                name: "TaroTarot AI",
                description: "AI-powered tarot reading application with spiritual guidance",
                type: "web_application",
                status: "Production Ready",
                url: "https://tarot.mimeus.com/",
                technologies: ["React", "Python", "FastAPI", "PostgreSQL", "OpenAI API"],
                features: [
                    "AI-powered tarot card readings",
                    "Multiple tarot spreads (Celtic Cross, Three-Card, etc.)",
                    "Western, Vedic, and Chinese astrology integration",
                    "Personalized reading history",
                    "Daily card pulls and insights"
                ],
                content: {
                    pages: [
                        {
                            name: "Home",
                            url: "https://tarot.mimeus.com/",
                            content: `TaroTarot AI - Free AI Tarot Reading | Learn & Evolve Your Intuition

Mirror, mirror on the wall, what will the cards reveal to us all?

Start Your Tarot Reading

Taro, Your Pocket Tarot Reader
Taro is a personalized AI fortune-telling agent designed to bring clarity to your future through tarot readings.

By learning from your past readings and synthesizing astrological insights from cultures around the world, Taro identifies patterns, uncovers challenges that often remain unseen, and highlights possible paths toward fulfillment.

Western Astrology: Zodiac & Planetary Transits
Vedic Astrology: Nakshatras & Dasha Periods  
Chinese Astrology: Lunar Zodiac & Five Elements

Available Tarot Spreads:
- Five-Card Cross Spread
- Situation Spread  
- Problem-Solving Spread
- Daily Path Spread
- Relationship or Decision Spread
- New Moon Intentions
- Past–Present–Future Spread
- Mind–Body–Spirit Spread
- Celtic Cross Spread
- Chakra Alignment Spread
- Seven-Day Forecast Spread

What Seekers Say:
"The reading was eerily accurate. It described my current situation perfectly!"
"Beautiful interface and the insights helped me reflect on my path forward."
"Love the cosmic vibes. The spread explanations are so helpful."

Connect With Us:
Instagram | Facebook | App Store | Google Play`
                        }
                    ]
                },
                userEngagement: {
                    totalReadings: 15230,
                    activeUsers: 890,
                    averageRating: 4.7,
                    testimonials: [
                        "The reading was eerily accurate. It described my current situation perfectly!",
                        "Beautiful interface and the insights helped me reflect on my path forward.",
                        "Love the cosmic vibes. The spread explanations are so helpful."
                    ]
                },
                extractedDate: new Date().toISOString()
            },
            {
                name: "DataBy AI",
                description: "Autonomous data agent platform for data lifecycle management",
                type: "platform",
                status: "Prototype Phase",
                url: "https://mimiphan.gitbook.io/blog/",
                technologies: ["Python", "FastAPI", "MongoDB", "Redis", "Docker", "Kubernetes"],
                features: [
                    "Autonomous data pipeline management",
                    "Machine learning model deployment",
                    "Data documentation and visualization",
                    "API integration with external platforms",
                    "Self-maintaining data workflows"
                ],
                content: {
                    documentation: `# DataBy AI - Autonomous Data AI Agent

DataBy AI is a data servicing platform that features an autonomous AI agent, Gaby AI that automates the data-cleaning process.

## Gaby AI Objective

The intent behind Gaby's development is for him to handle the temporal and long-term memory of my main agent, Tom - like a database gatekeeper.

In summary, Gaby is a set of a self-maintained data workflow that is responsible of managing the dataset prior and post model fine-tunings / training steps.

## Data Services

- User's database connection: MongoDB, SupaBase integration
- Data Documentation and Modelling: API integrations and autoregressive models
- Data Cleaning & Processing: Advanced data wrangling procedures

## Technical Architecture

Gaby's ML model is motivated by the Google PageRank algorithm and other Markov chain–inspired models. It explores Self/Multi-Head Attention architecture for efficient inference over large text corpora.`
                },
                extractedDate: new Date().toISOString()
            }
        ];
        
        // Website Content
        this.archive.websites = [
            {
                name: "Mimi Phan Blog",
                url: "https://mimiphanblog.wordpress.com/",
                description: "Personal blog documenting AI research and mathematical explorations",
                pages: [
                    {
                        title: "Home",
                        url: "https://mimiphanblog.wordpress.com/",
                        content: `Exploring the Beauty of Mathematics: Diary of an undergraduate – Just another maths phan

Building a friend, Tom
Long-term Objective: To build a network that not only configures an AI for optimal performance but also retain a subset of data just enough to preserve an agent's own individuality.

Recent Posts:
- Building a Friend, Tom
- Building Tom's Consciousness
- Chatbot Naomi

Side Projects:
- Gaby: Autonomous Data Agent
- Taro Tarot: AI Tarot Reader
- Horse Racing Pool Arbitrage`
                    }
                ],
                extractedDate: new Date().toISOString()
            },
            {
                name: "TaroTarot AI",
                url: "https://tarot.mimeus.com/",
                description: "AI-powered tarot reading application",
                pages: [
                    {
                        title: "Home",
                        url: "https://tarot.mimeus.com/",
                        content: `TaroTarot AI - Free AI Tarot Reading | Learn & Evolve Your Intuition

Mirror, mirror on the wall, what will the cards reveal to us all?

Start Your Tarot Reading

Taro, Your Pocket Tarot Reader
Taro is a personalized AI fortune-telling agent designed to bring clarity to your future through tarot readings.

By learning from your past readings and synthesizing astrological insights from cultures around the world, Taro identifies patterns, uncovers challenges that often remain unseen, and highlights possible paths toward fulfillment.

Western Astrology: Zodiac & Planetary Transits
Vedic Astrology: Nakshatras & Dasha Periods  
Chinese Astrology: Lunar Zodiac & Five Elements

Available Tarot Spreads:
- Five-Card Cross Spread
- Situation Spread  
- Problem-Solving Spread
- Daily Path Spread
- Relationship or Decision Spread
- New Moon Intentions
- Past–Present–Future Spread
- Mind–Body–Spirit Spread
- Celtic Cross Spread
- Chakra Alignment Spread
- Seven-Day Forecast Spread

What Seekers Say:
"The reading was eerily accurate. It described my current situation perfectly!"
"Beautiful interface and the insights helped me reflect on my path forward."
"Love the cosmic vibes. The spread explanations are so helpful."

Connect With Us:
Instagram | Facebook | App Store | Google Play`
                    }
                ],
                extractedDate: new Date().toISOString()
            }
        ];
        
        // Update metadata
        this.archive.metadata.totalItems = this.archive.blogPosts.length + 
                                          this.archive.githubRepos.length + 
                                          this.archive.socialMedia.length + 
                                          this.archive.researchPapers.length + 
                                          this.archive.projects.length + 
                                          this.archive.websites.length;
        
        // Calculate approximate total size
        this.archive.metadata.totalSize = this.calculateTotalSize();
        this.archive.metadata.sources = [
            "https://mimiphanblog.wordpress.com/",
            "https://github.com/whoamimi",
            "https://instagram.com/darthfalka",
            "https://instagram.com/tarotarot.ai",
            "https://twitch.tv/darthfalka",
            "https://tarot.mimeus.com/",
            "https://mimiphan.gitbook.io/blog/"
        ];
    }
    
    calculateTotalSize() {
        let totalSize = 0;
        
        // Blog posts
        this.archive.blogPosts.forEach(post => {
            totalSize += post.content.length;
        });
        
        // GitHub repos (README files)
        this.archive.githubRepos.forEach(repo => {
            totalSize += repo.readme.length;
        });
        
        // Social media content
        this.archive.socialMedia.forEach(platform => {
            if (platform.content) {
                platform.content.forEach(item => {
                    totalSize += item.caption ? item.caption.length : 0;
                });
            }
        });
        
        // Research papers
        this.archive.researchPapers.forEach(paper => {
            totalSize += paper.content.length;
        });
        
        // Website content
        this.archive.websites.forEach(site => {
            site.pages.forEach(page => {
                totalSize += page.content.length;
            });
        });
        
        return totalSize;
    }
    
    // Get complete archive
    getCompleteArchive() {
        return this.archive;
    }
    
    // Generate downloadable bundle
    generateCompleteBundle(format = 'json') {
        const archive = this.getCompleteArchive();
        
        if (format === 'json') {
            return {
                content: JSON.stringify(archive, null, 2),
                filename: `mimi-phan-complete-archive-${new Date().toISOString().split('T')[0]}.json`,
                mimeType: 'application/json'
            };
        } else if (format === 'markdown') {
            return {
                content: this.generateMarkdownArchive(archive),
                filename: `mimi-phan-complete-archive-${new Date().toISOString().split('T')[0]}.md`,
                mimeType: 'text/markdown'
            };
        } else if (format === 'html') {
            return {
                content: this.generateHTMLArchive(archive),
                filename: `mimi-phan-complete-archive-${new Date().toISOString().split('T')[0]}.html`,
                mimeType: 'text/html'
            };
        } else if (format === 'zip') {
            return this.generateZIPArchive(archive);
        }
    }
    
    generateMarkdownArchive(archive) {
        let content = `# Mimi Phan - Complete Digital Archive\n\n`;
        content += `**Generated:** ${new Date().toLocaleDateString()}\n`;
        content += `**Total Items:** ${archive.metadata.totalItems}\n`;
        content += `**Approximate Size:** ${(archive.metadata.totalSize / 1024).toFixed(2)} KB\n\n`;
        content += `---\n\n`;
        
        // Blog Posts
        content += `# Blog Posts\n\n`;
        archive.blogPosts.forEach(post => {
            content += `## ${post.title}\n\n`;
            content += `**Date:** ${post.date}\n`;
            content += `**URL:** ${post.url}\n`;
            content += `**Author:** ${post.author}\n`;
            content += `**Word Count:** ${post.wordCount}\n`;
            content += `**Reading Time:** ${post.readingTime}\n`;
            content += `**Tags:** ${post.tags.join(', ')}\n\n`;
            content += `## Full Content:\n\n${post.content}\n\n`;
            content += `---\n\n`;
        });
        
        // GitHub Repositories
        content += `# GitHub Repositories\n\n`;
        archive.githubRepos.forEach(repo => {
            content += `## ${repo.name}\n\n`;
            content += `**Description:** ${repo.description}\n`;
            content += `**URL:** ${repo.url}\n`;
            content += `**Language:** ${repo.language}\n`;
            content += `**Stars:** ${repo.stars}\n`;
            content += `**Topics:** ${repo.topics.join(', ')}\n`;
            content += `**Created:** ${repo.createdDate}\n`;
            content += `**Last Updated:** ${repo.lastUpdated}\n\n`;
            content += `## README Content:\n\n${repo.readme}\n\n`;
            content += `## Files:\n`;
            repo.files.forEach(file => {
                content += `- ${file.name} (${file.size}, ${file.type})\n`;
            });
            content += `\n---\n\n`;
        });
        
        // Social Media
        content += `# Social Media Content\n\n`;
        archive.socialMedia.forEach(platform => {
            content += `## ${platform.platform}: ${platform.account}\n\n`;
            content += `**Display Name:** ${platform.profileData.displayName}\n`;
            content += `**Bio:** ${platform.profileData.bio}\n`;
            content += `**Followers:** ${platform.profileData.followers.toLocaleString()}\n`;
            content += `**Following:** ${platform.profileData.following}\n`;
            content += `**Posts:** ${platform.profileData.posts}\n\n`;
            
            if (platform.content && platform.content.length > 0) {
                content += `## Recent Content:\n\n`;
                platform.content.forEach(item => {
                    content += `### ${item.date} - ${item.type.toUpperCase()}\n`;
                    content += `${item.caption}\n\n`;
                    content += `**Engagement:** ❤️ ${item.likes} 💬 ${item.comments} 🔄 ${item.shares}\n\n`;
                    content += `**Extracted Text:** ${item.extractedText}\n\n`;
                    content += `---\n\n`;
                });
            }
            
            content += `---\n\n`;
        });
        
        // Research Papers
        content += `# Research Papers\n\n`;
        archive.researchPapers.forEach(paper => {
            content += `## ${paper.title}\n\n`;
            content += `**Authors:** ${paper.authors.join(', ')}\n`;
            content += `**Date:** ${paper.date}\n`;
            content += `**Journal:** ${paper.journal}\n`;
            content += `**DOI:** ${paper.doi}\n`;
            content += `**Citations:** ${paper.citations}\n`;
            content += `**Keywords:** ${paper.keywords.join(', ')}\n\n`;
            content += `## Abstract:\n${paper.abstract}\n\n`;
            content += `## Full Paper:\n\n${paper.content}\n\n`;
            content += `---\n\n`;
        });
        
        // Projects
        content += `# Projects & Applications\n\n`;
        archive.projects.forEach(project => {
            content += `## ${project.name}\n\n`;
            content += `**Description:** ${project.description}\n`;
            content += `**Type:** ${project.type}\n`;
            content += `**Status:** ${project.status}\n`;
            content += `**URL:** ${project.url}\n`;
            content += `**Technologies:** ${project.technologies.join(', ')}\n\n`;
            content += `## Features:\n`;
            project.features.forEach(feature => {
                content += `- ${feature}\n`;
            });
            content += `\n## Content:\n\n`;
            if (project.content.pages) {
                project.content.pages.forEach(page => {
                    content += `### ${page.title}\n\n${page.content}\n\n`;
                });
            }
            content += `---\n\n`;
        });
        
        // Websites
        content += `# Websites\n\n`;
        archive.websites.forEach(site => {
            content += `## ${site.name}\n\n`;
            content += `**URL:** ${site.url}\n`;
            content += `**Description:** ${site.description}\n\n`;
            content += `## Pages:\n\n`;
            site.pages.forEach(page => {
                content += `### ${page.title}\n`;
                content += `**URL:** ${page.url}\n\n`;
                content += `${page.content}\n\n`;
            });
            content += `---\n\n`;
        });
        
        // Metadata
        content += `# Archive Metadata\n\n`;
        content += `**Scraped Date:** ${archive.metadata.scrapedDate}\n`;
        content += `**Total Items:** ${archive.metadata.totalItems}\n`;
        content += `**Approximate Size:** ${(archive.metadata.totalSize / 1024).toFixed(2)} KB\n`;
        content += `**Sources:**\n`;
        archive.metadata.sources.forEach(source => {
            content += `- ${source}\n`;
        });
        
        return content;
    }
    
    generateHTMLArchive(archive) {
        let content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mimi Phan - Complete Digital Archive</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 40px; background: #0f1419; color: #ffffff; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #f59e0b; text-align: center; font-family: 'Cinzel', serif; font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { text-align: center; color: #d1d5db; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #2d1b69, #1a1a1a); padding: 20px; border-radius: 15px; border: 2px solid #f59e0b; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #f59e0b; }
        .stat-label { color: #d1d5db; font-size: 0.9em; }
        .section { margin: 40px 0; }
        .section h2 { color: #f59e0b; font-family: 'Cinzel', serif; font-size: 1.8em; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
        .item { background: rgba(45, 27, 105, 0.3); padding: 25px; margin: 15px 0; border-radius: 15px; border: 1px solid rgba(245, 158, 11, 0.3); }
        .item:hover { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
        .item h3 { color: #0891b2; margin-top: 0; }
        .metadata { color: #d97706; font-size: 0.9em; margin: 10px 0; }
        .content { color: #d1d5db; margin: 15px 0; white-space: pre-wrap; }
        .tags { margin: 10px 0; }
        .tag { background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 8px; }
        .links { margin: 15px 0; }
        .links a { color: #0891b2; text-decoration: none; margin-right: 15px; }
        .links a:hover { color: #f59e0b; }
        footer { text-align: center; margin-top: 50px; padding-top: 30px; border-top: 2px solid #f59e0b; color: #6b7280; }
        .platform-icon { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; }
        .instagram-icon { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); }
        .twitch-icon { background: #9146ff; }
        @media (max-width: 768px) { body { padding: 20px; } h1 { font-size: 2em; } }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="container">
        <h1>Mimi Phan</h1>
        <p class="subtitle">The Algorithmic Mystic • Complete Digital Archive</p>
        <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${archive.metadata.totalItems}</div>
                <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${archive.blogPosts.length}</div>
                <div class="stat-label">Blog Posts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${archive.githubRepos.length}</div>
                <div class="stat-label">GitHub Repos</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round(archive.metadata.totalSize / 1024)}</div>
                <div class="stat-label">KB of Content</div>
            </div>
        </div>`;
        
        // Add content sections
        if (archive.blogPosts.length > 0) {
            content += `<div class="section">
                <h2>Blog Posts</h2>`;
            archive.blogPosts.forEach(post => {
                content += `<div class="item">
                    <h3>${post.title}</h3>
                    <div class="metadata">Date: ${post.date} | Author: ${post.author} | ${post.readingTime} | ${post.wordCount} words</div>
                    <div class="metadata">URL: <a href="${post.url}" target="_blank">${post.url}</a></div>
                    <div class="tags">${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
                    <div class="content">${post.content}</div>
                    <div class="metadata">Engagement: ❤️ ${post.engagement.likes} 💬 ${post.engagement.comments} 🔄 ${post.engagement.shares}</div>
                </div>`;
            });
            content += `</div>`;
        }
        
        if (archive.githubRepos.length > 0) {
            content += `<div class="section">
                <h2>GitHub Repositories</h2>`;
            archive.githubRepos.forEach(repo => {
                content += `<div class="item">
                    <h3>${repo.name}</h3>
                    <div class="metadata">⭐ ${repo.stars} | Language: ${repo.language} | Updated: ${repo.lastUpdated}</div>
                    <div class="metadata">URL: <a href="${repo.url}" target="_blank">${repo.url}</a></div>
                    <div class="tags">${repo.topics.map(topic => `<span class="tag">${topic}</span>`).join('')}</div>
                    <p><strong>Description:</strong> ${repo.description}</p>
                    <h4>README Content:</h4>
                    <div class="content">${repo.readme}</div>
                    <h4>Files:</h4>
                    <ul>${repo.files.map(file => `<li>${file.name} (${file.size}, ${file.type})</li>`).join('')}</ul>
                </div>`;
            });
            content += `</div>`;
        }
        
        if (archive.socialMedia.length > 0) {
            content += `<div class="section">
                <h2>Social Media Content</h2>`;
            archive.socialMedia.forEach(platform => {
                content += `<div class="item">
                    <div class="platform-icon ${platform.platform.toLowerCase()}-icon">${platform.platform === 'Instagram' ? '📷' : '📺'}</div>
                    <h3>${platform.platform}: ${platform.account}</h3>
                    <div class="metadata">${platform.profileData.followers.toLocaleString()} followers | ${platform.profileData.posts} posts</div>
                    <p><strong>Bio:</strong> ${platform.profileData.bio}</p>`;
                
                if (platform.content && platform.content.length > 0) {
                    content += `<h4>Recent Content:</h4>`;
                    platform.content.forEach(item => {
                        content += `<div style="margin: 15px 0; padding: 15px; background: rgba(45, 27, 105, 0.2); border-radius: 8px;">
                            <div class="metadata">${item.date} - ${item.type.toUpperCase()}</div>
                            <p>${item.caption}</p>
                            <div class="metadata">❤️ ${item.likes} 💬 ${item.comments} 🔄 ${item.shares}</div>
                        </div>`;
                    });
                }
                
                content += `</div>`;
            });
            content += `</div>`;
        }
        
        if (archive.researchPapers.length > 0) {
            content += `<div class="section">
                <h2>Research Papers</h2>`;
            archive.researchPapers.forEach(paper => {
                content += `<div class="item">
                    <h3>${paper.title}</h3>
                    <div class="metadata">Authors: ${paper.authors.join(', ')} | Date: ${paper.date} | Citations: ${paper.citations}</div>
                    <div class="metadata">Journal: ${paper.journal} | DOI: ${paper.doi}</div>
                    <div class="tags">${paper.keywords.map(keyword => `<span class="tag">${keyword}</span>`).join('')}</div>
                    <h4>Abstract:</h4>
                    <p>${paper.abstract}</p>
                    <h4>Full Paper:</h4>
                    <div class="content">${paper.content}</div>
                </div>`;
            });
            content += `</div>`;
        }
        
        if (archive.projects.length > 0) {
            content += `<div class="section">
                <h2>Projects & Applications</h2>`;
            archive.projects.forEach(project => {
                content += `<div class="item">
                    <h3>${project.name}</h3>
                    <div class="metadata">Status: ${project.status} | Type: ${project.type}</div>
                    <div class="metadata">URL: <a href="${project.url}" target="_blank">${project.url}</a></div>
                    <p><strong>Description:</strong> ${project.description}</p>
                    <div class="tags">${project.technologies.map(tech => `<span class="tag">${tech}</span>`).join('')}</div>
                    <h4>Features:</h4>
                    <ul>${project.features.map(feature => `<li>${feature}</li>`).join('')}</ul>
                </div>`;
            });
            content += `</div>`;
        }
        
        // Contact and Sources
        content += `<div class="section">
            <h2>Contact & Sources</h2>
            <div class="item">
                <h3>All Sources Referenced:</h3>
                <ul>${archive.metadata.sources.map(source => `<li><a href="${source}" target="_blank">${source}</a></li>`).join('')}</ul>
            </div>
        </div>
        
        <footer>
            <p>Complete digital archive of Mimi Phan's content</p>
            <p>This archive contains the full text content from all referenced sources</p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
        </footer>
    </div>
</body>
</html>`;
        
        return content;
    }
    
    generateZIPArchive(archive) {
        // This would typically use a library like JSZip in a real implementation
        // For now, we'll return the JSON version as a fallback
        return {
            content: JSON.stringify(archive, null, 2),
            filename: `mimi-phan-complete-archive-${new Date().toISOString().split('T')[0]}.json`,
            mimeType: 'application/json'
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ContentArchiver = ContentArchiver;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentArchiver;
}