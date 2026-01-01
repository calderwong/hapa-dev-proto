// RPG Character Profile - Main JavaScript
class RPGCharacterProfile {
    constructor() {
        this.currentTab = 'overview';
        this.characterData = characterData;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.setupMagicalBackground();
        this.createFloatingParticles();
        this.initializeTooltips();
        this.updateCharacterStats();
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Skill node interactions
        document.querySelectorAll('.skill-item').forEach(skill => {
            skill.addEventListener('mouseenter', (e) => {
                this.showSkillTooltip(e.currentTarget);
            });
            
            skill.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        // Attribute interactions
        document.querySelectorAll('.attribute-item').forEach(attribute => {
            attribute.addEventListener('mouseenter', (e) => {
                this.showAttributeTooltip(e.currentTarget);
            });
            
            attribute.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        // Companion card interactions
        document.querySelectorAll('.companion-card').forEach(card => {
            card.addEventListener('mouseenter', (e) => {
                this.showCompanionTooltip(e.currentTarget);
            });
            
            card.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
        
        // Quest card interactions
        document.querySelectorAll('.quest-card').forEach(card => {
            card.addEventListener('mouseenter', (e) => {
                this.showQuestTooltip(e.currentTarget);
            });
            
            card.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        
        // Animate tab transition
        this.animateTabTransition(tabName);
        
        this.currentTab = tabName;
    }
    
    animateTabTransition(tabName) {
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        // Animate content appearance
        anime({
            targets: tabContent.children,
            opacity: [0, 1],
            translateY: [20, 0],
            delay: anime.stagger(100),
            duration: 600,
            easing: 'easeOutExpo'
        });
        
        // Add magical particles effect
        this.createMagicalBurst();
    }
    
    initializeAnimations() {
        // Animate character portrait on load
        anime({
            targets: '.character-portrait',
            scale: [0.8, 1],
            opacity: [0, 1],
            duration: 1000,
            easing: 'easeOutElastic(1, .8)'
        });
        
        // Animate stat bars
        this.animateStatBars();
        
        // Animate floating elements
        this.animateFloatingElements();
        
        // Typewriter effect for character quote
        this.initializeTypewriter();
    }
    
    animateStatBars() {
        const statBars = document.querySelectorAll('.stat-bar');
        
        statBars.forEach((bar, index) => {
            const width = bar.style.width;
            bar.style.width = '0%';
            
            anime({
                targets: bar,
                width: width,
                duration: 1500,
                delay: index * 200,
                easing: 'easeOutExpo'
            });
        });
    }
    
    animateFloatingElements() {
        // Animate skill nodes
        anime({
            targets: '.skill-item',
            opacity: [0, 1],
            translateX: [-20, 0],
            delay: anime.stagger(100),
            duration: 800,
            easing: 'easeOutExpo'
        });
        
        // Animate companion cards
        anime({
            targets: '.companion-card',
            opacity: [0, 1],
            scale: [0.9, 1],
            delay: anime.stagger(150),
            duration: 600,
            easing: 'easeOutExpo'
        });
        
        // Animate quest cards
        anime({
            targets: '.quest-card',
            opacity: [0, 1],
            translateY: [20, 0],
            delay: anime.stagger(100),
            duration: 600,
            easing: 'easeOutExpo'
        });
    }
    
    initializeTypewriter() {
        const quoteElement = document.querySelector('.italic');
        if (quoteElement) {
            const text = quoteElement.textContent;
            quoteElement.textContent = '';
            
            new Typed(quoteElement, {
                strings: [text],
                typeSpeed: 50,
                showCursor: false,
                onComplete: () => {
                    // Add magical glow effect
                    quoteElement.classList.add('magical-glow');
                }
            });
        }
    }
    
    setupMagicalBackground() {
        // P5.js magical background with particles
        new p5((p) => {
            let particles = [];
            let time = 0;
            
            p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent('magical-bg');
                
                // Create magical particles
                for (let i = 0; i < 30; i++) {
                    particles.push({
                        x: p.random(p.width),
                        y: p.random(p.height),
                        vx: p.random(-0.3, 0.3),
                        vy: p.random(-0.3, 0.3),
                        size: p.random(2, 8),
                        hue: p.random(30, 60), // Golden hues
                        alpha: p.random(0.3, 0.8),
                        pulse: p.random(0.01, 0.03)
                    });
                }
            };
            
            p.draw = () => {
                p.clear();
                time += 0.01;
                
                // Draw magical connections
                p.strokeWeight(1);
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        let distance = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        if (distance < 150) {
                            let alpha = p.map(distance, 0, 150, 0.3, 0);
                            p.stroke(245, 158, 11, alpha * 255);
                            p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        }
                    }
                }
                
                // Update and draw particles
                p.noStroke();
                for (let particle of particles) {
                    // Update position
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    
                    // Wrap around edges
                    if (particle.x < 0) particle.x = p.width;
                    if (particle.x > p.width) particle.x = 0;
                    if (particle.y < 0) particle.y = p.height;
                    if (particle.y > p.height) particle.y = 0;
                    
                    // Pulsing effect
                    let pulseSize = particle.size + p.sin(time * particle.pulse) * 2;
                    
                    // Draw particle
                    p.fill(particle.hue, 80, 90, particle.alpha * 255);
                    p.circle(particle.x, particle.y, pulseSize);
                    
                    // Add inner glow
                    p.fill(particle.hue, 60, 100, particle.alpha * 100);
                    p.circle(particle.x, particle.y, pulseSize * 0.5);
                }
            };
            
            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
        });
    }
    
    createFloatingParticles() {
        const container = document.getElementById('particles-container');
        
        // Create floating particles
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'floating-particles';
            particle.style.width = `${Math.random() * 6 + 2}px`;
            particle.style.height = particle.style.width;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 6}s`;
            particle.style.animationDuration = `${6 + Math.random() * 4}s`;
            
            container.appendChild(particle);
        }
    }
    
    createMagicalBurst() {
        const burst = document.createElement('div');
        burst.style.position = 'fixed';
        burst.style.top = '50%';
        burst.style.left = '50%';
        burst.style.transform = 'translate(-50%, -50%)';
        burst.style.width = '100px';
        burst.style.height = '100px';
        burst.style.borderRadius = '50%';
        burst.style.background = 'radial-gradient(circle, rgba(245, 158, 11, 0.8), transparent)';
        burst.style.pointerEvents = 'none';
        burst.style.zIndex = '9999';
        
        document.body.appendChild(burst);
        
        anime({
            targets: burst,
            scale: [0, 3],
            opacity: [1, 0],
            duration: 800,
            easing: 'easeOutExpo',
            complete: () => {
                document.body.removeChild(burst);
            }
        });
    }
    
    initializeTooltips() {
        // Create tooltip element
        this.tooltip = document.getElementById('tooltip');
    }
    
    showSkillTooltip(element) {
        const skillName = element.querySelector('.font-medium').textContent;
        const skillDescription = element.querySelector('.text-gray-300').textContent;
        const skillLevel = element.querySelector('.font-mono').textContent;
        
        this.tooltip.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">${skillName}</h4>
            <p class="text-sm text-gray-300 mb-2">${skillDescription}</p>
            <p class="text-xs font-mono">Proficiency: ${skillLevel}</p>
        `;
        
        this.positionTooltip(element);
        this.tooltip.classList.add('visible');
    }
    
    showAttributeTooltip(element) {
        const attributeName = element.querySelector('.font-medium').textContent;
        const attributeValue = element.querySelector('.font-mono').textContent;
        const attributeDescription = this.getAttributeDescription(attributeName);
        
        this.tooltip.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">${attributeName}</h4>
            <p class="text-sm text-gray-300 mb-2">${attributeDescription}</p>
            <p class="text-xs font-mono">Current: ${attributeValue}</p>
        `;
        
        this.positionTooltip(element);
        this.tooltip.classList.add('visible');
    }
    
    showCompanionTooltip(element) {
        const companionName = element.querySelector('h3').textContent;
        const companionLevel = element.querySelector('.text-gray-400').textContent;
        const companionDescription = element.querySelector('.text-gray-300').textContent;
        
        this.tooltip.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">${companionName}</h4>
            <p class="text-sm text-gray-300 mb-2">${companionDescription}</p>
            <p class="text-xs font-mono">${companionLevel}</p>
        `;
        
        this.positionTooltip(element);
        this.tooltip.classList.add('visible');
    }
    
    showQuestTooltip(element) {
        const questName = element.querySelector('h4').textContent;
        const questDescription = element.querySelector('.text-gray-300').textContent;
        const questProgress = element.querySelector('.font-mono')?.textContent || '0%';
        
        this.tooltip.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">${questName}</h4>
            <p class="text-sm text-gray-300 mb-2">${questDescription}</p>
            <p class="text-xs font-mono">Progress: ${questProgress}</p>
        `;
        
        this.positionTooltip(element);
        this.tooltip.classList.add('visible');
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    positionTooltip(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 10;
        
        // Keep tooltip within viewport
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }
    
    getAttributeDescription(attributeName) {
        const descriptions = {
            'Intelligence': 'Mathematical reasoning and algorithm design capabilities',
            'Wisdom': 'Intuition, spiritual insight, and tarot reading abilities',
            'Charisma': 'Communication skills and social media presence',
            'Dexterity': 'Technical implementation speed and coding efficiency',
            'Constitution': 'Project persistence and research endurance',
            'Strength': 'System architecture and infrastructure design power'
        };
        
        return descriptions[attributeName] || 'Character attribute';
    }
    
    updateCharacterStats() {
        // Update dynamic stats based on current data
        this.updateSocialStats();
        this.updateProjectStats();
        this.updateSkillStats();
    }
    
    updateSocialStats() {
        // Update GitHub stats with animation
        const githubStats = this.characterData.reputation.github;
        this.animateCounter('#github-followers', githubStats.followers);
        this.animateCounter('#github-stars', githubStats.stars);
    }
    
    updateProjectStats() {
        const activeQuests = this.characterData.quests.active.length;
        const completedQuests = this.characterData.quests.completed.length;
        
        this.animateCounter('#active-quests', activeQuests);
        this.animateCounter('#completed-quests', completedQuests);
    }
    
    updateSkillStats() {
        const totalSkills = Object.keys(this.characterData.skills).length;
        const maxLevelSkills = Object.values(this.characterData.skills).filter(skill => 
            skill.level === 'Master' || skill.level === 'Expert'
        ).length;
        
        this.animateCounter('#total-skills', totalSkills);
        this.animateCounter('#master-skills', maxLevelSkills);
    }
    
    animateCounter(selector, targetValue) {
        const element = document.querySelector(selector);
        if (!element) return;
        
        anime({
            targets: { count: 0 },
            count: targetValue,
            duration: 2000,
            delay: 500,
            easing: 'easeOutExpo',
            update: function(anim) {
                element.textContent = Math.floor(anim.animatables[0].target.count);
            }
        });
    }
    
    // Skill tree visualization
    createSkillTreeVisualization() {
        const skillTreeContainer = document.getElementById('skill-tree-viz');
        if (!skillTreeContainer) return;
        
        const chart = echarts.init(skillTreeContainer);
        
        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(15, 20, 25, 0.95)',
                borderColor: '#f59e0b',
                textStyle: {
                    color: '#ffffff'
                }
            },
            series: [{
                type: 'graph',
                layout: 'force',
                animation: true,
                roam: true,
                draggable: true,
                focusNodeAdjacency: true,
                force: {
                    repulsion: 1000,
                    edgeLength: 200,
                    gravity: 0.1
                },
                data: this.generateSkillNodes(),
                links: this.generateSkillConnections(),
                categories: this.generateSkillCategories(),
                itemStyle: {
                    borderColor: '#f59e0b',
                    borderWidth: 2
                },
                lineStyle: {
                    color: '#f59e0b',
                    width: 2,
                    curveness: 0.2
                },
                label: {
                    show: true,
                    position: 'inside',
                    color: '#ffffff',
                    fontSize: 12
                },
                emphasis: {
                    focus: 'adjacency',
                    lineStyle: {
                        width: 4
                    }
                }
            }]
        };
        
        chart.setOption(option);
        
        // Resize chart on window resize
        window.addEventListener('resize', () => {
            chart.resize();
        });
    }
    
    generateSkillNodes() {
        const nodes = [];
        let nodeId = 0;
        
        Object.entries(this.characterData.skills).forEach(([category, skillData]) => {
            // Add category node
            nodes.push({
                id: nodeId++,
                name: skillData.name,
                category: category,
                symbolSize: 60,
                itemStyle: {
                    color: skillData.color
                }
            });
            
            // Add skill nodes
            skillData.skills.forEach(skill => {
                nodes.push({
                    id: nodeId++,
                    name: skill.name,
                    category: category,
                    symbolSize: 30 + (skill.level / 100) * 20,
                    itemStyle: {
                        color: this.interpolateColor(skillData.color, skill.level / 100)
                    },
                    value: skill.level
                });
            });
        });
        
        return nodes;
    }
    
    generateSkillConnections() {
        const connections = [];
        let nodeId = 0;
        
        Object.entries(this.characterData.skills).forEach(([category, skillData]) => {
            const categoryNodeId = nodeId++;
            
            // Connect skills to their category
            skillData.skills.forEach((skill, index) => {
                connections.push({
                    source: categoryNodeId,
                    target: nodeId + index,
                    value: skill.level / 100
                });
            });
            
            nodeId += skillData.skills.length;
        });
        
        return connections;
    }
    
    generateSkillCategories() {
        return Object.entries(this.characterData.skills).map(([key, skillData]) => ({
            name: skillData.name,
            itemStyle: {
                color: skillData.color
            }
        }));
    }
    
    interpolateColor(baseColor, intensity) {
        // Simple color interpolation
        const colors = {
            '#f59e0b': `rgba(245, 158, 11, ${0.3 + intensity * 0.7})`,
            '#0891b2': `rgba(8, 145, 178, ${0.3 + intensity * 0.7})`,
            '#8b5cf6': `rgba(139, 92, 246, ${0.3 + intensity * 0.7})`,
            '#059669': `rgba(5, 150, 105, ${0.3 + intensity * 0.7})`,
            '#dc2626': `rgba(220, 38, 38, ${0.3 + intensity * 0.7})`
        };
        
        return colors[baseColor] || baseColor;
    }
    
    // Character comparison functionality
    compareWith(otherCharacter) {
        // Implementation for character comparison
        const comparison = {
            attributes: {},
            skills: {},
            overall: 0
        };
        
        // Compare attributes
        Object.keys(this.characterData.attributes).forEach(attr => {
            const thisValue = this.characterData.attributes[attr].value;
            const otherValue = otherCharacter.attributes[attr].value;
            
            comparison.attributes[attr] = {
                this: thisValue,
                other: otherValue,
                difference: thisValue - otherValue
            };
        });
        
        // Compare skills
        Object.keys(this.characterData.skills).forEach(skill => {
            const thisProgress = this.characterData.skills[skill].progress;
            const otherProgress = otherCharacter.skills[skill].progress;
            
            comparison.skills[skill] = {
                this: thisProgress,
                other: otherProgress,
                difference: thisProgress - otherProgress
            };
        });
        
        return comparison;
    }
    
    // Export character data
    exportCharacterData() {
        const dataStr = JSON.stringify(this.characterData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `mimi-phan-character-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    }
    
    // Import character data
    importCharacterData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.characterData = { ...this.characterData, ...importedData };
                this.updateCharacterStats();
                this.refreshUI();
            } catch (error) {
                console.error('Error importing character data:', error);
            }
        };
        reader.readAsText(file);
    }
    
    refreshUI() {
        // Refresh all UI elements with new data
        this.updateCharacterStats();
        this.animateStatBars();
        this.animateFloatingElements();
    }
}

// Initialize the RPG character profile when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.rpgProfile = new RPGCharacterProfile();
});

// Add scroll-based animations
window.addEventListener('scroll', () => {
    const scrollPosition = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollProgress = scrollPosition / maxScroll;
    
    // Parallax effect for background elements
    const magicalBg = document.querySelector('.magical-bg');
    if (magicalBg) {
        magicalBg.style.transform = `translateY(${scrollProgress * 50}px)`;
    }
    
    // Fade in elements as they come into view
    const elements = document.querySelectorAll('.character-frame, .companion-card, .quest-card');
    elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible && !element.classList.contains('animated')) {
            element.classList.add('animated');
            anime({
                targets: element,
                opacity: [0.7, 1],
                scale: [0.98, 1],
                duration: 600,
                easing: 'easeOutExpo'
            });
        }
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                window.rpgProfile.switchTab('overview');
                break;
            case '2':
                e.preventDefault();
                window.rpgProfile.switchTab('skills');
                break;
            case '3':
                e.preventDefault();
                window.rpgProfile.switchTab('companions');
                break;
            case '4':
                e.preventDefault();
                window.rpgProfile.switchTab('quests');
                break;
            case '5':
                e.preventDefault();
                window.rpgProfile.switchTab('achievements');
                break;
            case 'e':
                e.preventDefault();
                window.rpgProfile.exportCharacterData();
                break;
        }
    }
});

// Performance optimization
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
        } else {
            entry.target.classList.remove('in-view');
        }
    });
}, observerOptions);

// Observe elements for performance optimization
document.querySelectorAll('.character-frame, .skill-item, .companion-card, .quest-card').forEach(el => {
    observer.observe(el);
});

// Add loading animation
window.addEventListener('load', () => {
    anime({
        targets: 'body',
        opacity: [0, 1],
        duration: 1000,
        easing: 'easeOutExpo'
    });
    
    // Initialize skill tree visualization after load
    setTimeout(() => {
        if (window.rpgProfile) {
            window.rpgProfile.createSkillTreeVisualization();
        }
    }, 2000);
});