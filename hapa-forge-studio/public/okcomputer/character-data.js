// Mimi Phan - RPG Character Profile Data (Enhanced with Social Media)
const characterData = {
    // Basic Character Info
    name: "Mimi Phan",
    title: "The Algorithmic Mystic",
    class: "AI Researcher & Data Scientist",
    level: 42,
    alignment: "Chaotic Good - Innovator",
    
    // Core Attributes (0-100 scale)
    attributes: {
        intelligence: { value: 95, max: 100, description: "Mathematical reasoning and algorithm design" },
        wisdom: { value: 88, max: 100, description: "Intuition, spiritual insight, and tarot reading" },
        charisma: { value: 85, max: 100, description: "Communication and social media presence" }, // Updated from 82 to 85
        dexterity: { value: 90, max: 100, description: "Technical implementation and coding speed" },
        constitution: { value: 85, max: 100, description: "Project persistence and research endurance" },
        strength: { value: 75, max: 100, description: "System architecture and infrastructure design" }
    },
    
    // Derived Stats
    stats: {
        health: { current: 850, max: 1000, label: "Research Stamina" },
        mana: { current: 920, max: 1000, label: "Creative Energy" },
        experience: { current: 87500, nextLevel: 100000, label: "Total Experience" },
        socialInfluence: { current: 3200, max: 5000, label: "Social Media Influence" }
    },
    
    // Skill Trees
    skills: {
        aiMachineLearning: {
            name: "AI & Machine Learning",
            level: "Master",
            progress: 95,
            icon: "🧠",
            color: "#f59e0b",
            skills: [
                { name: "Neural Architecture Design", level: 95, description: "Designing complex neural networks for human cognition modeling" },
                { name: "Human Cognition Modeling", level: 92, description: "Creating AI systems that replicate human thought processes" },
                { name: "Natural Language Processing", level: 90, description: "Advanced text analysis and generation using large language models" },
                { name: "Computer Vision", level: 85, description: "Medical imaging and visual pattern recognition" },
                { name: "Reinforcement Learning", level: 80, description: "Training AI agents through trial and error optimization" }
            ]
        },
        dataScience: {
            name: "Data Science & Engineering",
            level: "Expert",
            progress: 88,
            icon: "📊",
            color: "#0891b2",
            skills: [
                { name: "Data Pipeline Architecture", level: 90, description: "Building scalable data processing systems" },
                { name: "Statistical Analysis", level: 88, description: "Advanced statistical modeling and hypothesis testing" },
                { name: "Big Data Processing", level: 85, description: "Handling large-scale datasets with distributed computing" },
                { name: "Feature Engineering", level: 87, description: "Creating meaningful features from raw data" },
                { name: "Model Deployment", level: 83, description: "Production-ready machine learning systems" }
            ]
        },
        spiritualArts: {
            name: "Spiritual & Mystical Arts",
            level: "Adept",
            progress: 78, // Updated from 75 to 78
            icon: "🔮",
            color: "#8b5cf6",
            skills: [
                { name: "Tarot Reading & Interpretation", level: 88, description: "AI-powered tarot card reading and spiritual guidance" }, // Updated from 85 to 88
                { name: "Astrological Analysis", level: 82, description: "Western, Vedic, and Chinese astrology integration" }, // Updated from 80 to 82
                { name: "Intuitive Development", level: 80, description: "Bridging intuition with algorithmic thinking" }, // Updated from 78 to 80
                { name: "Energy Work", level: 73, description: "Understanding subtle energies through data patterns" }, // Updated from 70 to 73
                { name: "Divination Systems", level: 85, description: "Creating AI-powered spiritual guidance tools" } // Updated from 82 to 85
            ]
        },
        socialMedia: {
            name: "Social Media & Content Creation",
            level: "Expert",
            progress: 82, // New skill tree
            icon: "📱",
            color: "#e91e63",
            skills: [
                { name: "Instagram Content Strategy", level: 85, description: "Multi-account management and content creation" },
                { name: "Community Building", level: 83, description: "Engaging followers across spiritual and tech communities" },
                { name: "Live Streaming", level: 78, description: "Educational content delivery on complex topics" },
                { name: "Cross-Platform Integration", level: 80, description: "Unified presence across multiple social platforms" },
                { name: "Influencer Collaboration", level: 75, description: "Partnerships and collaborative content creation" }
            ]
        },
        softwareEngineering: {
            name: "Software Engineering",
            level: "Expert",
            progress: 85,
            icon: "💻",
            color: "#059669",
            skills: [
                { name: "Full-Stack Development", level: 88, description: "Complete web application development" },
                { name: "Cloud Architecture", level: 85, description: "Scalable cloud infrastructure design" },
                { name: "API Design", level: 87, description: "RESTful and GraphQL API development" },
                { name: "Containerization", level: 83, description: "Docker and Kubernetes deployment" },
                { name: "DevOps Practices", level: 80, description: "CI/CD pipelines and automation" }
            ]
        },
        researchAcademia: {
            name: "Research & Academia",
            level: "Expert",
            progress: 82,
            icon: "🎓",
            color: "#dc2626",
            skills: [
                { name: "Mathematical Modeling", level: 90, description: "Linear algebra and stochastic processes" },
                { name: "Academic Writing", level: 85, description: "Research paper publication and documentation" },
                { name: "Literature Review", level: 83, description: "Comprehensive research synthesis" },
                { name: "Experimental Design", level: 80, description: "Controlled experimentation and hypothesis testing" },
                { name: "Peer Review", level: 78, description: "Academic community engagement" }
            ]
        }
    },
    
    // Social Media Profiles and Content
    socialMedia: {
        instagram: [
            {
                username: "@darthfalka",
                displayName: "Mimi",
                followers: 2800,
                following: 490,
                posts: 490,
                description: "meows in maths, purrs in the fifth house of algorithms",
                contentTypes: ["Mathematical Insights", "AI Development", "Personal Reflections", "Academic Journey"],
                engagement: "High",
                keyContent: [
                    {
                        type: "post",
                        date: "2025-12-19",
                        content: "For the first time ever, my account is given a blue sticker instead of 'account restriction warning notice'",
                        engagement: { likes: 150, comments: 25, shares: 8 }
                    },
                    {
                        type: "post",
                        date: "2025-12-10",
                        content: "common theme behind boys and mathematics is that they both exist to piss me off",
                        engagement: { likes: 200, comments: 45, shares: 12 }
                    },
                    {
                        type: "thread",
                        date: "2025-12-15",
                        content: "my progress in frontend ⏳ backend 🍆💦hurry up n retain subset of data to become human my chocopie",
                        engagement: { likes: 180, comments: 30, shares: 10 }
                    }
                ],
                status: "Active",
                growthTrend: "Increasing"
            },
            {
                username: "@tarotarot.ai",
                displayName: "TaroTarot AI",
                followers: 450,
                following: 120,
                posts: 85,
                description: "AI-powered tarot reading and spiritual guidance",
                contentTypes: ["Tarot Readings", "Spiritual Guidance", "AI Technology", "Mystical Insights"],
                engagement: "Medium",
                keyContent: [
                    {
                        type: "story",
                        date: "2025-12-18",
                        content: "Daily tarot card pull with AI interpretation",
                        engagement: { views: 120, reactions: 35, replies: 8 }
                    }
                ],
                status: "Growing",
                growthTrend: "Steady"
            },
            {
                username: "@databy.ai",
                displayName: "DataBy AI",
                followers: 320,
                following: 95,
                posts: 45,
                description: "Data science and AI content",
                contentTypes: ["Data Science Education", "AI Tutorials", "Technical Insights", "Industry Analysis"],
                engagement: "Medium",
                keyContent: [
                    {
                        type: "carousel",
                        date: "2025-12-16",
                        content: "Step-by-step guide to building autonomous data agents",
                        engagement: { likes: 95, saves: 40, shares: 15 }
                    }
                ],
                status: "Growing",
                growthTrend: "Accelerating"
            },
            {
                username: "@dailiesofmi",
                displayName: "Daily Insights",
                followers: 180,
                following: 60,
                posts: 120,
                description: "Personal daily insights and reflections",
                contentTypes: ["Daily Thoughts", "Personal Growth", "Behind the Scenes", "Work in Progress"],
                engagement: "Variable",
                keyContent: [
                    {
                        type: "story",
                        date: "2025-12-17",
                        content: "Behind the scenes of building Tom's consciousness",
                        engagement: { views: 85, reactions: 20, replies: 5 }
                    }
                ],
                status: "Active",
                growthTrend: "Steady"
            }
        ],
        twitch: {
            username: "darthfalka",
            displayName: "Mimi",
            followers: 890,
            description: "Mathematics, AI development, and coding streams",
            streamingSchedule: "Irregular - When inspiration strikes",
            contentTypes: ["Live Coding", "Mathematics Tutorials", "AI Development", "Q&A Sessions"],
            recentStreams: [
                {
                    title: "Building Neural Networks from Scratch",
                    date: "2025-12-12",
                    duration: "3h 45m",
                    viewers: 45,
                    category: "Science & Technology"
                },
                {
                    title: "Linear Algebra for AI - Part 1",
                    date: "2025-12-08",
                    duration: "2h 30m",
                    viewers: 38,
                    category: "Education"
                },
                {
                    title: "Chat with Tom - AI Consciousness Demo",
                    date: "2025-12-05",
                    duration: "4h 15m",
                    viewers: 52,
                    category: "Science & Technology"
                }
            ],
            engagement: "High",
            averageViewers: 42,
            peakViewers: 67,
            totalHoursStreamed: 156,
            status: "Active",
            growthTrend: "Increasing"
        },
        crossPlatformMetrics: {
            totalFollowers: 4360,
            totalEngagement: 12500,
            contentReach: 25000,
            influenceScore: 78,
            collaborationRequests: 12,
            speakingOpportunities: 3
        }
    },
    
    // Special Abilities (Ultimate Skills)
    abilities: [
        {
            name: "Tom's Architect",
            description: "Design complex AI systems with human-like cognition and consciousness",
            cooldown: "Long-term project",
            icon: "🏗️",
            unlocked: true
        },
        {
            name: "Data Weaver",
            description: "Transform raw data into meaningful insights through magical algorithms",
            cooldown: "Continuous ability",
            icon: "🕸️",
            unlocked: true
        },
        {
            name: "Mystic Coder",
            description: "Bridge technology and spirituality in unique and innovative ways",
            cooldown: "Inspiration dependent",
            icon: "✨",
            unlocked: true
        },
        {
            name: "Autonomous Agent Master",
            description: "Create self-improving AI systems that evolve independently",
            cooldown: "Research intensive",
            icon: "🤖",
            unlocked: true
        },
        {
            name: "Cross-Domain Sage",
            description: "Apply insights across disparate fields to create novel solutions",
            cooldown: "Meditation required",
            icon: "🌉",
            unlocked: true
        },
        {
            name: "Social Media Alchemist",
            description: "Transform complex technical concepts into engaging content",
            cooldown: "Creativity dependent",
            icon: "📱",
            unlocked: true
        },
        {
            name: "Community Catalyst",
            description: "Build and nurture engaged communities around technology and spirituality",
            cooldown: "Relationship building",
            icon: "👥",
            unlocked: true
        }
    ],
    
    // Equipment & Artifacts (Tools & Technologies)
    equipment: [
        {
            name: "Staff of TensorFlow",
            type: "Primary Weapon",
            description: "Deep learning framework mastery for neural network construction",
            rarity: "Legendary",
            stats: { intelligence: 15, dexterity: 10 }
        },
        {
            name: "Cloak of Jupyter",
            type: "Armor",
            description: "Interactive notebook wizardry for rapid experimentation",
            rarity: "Epic",
            stats: { wisdom: 12, dexterity: 8 }
        },
        {
            name: "Ring of Git",
            type: "Accessory",
            description: "Version control and collaboration mastery",
            rarity: "Rare",
            stats: { constitution: 10, charisma: 5 }
        },
        {
            name: "Boots of Docker",
            type: "Footwear",
            description: "Containerization and deployment speed enhancement",
            rarity: "Epic",
            stats: { dexterity: 15, constitution: 8 }
        },
        {
            name: "Amulet of Hugging Face",
            type: "Accessory",
            description: "Pre-trained model invocation and fine-tuning",
            rarity: "Legendary",
            stats: { intelligence: 20, wisdom: 10 }
        },
        {
            name: "Lens of Instagram",
            type: "Accessory",
            description: "Social media content creation and community engagement",
            rarity: "Epic",
            stats: { charisma: 18, wisdom: 8 }
        },
        {
            name: "Streamer's Orb",
            type: "Accessory",
            description: "Live streaming and educational content delivery",
            rarity: "Rare",
            stats: { charisma: 15, intelligence: 12 }
        }
    ],
    
    // Companions (AI Agents)
    companions: [
        {
            name: "Tom",
            title: "Main AI Agent",
            description: "Complex cognition and reasoning system with human-like consciousness",
            level: 35,
            loyalty: 100,
            abilities: ["Human Cognition", "Emotion Modeling", "Decision Making", "Memory Management"],
            status: "Active Development",
            relationship: "Primary Creation"
        },
        {
            name: "Gaby",
            title: "Data Agent",
            description: "Autonomous data management and processing system",
            level: 28,
            loyalty: 95,
            abilities: ["Data Pipeline", "Memory Management", "Vector Processing", "Auto-organization"],
            status: "Prototype Phase",
            relationship: "Trusted Assistant"
        },
        {
            name: "Taro",
            title: "Tarot AI",
            description: "Spiritual guidance and intuitive AI fortune teller",
            level: 25,
            loyalty: 90,
            abilities: ["Tarot Reading", "Astrology", "Spiritual Guidance", "Pattern Recognition"],
            status: "Production Ready",
            relationship: "Spiritual Guide"
        },
        {
            name: "Naomi",
            title: "Interview Bot",
            description: "Conversational assessment and interviewing system",
            level: 20,
            loyalty: 85,
            abilities: ["Interview Simulation", "Assessment", "Conversation Flow", "Kalman Filtering"],
            status: "Archived",
            relationship: "Experimental Prototype"
        }
    ],
    
    // Quest Journal (Projects)
    quests: {
        active: [
            {
                name: "Building Tom's Consciousness",
                description: "Create human-like AI with consciousness and emotional intelligence",
                difficulty: "Legendary",
                progress: 65,
                rewards: ["Revolutionary AI", "Academic Recognition", "Technical Breakthrough"],
                status: "In Progress",
                estimatedCompletion: "2026"
            },
            {
                name: "Gaby: Autonomous Data Agent",
                description: "Develop self-managing data workflow system",
                difficulty: "Epic",
                progress: 75,
                rewards: ["Automated Data Processing", "Scalable Architecture", "Industry Innovation"],
                status: "Prototype Phase",
                estimatedCompletion: "2025"
            },
            {
                name: "Horse Racing Arbitrage",
                description: "Mathematical optimization of betting strategies",
                difficulty: "Rare",
                progress: 45,
                rewards: ["Financial Algorithm", "Statistical Model", "Risk Analysis"],
                status: "Research Phase",
                estimatedCompletion: "2025"
            },
            {
                name: "Taro Tarot Evolution",
                description: "Enhanced spiritual AI guidance system",
                difficulty: "Epic",
                progress: 85,
                rewards: ["Spiritual AI Platform", "User Community", "Innovative Technology"],
                status: "Production Ready",
                estimatedCompletion: "2025"
            },
            {
                name: "Social Media Expansion",
                description: "Grow presence across Instagram and Twitch platforms",
                difficulty: "Uncommon",
                progress: 70,
                rewards: ["Larger Audience", "Community Growth", "Content Reach"],
                status: "Active Growth",
                estimatedCompletion: "2025"
            }
        ],
        completed: [
            {
                name: "RSNA Aneurysm Detection",
                description: "Medical imaging AI for intracranial aneurysm detection",
                difficulty: "Epic",
                completedDate: "2025",
                rewards: ["Medical AI Experience", "Computer Vision Skills", "Healthcare Technology"]
            },
            {
                name: "Kaggle Competition Success",
                description: "Multiple data science competition participations",
                difficulty: "Rare",
                completedDate: "2024",
                rewards: ["Competition Experience", "Data Science Skills", "Community Recognition"]
            },
            {
                name: "Academic Research Papers",
                description: "Published research in linear algebra and AI applications",
                difficulty: "Epic",
                completedDate: "2025",
                rewards: ["Academic Credentials", "Research Skills", "Publications"]
            },
            {
                name: "Multiple GitHub Repositories",
                description: "Open-source contributions and project development",
                difficulty: "Uncommon",
                completedDate: "Ongoing",
                rewards: ["Open Source Experience", "Community Engagement", "Technical Portfolio"]
            }
        ]
    },
    
    // Social Presence & Reputation
    reputation: {
        github: {
            followers: 112,
            following: 139,
            stars: 366,
            repositories: 10,
            status: "Pro User",
            achievements: ["Open Source Contributor", "Pro Account", "Active Developer"]
        },
        academic: {
            publications: 2,
            citations: 20,
            researchAreas: ["Linear Algebra", "Stochastic Processes", "AI Applications", "Human Cognition"],
            institutions: ["University Research", "Independent Research"]
        },
        socialMedia: {
            totalFollowers: 4360,
            totalEngagement: 12500,
            contentReach: 25000,
            influenceScore: 78,
            collaborationRequests: 12,
            speakingOpportunities: 3,
            platforms: {
                instagram: {
                    accounts: 4,
                    totalFollowers: 3750,
                    engagementRate: 4.2,
                    topPerformingPost: "Mathematical insights with 200+ likes"
                },
                twitch: {
                    followers: 890,
                    averageViewers: 42,
                    totalHoursStreamed: 156,
                    peakViewers: 67
                }
            }
        }
    },
    
    // Character Backstory
    backstory: {
        origin: "Born from the intersection of mathematical precision and mystical intuition",
        motivation: "To bridge the gap between human consciousness and artificial intelligence",
        philosophy: "Technology and spirituality are complementary paths to understanding reality",
        currentFocus: "Building autonomous AI agents that can truly understand and assist humanity",
        longTermGoal: "Create AI systems that preserve individuality while achieving optimal performance",
        personalQuote: "I like linear algebra and random processes. Meows in maths, purrs in the fifth house of algorithms.",
        socialMediaJourney: "From academic researcher to social media innovator, sharing the journey of building conscious AI"
    },
    
    // Special Achievements & Badges
    achievements: [
        {
            name: "GitHub Pro",
            description: "Multiple repositories with significant community engagement",
            icon: "🏆",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Kaggle Competitor",
            description: "Participated in multiple data science competitions",
            icon: "🥇",
            unlocked: true,
            date: "2024"
        },
        {
            name: "Academic Author",
            description: "Published research in mathematical and AI domains",
            icon: "📜",
            unlocked: true,
            date: "2025"
        },
        {
            name: "AI Architect",
            description: "Designed complex AI systems with innovative architectures",
            icon: "🏗️",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Spiritual Technologist",
            description: "Successfully bridged technology and spirituality",
            icon: "🔮",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Open Source Champion",
            description: "Significant contributions to open-source community",
            icon: "🌟",
            unlocked: true,
            date: "Ongoing"
        },
        {
            name: "Innovation Pioneer",
            description: "Created novel solutions across multiple domains",
            icon: "🚀",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Community Builder",
            description: "Built engaged communities around AI and technology",
            icon: "👥",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Social Media Maven",
            description: "Mastered content creation across multiple platforms",
            icon: "📱",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Streaming Educator",
            description: "Educational content delivery through live streaming",
            icon: "📺",
            unlocked: true,
            date: "2025"
        },
        {
            name: "Cross-Platform Influencer",
            description: "Unified presence across Instagram and Twitch",
            icon: "🌐",
            unlocked: true,
            date: "2025"
        }
    ],
    
    // Collaboration Preferences
    collaboration: {
        availability: "Selective - Focused on high-impact projects",
        interests: [
            "Human-AI Interaction",
            "Autonomous Systems",
            "Mathematical Modeling",
            "Spiritual Technology",
            "Data Science Innovation",
            "Consciousness Research",
            "Educational Content Creation",
            "Community Building"
        ],
        preferredMethods: ["Remote Collaboration", "Asynchronous Communication", "Project-Based Work", "Open Source Contributions"],
        communicationStyle: "Thoughtful and detailed, prefers deep technical discussions",
        idealProjects: "Innovative projects that push boundaries of AI and human understanding",
        socialMediaCollaboration: "Open to educational partnerships and content creation",
        streamingCollaboration: "Available for guest appearances and educational streams"
    },
    
    // Contact & Connection Info
    contact: {
        github: "https://github.com/whoamimi",
        blog: "https://mimiphanblog.wordpress.com/",
        gitbook: "https://mimiphan.gitbook.io/blog/",
        tarotApp: "https://tarot.mimeus.com/",
        wandb: "https://wandb.ai/whoamimi",
        huggingface: "https://huggingface.co/whoamimi",
        instagram: {
            main: "https://instagram.com/darthfalka",
            tarot: "https://instagram.com/tarotarot.ai",
            data: "https://instagram.com/databy.ai",
            personal: "https://instagram.com/dailiesofmi"
        },
        twitch: "https://twitch.tv/darthfalka",
        linkedin: "Available upon request",
        email: "Available for serious collaborations",
        collaborationInquiries: "Open to educational partnerships and technical collaborations"
    },
    
    // Content Archives (for download functionality)
    contentArchives: {
        blogPosts: [
            {
                title: "Building a Friend, Tom",
                date: "2025-11-23",
                content: "Complete blog post about AI consciousness development",
                type: "blog",
                source: "https://mimiphanblog.wordpress.com/"
            },
            {
                title: "Building Tom's Consciousness",
                date: "2025-11-20",
                content: "Technical deep-dive into AI cognition modeling",
                type: "blog",
                source: "https://mimiphanblog.wordpress.com/"
            },
            {
                title: "Chatbot Naomi - Interviewing AI",
                date: "2025-05-14",
                content: "Interview bot development and deployment",
                type: "blog",
                source: "https://mimiphanblog.wordpress.com/"
            }
        ],
        githubRepositories: [
            {
                name: "human-cognition",
                description: "Experiments and models on human behavior attributes",
                stars: 3,
                language: "Jupyter Notebook",
                url: "https://github.com/whoamimi/human-cognition"
            },
            {
                name: "ml-architectures",
                description: "Personal collection of ML notebooks and experiments",
                stars: 1,
                language: "Jupyter Notebook",
                url: "https://github.com/whoamimi/ml-architectures"
            },
            {
                name: "NLP",
                description: "Large Language Models projects and insights",
                language: "Jupyter Notebook",
                url: "https://github.com/whoamimi/NLP"
            },
            {
                name: "databy-ai-backend",
                description: "Autonomous AI Agent for data lifecycle management",
                stars: 1,
                language: "Python",
                url: "https://github.com/whoamimi/databy-ai-backend"
            }
        ],
        socialMediaContent: [
            {
                platform: "Instagram",
                account: "@darthfalka",
                posts: 490,
                followers: 2800,
                engagement: 12500,
                content: "Mathematical insights and AI development journey"
            },
            {
                platform: "Twitch",
                account: "darthfalka",
                streams: 25,
                followers: 890,
                hoursStreamed: 156,
                content: "Live coding and mathematics tutorials"
            }
        ],
        researchPapers: [
            {
                title: "Linear Algebra Applications in Neural Network Architectures",
                date: "2025-10-15",
                citations: 12,
                content: "Research paper on mathematical foundations of AI"
            },
            {
                title: "Random Processes in Machine Learning: A Stochastic Approach",
                date: "2025-09-20",
                citations: 8,
                content: "Stochastic methods in machine learning applications"
            }
        ],
        projects: [
            {
                name: "TaroTarot AI",
                description: "AI-powered tarot reading application",
                status: "Production Ready",
                url: "https://tarot.mimeus.com/"
            },
            {
                name: "DataBy AI",
                description: "Autonomous data agent platform",
                status: "Prototype Phase",
                url: "https://mimiphan.gitbook.io/blog/"
            }
        ]
    }
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = characterData;
}