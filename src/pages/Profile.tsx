// @ts-nocheck
import React, { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';
import type { UserProfile, SystemStats } from '../types';

const Profile: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile>({ displayName: '', bio: '' });
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!window.electronAPI) return;
        setLoading(true);
        try {
            const [p, s] = await Promise.all([
                window.electronAPI.getProfile!(),
                window.electronAPI.getSystemStats!()
            ]);
            console.log('[Profile] Loaded profile:', p);
            const loadedProfile = p || { displayName: '', bio: '' };
            setProfile(loadedProfile);
            setHasChanges(false);
            setStats(s);
        } catch (err) {
            console.error('Failed to load profile data', err);
        } finally {
            setLoading(false);
        }
    };

    // Simple direct save - pass profile explicitly to avoid closure issues
    const handleSave = async (profileToSave?: UserProfile) => {
        if (!window.electronAPI) return;
        const dataToSave = profileToSave || profile;
        setSaving(true);
        try {
            console.log('[Profile] Saving profile:', dataToSave);
            await window.electronAPI.saveProfile!(dataToSave);
            console.log('[Profile] Profile saved successfully');
            setHasChanges(false);
            window.dispatchEvent(new Event('user-profile-update'));
        } catch (err) {
            console.error('Failed to save profile', err);
        } finally {
            setSaving(false);
        }
    };
    
    // Update display name
    const handleNameChange = (e: any) => {
        const newProfile = { ...profile, displayName: e.target.value };
        setProfile(newProfile);
        setHasChanges(true);
    };
    
    // Update bio
    const handleBioChange = (e: any) => {
        const newProfile = { ...profile, bio: e.target.value };
        setProfile(newProfile);
        setHasChanges(true);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <PageContainer title="Operator Profile" icon="account-circle">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header / Identity Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <rux-card>
                            <div className="p-6 space-y-6">
                                <div className="flex items-start gap-6">
                                    <div
                                        className={`flex-shrink-0 relative group cursor-pointer transition-all duration-200 ${isDragging ? 'scale-105 ring-4 ring-astro-primary' : ''}`}
                                        onClick={() => !imageLoading && document.getElementById('avatar-upload')?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (!imageLoading) setIsDragging(true);
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                        }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            if (imageLoading) return;

                                            const file = e.dataTransfer.files?.[0];
                                            if (!file || !file.type.startsWith('image/') || !window.electronAPI?.saveProfileImage) return;

                                            try {
                                                setImageLoading(true);
                                                const reader = new FileReader();
                                                reader.onload = async () => {
                                                    const base64 = (reader.result as string).split(',')[1];
                                                    const { imageUrl } = await window.electronAPI.saveProfileImage!({
                                                        bytesBase64: base64,
                                                        mimeType: file.type
                                                    });
                                                    setProfile(prev => ({ ...prev, avatarUrl: imageUrl }));
                                                    window.dispatchEvent(new Event('user-profile-update'));
                                                    setImageLoading(false);
                                                };
                                                reader.readAsDataURL(file);
                                            } catch (err) {
                                                console.error('Failed to upload profile image via drag-and-drop', err);
                                                setImageLoading(false);
                                            }
                                        }}
                                    >
                                        <div className={`w-24 h-24 rounded-full bg-astro-surface-variant border-2 ${isDragging ? 'border-white' : 'border-astro-primary'} flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(77,184,255,0.3)] group-hover:border-white transition-colors relative`}>
                                            {profile.avatarUrl ? (
                                                <img src={profile.avatarUrl} alt="Avatar" className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-50' : 'opacity-100'}`} />
                                            ) : (
                                                <rux-icon icon="account-circle" size="large" className="text-astro-primary"></rux-icon>
                                            )}

                                            {imageLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                                    <rux-progress type="indeterminate" className="w-8"></rux-progress>
                                                </div>
                                            )}
                                        </div>

                                        {!imageLoading && (
                                            <div className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <rux-icon icon="upload" size="small" className="text-white"></rux-icon>
                                            </div>
                                        )}

                                        <input
                                            type="file"
                                            id="avatar-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !window.electronAPI?.saveProfileImage) return;

                                                try {
                                                    setImageLoading(true);
                                                    const reader = new FileReader();
                                                    reader.onload = async () => {
                                                        const base64 = (reader.result as string).split(',')[1];
                                                        const { imageUrl } = await window.electronAPI.saveProfileImage!({
                                                            bytesBase64: base64,
                                                            mimeType: file.type
                                                        });
                                                        setProfile(prev => ({ ...prev, avatarUrl: imageUrl }));
                                                        window.dispatchEvent(new Event('user-profile-update'));
                                                        setImageLoading(false);
                                                    };
                                                    reader.readAsDataURL(file);
                                                } catch (err) {
                                                    console.error('Failed to upload profile image', err);
                                                    setImageLoading(false);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex-grow space-y-4">
                                        <rux-input
                                            label="Display Name"
                                            placeholder="Enter your operator name"
                                            value={profile.displayName}
                                            onRuxinput={handleNameChange}
                                            className="w-full"
                                        ></rux-input>

                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400 font-medium ml-1">Operator ID (Public Key)</label>
                                            <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700 font-mono text-xs text-emerald-400 break-all">
                                                <rux-icon icon="vpn-key" size="extra-small"></rux-icon>
                                                {stats?.p2pPublicKey || 'Loading key...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <rux-textarea
                                    label="Neural Persona (Context)"
                                    placeholder="Define who you are. This context may be used by AI agents to personalize responses."
                                    value={profile.bio || ''}
                                    onRuxinput={handleBioChange}
                                    rows={4}
                                    className="w-full"
                                ></rux-textarea>

                                <div className="flex justify-end items-center gap-3">
                                    {hasChanges && (
                                        <span className="text-xs text-yellow-400">Unsaved changes</span>
                                    )}
                                    <rux-button onClick={() => handleSave()} disabled={saving}>
                                        {saving ? 'Saving...' : hasChanges ? 'Save Profile' : 'Saved ✓'}
                                    </rux-button>
                                </div>
                            </div>
                        </rux-card>
                    </div>

                    {/* Network Status */}
                    <div className="md:col-span-1">
                        <rux-card>
                            <div className="p-6 space-y-6">
                                <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2">Network Status</h3>

                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Swarm Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${stats?.p2pPeers ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        <span className={stats?.p2pPeers ? 'text-emerald-400' : 'text-red-400'}>
                                            {stats?.p2pPeers ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 rounded p-4 border border-gray-700 flex flex-col items-center justify-center space-y-2">
                                    <span className="text-4xl font-bold text-white">{stats?.p2pPeers || 0}</span>
                                    <span className="text-xs uppercase tracking-widest text-gray-500">Active Peers</span>
                                </div>

                                <div className="text-xs text-gray-500 leading-relaxed">
                                    Your node is actively discovering peers on the Hyperswarm DHT. Data replication occurs automatically with connected peers.
                                </div>
                            </div>
                        </rux-card>
                    </div>
                </div>

                {/* Operational Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <rux-card>
                        <div className="p-4 flex flex-col items-center justify-center space-y-2">
                            <rux-icon icon="library-books" size="small" className="text-purple-400"></rux-icon>
                            <span className="text-2xl font-bold text-white">{stats?.cardCount || 0}</span>
                            <span className="text-xs uppercase tracking-widest text-gray-500">Cards</span>
                        </div>
                    </rux-card>
                    <rux-card>
                        <div className="p-4 flex flex-col items-center justify-center space-y-2">
                            <rux-icon icon="device-hub" size="small" className="text-blue-400"></rux-icon>
                            <span className="text-2xl font-bold text-white">{stats?.wikiEntryCount || 0}</span>
                            <span className="text-xs uppercase tracking-widest text-gray-500">Wiki Nodes</span>
                        </div>
                    </rux-card>
                    <rux-card>
                        <div className="p-4 flex flex-col items-center justify-center space-y-2">
                            <rux-icon icon="storage" size="small" className="text-orange-400"></rux-icon>
                            <span className="text-2xl font-bold text-white">{formatBytes(stats?.storageUsageBytes || 0)}</span>
                            <span className="text-xs uppercase tracking-widest text-gray-500">Storage</span>
                        </div>
                    </rux-card>
                    <rux-card>
                        <div className="p-4 flex flex-col items-center justify-center space-y-2">
                            <rux-icon icon="memory" size="small" className="text-pink-400"></rux-icon>
                            <span className="text-2xl font-bold text-white">{stats?.wormholeRunCount || '-'}</span>
                            <span className="text-xs uppercase tracking-widest text-gray-500">Ops Run</span>
                        </div>
                    </rux-card>
                </div>

                {/* Data Management */}
                <rux-card>
                    <div className="p-6">
                        <h3 className="text-lg font-medium text-white border-b border-gray-700 pb-2 mb-4">Data Management</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-white font-medium">Local Storage</h4>
                                <p className="text-sm text-gray-400">Manage your local Hypercore data and caches.</p>
                            </div>
                            <div className="flex gap-4">
                                <rux-button size="small" secondary disabled icon="file-download">Export Data</rux-button>
                                <rux-button size="small" secondary disabled icon="delete-forever" className="text-red-400 border-red-900/50 hover:border-red-500">Clear Storage</rux-button>
                            </div>
                        </div>
                    </div>
                </rux-card>

            </div>
        </PageContainer>
    );
};

export default Profile;
