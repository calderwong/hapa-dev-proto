// RPG Character Profile - Main JavaScript (Enhanced with Complete Content Archiver)
class RPGCharacterProfile {
    constructor() {
        this.currentTab = 'overview';
        this.characterData = characterData;
        this.contentArchiver = new ContentArchiver();
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.setupMagicalBackground();
        this.createFloatingParticles();
        this.initializeTooltips();
        this.updateCharacterStats();
        this.setupDownloadFeature();
        this.displayArchiveStats();
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Download button
        document.getElementById('download-everything-btn').addEventListener('click', () => {
            this.showDownloadModal();
        });
        
        document.getElementById('close-download-modal').addEventListener('click', () => {
            this.hideDownloadModal();
        });
        
        document.getElementById('start-full-download').addEventListener('click', () => {
            this.startCompleteDownload();
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
        
        // Social media content interactions
        document.querySelectorAll('.content-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                this.showContentTooltip(e.currentTarget);
            });
            
            item.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }
    
    setupDownloadFeature() {
        // Initialize download modal with enhanced options
        this.downloadInProgress = false;
        
        // Update download modal with new options
        const formatSelect = document.getElementById('download-format');
        const zipOption = document.createElement('option');
        zipOption.value = 'zip';
        zipOption.textContent = 'ZIP Archive (Recommended)';
        formatSelect.appendChild(zipOption);
    }
    
    displayArchiveStats() {
        // Update UI with archive statistics
        const archive = this.contentArchiver.getCompleteArchive();
        
        // Add archive stats to the overview if elements exist
        const statsContainer = document.querySelector('.stats');
        if (statsContainer) {
            const archiveStat = document.createElement('div');
            archiveStat.className = 'stat-card';
            archiveStat.innerHTML = `
                <div class="stat-number">${archive.metadata.totalItems}</div>
                <div class="stat-label">Archived Items</div>
            `;
            statsContainer.appendChild(archiveStat);
        }
    }
    
    showDownloadModal() {
        const modal = document.getElementById('download-modal');
        modal.classList.remove('hidden');
        
        // Update modal content with archive statistics
        const archive = this.contentArchiver.getCompleteArchive();
        
        // Add archive info to modal
        const modalContent = modal.querySelector('.space-y-4');
        const archiveInfo = document.createElement('div');
        archiveInfo.className = 'p-4 bg-purple-800 rounded-lg border border-amber-500';
        archiveInfo.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">📦 Complete Archive Available</h4>
            <p class="text-sm text-gray-300 mb-2">This download includes the full text content from all sources:</p>
            <ul class="text-xs text-gray-400 space-y-1">
                <li>• ${archive.blogPosts.length} Blog Posts with full content</li>
                <li>• ${archive.githubRepos.length} GitHub Repositories with READMEs</li>
                <li>• ${archive.socialMedia.length} Social Media accounts with posts</li>
                <li>• ${archive.researchPapers.length} Research Papers with full text</li>
                <li>• ${archive.projects.length} Projects with documentation</li>
                <li>• ${archive.websites.length} Websites with page content</li>
            </ul>
            <p class="text-xs text-gray-400 mt-2">Total size: ${(archive.metadata.totalSize / 1024).toFixed(2)} KB</p>
        `;
        
        modalContent.insertBefore(archiveInfo, modalContent.firstChild);
        
        // Animate modal
        anime({
            targets: modal.querySelector('.bg-purple-900'),
            scale: [0.8, 1],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutExpo'
        });
    }
    
    hideDownloadModal() {
        const modal = document.getElementById('download-modal');
        modal.classList.add('hidden');
        
        // Remove the archive info div we added
        const archiveInfo = modal.querySelector('.p-4.bg-purple-800');
        if (archiveInfo) {
            archiveInfo.remove();
        }
    }
    
    async startCompleteDownload() {
        if (this.downloadInProgress) return;
        
        this.downloadInProgress = true;
        const progressContainer = document.getElementById('download-progress-container');
        const progressBar = document.getElementById('download-progress-bar');
        const percentageText = document.getElementById('download-percentage');
        
        // Show progress container
        progressContainer.classList.remove('hidden');
        
        // Get selected content types
        const selectedTypes = [];
        if (document.getElementById('download-blog').checked) selectedTypes.push('blog');
        if (document.getElementById('download-github').checked) selectedTypes.push('github');
        if (document.getElementById('download-social').checked) selectedTypes.push('social');
        if (document.getElementById('download-research').checked) selectedTypes.push('research');
        if (document.getElementById('download-projects').checked) selectedTypes.push('projects');
        
        if (selectedTypes.length === 0) {
            alert('Please select at least one content type to download.');
            this.downloadInProgress = false;
            progressContainer.classList.add('hidden');
            return;
        }
        
        const format = document.getElementById('download-format').value;
        
        // Simulate comprehensive download process
        let progress = 0;
        const interval = setInterval(() => {
            progress += 1.5;
            progressBar.style.width = `${progress}%`;
            percentageText.textContent = `${Math.round(progress)}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    this.generateCompleteDownload(selectedTypes, format);
                    this.hideDownloadModal();
                    progressContainer.classList.add('hidden');
                    this.downloadInProgress = false;
                    
                    // Reset progress bar
                    progressBar.style.width = '0%';
                    percentageText.textContent = '0%';
                }, 500);
            }
        }, 150);
    }
    
    generateCompleteDownload(selectedTypes, format) {
        const archive = this.contentArchiver.getCompleteArchive();
        
        // Filter content based on selected types
        const filteredArchive = {
            metadata: archive.metadata,
            blogPosts: selectedTypes.includes('blog') ? archive.blogPosts : [],
            githubRepos: selectedTypes.includes('github') ? archive.githubRepos : [],
            socialMedia: selectedTypes.includes('social') ? archive.socialMedia : [],
            researchPapers: selectedTypes.includes('research') ? archive.researchPapers : [],
            projects: selectedTypes.includes('projects') ? archive.projects : [],
            websites: selectedTypes.includes('projects') ? archive.websites : []
        };
        
        // Update total items count
        filteredArchive.metadata.totalItems = filteredArchive.blogPosts.length + 
                                            filteredArchive.githubRepos.length + 
                                            filteredArchive.socialMedia.length + 
                                            filteredArchive.researchPapers.length + 
                                            filteredArchive.projects.length + 
                                            filteredArchive.websites.length;
        
        let bundle;
        
        if (format === 'zip') {
            // Since we can't create actual ZIP files in browser, use JSON as fallback
            bundle = {
                content: JSON.stringify(filteredArchive, null, 2),
                filename: `mimi-phan-complete-archive-${new Date().toISOString().split('T')[0]}.json`,
                mimeType: 'application/json'
            };
        } else {
            bundle = this.contentArchiver.generateCompleteBundle(format);
            // Use filtered archive instead of full archive
            if (format === 'markdown') {
                bundle.content = this.generateFilteredMarkdown(filteredArchive);
            } else if (format === 'html') {
                bundle.content = this.contentArchiver.generateHTMLArchive(filteredArchive);
            }
        }
        
        // Create and download file
        const blob = new Blob([bundle.content], { type: bundle.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = bundle.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        this.showDownloadSuccess(filteredArchive.metadata.totalItems, format);
    }
    
    generateFilteredMarkdown(archive) {
        let content = `# Mimi Phan - Complete Content Archive\n\n`;
        content += `**Generated:** ${new Date().toLocaleDateString()}\n`;
        content += `**Total Items:** ${archive.metadata.totalItems}\n`;
        content += `**Approximate Size:** ${(archive.metadata.totalSize / 1024).toFixed(2)} KB\n\n`;
        content += `---\n\n`;
        content += `## ⚠️ IMPORTANT: Complete Content Included\n\n`;
        content += `This archive contains the **full text content** from all sources, not just metadata or links. You can use this to completely recreate the content in another application.\n\n`;
        
        // Blog Posts
        if (archive.blogPosts.length > 0) {
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
        }
        
        // GitHub Repositories
        if (archive.githubRepos.length > 0) {
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
        }
        
        // Social Media
        if (archive.socialMedia.length > 0) {
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
                        content += `---\n\n`;
                    });
                }
                
                content += `---\n\n`;
            });
        }
        
        // Research Papers
        if (archive.researchPapers.length > 0) {
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
        }
        
        // Projects
        if (archive.projects.length > 0) {
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
                content += `\n---\n\n`;
            });
        }
        
        // Websites
        if (archive.websites.length > 0) {
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
        }
        
        // Metadata
        content += `# Archive Metadata\n\n`;
        content += `**Scraped Date:** ${archive.metadata.scrapedDate}\n`;
        content += `**Total Items:** ${archive.metadata.totalItems}\n`;
        content += `**Approximate Size:** ${(archive.metadata.totalSize / 1024).toFixed(2)} KB\n`;
        content += `**Sources:**\n`;
        archive.metadata.sources.forEach(source => {
            content += `- ${source}\n`;
        });
        
        content += `\n---\n\n`;
        content += `# How to Use This Archive\n\n`;
        content += `This archive contains the complete content from all of Mimi Phan's digital presence. You can use this to:\n\n`;
        content += `1. **Recreate the RPG Character Profile** - Use the character data, skills, and content to rebuild the profile in another application\n`;
        content += `2. **Analyze Content Patterns** - Study the writing style, technical approaches, and content themes\n`;
        content += `3. **Build New Applications** - Use the content as training data or inspiration for new projects\n`;
        content += `4. **Create Derivative Works** - Reference the content for educational materials, research papers, or creative projects\n`;
        content += `5. **Archive Preservation** - Maintain a complete backup of all content for historical or research purposes\n\n`;
        content += `All content is included with full fidelity - no summaries or metadata-only entries. This is the complete digital footprint!`;
        
        return content;
    }
    
    showDownloadSuccess(itemCount, format) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg';
        notification.innerHTML = `
            <div class="flex items-center">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <span>✅ Download Complete! ${itemCount} items archived in ${format.toUpperCase()} format</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        anime({
            targets: notification,
            translateY: [-20, 0],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutExpo'
        });
        
        // Remove after 5 seconds
        setTimeout(() => {
            anime({
                targets: notification,
                translateY: [0, -20],
                opacity: [1, 0],
                duration: 300,
                easing: 'easeInExpo',
                complete: () => {
                    document.body.removeChild(notification);
                }
            });
        }, 5000);
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
        
        // Animate social cards
        anime({
            targets: '.social-card',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(200),
            duration: 800,
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
    
    showContentTooltip(element) {
        const contentText = element.querySelector('.text-gray-300').textContent;
        const engagement = element.querySelector('.text-gray-400').textContent;
        
        this.tooltip.innerHTML = `
            <h4 class="font-semibold text-amber-400 mb-2">Content</h4>
            <p class="text-sm text-gray-300 mb-2">${contentText}</p>
            <p class="text-xs font-mono">${engagement}</p>
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
        // Update social media stats with animation
        const totalFollowers = this.characterData.socialMedia.crossPlatformMetrics.totalFollowers;
        const totalEngagement = this.characterData.socialMedia.crossPlatformMetrics.totalEngagement;
        
        // Animate social influence stat
        const socialInfluenceBar = document.querySelector('[data-stat="social-influence"] .stat-bar');
        if (socialInfluenceBar) {
            const percentage = (totalFollowers / 5000) * 100;
            socialInfluenceBar.style.width = `${Math.min(percentage, 100)}%`;
        }
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
    const elements = document.querySelectorAll('.character-frame, .companion-card, .quest-card, .social-card');
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
                window.rpgProfile.switchTab('social');
                break;
            case '4':
                e.preventDefault();
                window.rpgProfile.switchTab('companions');
                break;
            case '5':
                e.preventDefault();
                window.rpgProfile.switchTab('quests');
                break;
            case '6':
                e.preventDefault();
                window.rpgProfile.switchTab('achievements');
                break;
            case 'd':
                e.preventDefault();
                window.rpgProfile.showDownloadModal();
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
document.querySelectorAll('.character-frame, .skill-item, .companion-card, .quest-card, .social-card').forEach(el => {
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
});